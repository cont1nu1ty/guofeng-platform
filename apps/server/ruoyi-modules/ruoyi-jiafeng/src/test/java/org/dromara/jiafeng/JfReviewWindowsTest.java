package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.time.*;
import java.util.*;
import org.dromara.common.core.utils.SpringUtils;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import tools.jackson.databind.json.JsonMapper;

class JfReviewWindowsTest {
  private static final Instant NOW = Instant.parse("2026-09-30T04:00:00Z");
  private final JfStore store = mock(JfStore.class);
  private final JdbcTemplate db = mock(JdbcTemplate.class);

  @BeforeAll
  static void mapper() {
    var beans = new DefaultListableBeanFactory();
    beans.registerSingleton("jsonMapper", JsonMapper.builder().build());
    new SpringUtils().postProcessBeanFactory(beans);
  }

  private JfReviewWindows service() {
    when(store.db()).thenReturn(db);
    return new JfReviewWindows(store, mock(JfSchema.class), mock(PlatformTransactionManager.class), Clock.fixed(NOW, ZoneOffset.UTC));
  }

  private static JfStore.Entity task(Instant start, Instant due, String status) {
    return new JfStore.Entity("task-1", "task", 10004L, "zhejiang", status,
        m("startsAt", start.toString(), "dueAt", due.toString(), "assignedAt", start.toString(),
            "windowVersion", 3, "managerId", 10002L, "submissionId", "sub-1", "revisionId", "revision-1",
            "title", "匿名评审稿件 · 第1版", "content", "PRIVATE BLIND MATERIAL"),
        5, start.toString(), start.toString());
  }

  private static JfAuth.Actor actor(long id, String role, String region) {
    return new JfAuth.Actor(m("user_id", id, "user_name", "test", "nick_name", "Test", "realm", "staff",
        "roles", List.of(role), "region_ids", List.of(region), "version", 1));
  }

  @Test
  void defaultWindowStartsAtServerClockAndDeadlineUsesChosenStart() {
    var service = service();
    var defaults = service.initialWindow(m(), 7);
    assertEquals(NOW.toString(), defaults.get("startsAt"));
    assertEquals(NOW.plus(Duration.ofDays(7)).toString(), defaults.get("dueAt"));
    var future = service.initialWindow(m("startsAt", "2026-10-02T12:00:00+08:00"), 3);
    assertEquals("2026-10-05T04:00:00Z", future.get("dueAt"));
    assertEquals(1, future.get("windowVersion"));
  }

  @Test
  void offsetAndBeijingLocalInputsRepresentSameInstantAndBareDateIsRejected() {
    assertEquals(NOW, JfReviewWindows.parseTime("2026-09-30T12:00:00+08:00"));
    assertEquals(NOW, JfReviewWindows.parseTime("2026-09-30 12:00:00"));
    assertEquals("INVALID_DATE", assertThrows(ApiException.class, () -> JfReviewWindows.parseTime("2026-09-30")).code);
  }

  @Test
  void intervalIncludesStartAndExcludesDeadlineExactly() {
    var task = task(NOW, NOW.plusSeconds(3600), "待评分");
    assertEquals("not_started", JfReviewWindows.status(task, NOW.minusNanos(1)));
    assertEquals("due_soon", JfReviewWindows.status(task, NOW));
    assertEquals("due_soon", JfReviewWindows.status(task, NOW.plusSeconds(3600).minusNanos(1)));
    assertEquals("overdue", JfReviewWindows.status(task, NOW.plusSeconds(3600)));
    assertEquals("completed", JfReviewWindows.status(task(NOW, NOW.plusSeconds(1), "已完成"), NOW));
    assertEquals("cancelled", JfReviewWindows.status(task(NOW, NOW.plusSeconds(1), "已取消"), NOW));
  }

  @Test
  void scoringRequiresCurrentWindowAndOwningExpert() {
    var service = service();
    var active = task(NOW.minusSeconds(1), NOW.plusSeconds(1), "待评分");
    assertEquals(true, service.projection(active, actor(10004, "expert", "zhejiang")).get("canScore"));
    assertEquals(false, service.projection(active, actor(10005, "expert", "zhejiang")).get("canScore"));
    assertEquals(false, service.projection(active, actor(10004, "regional_admin", "zhejiang")).get("canScore"));
    assertDoesNotThrow(() -> service.requireScoringWindow(active));
    assertEquals("TASK_NOT_STARTED", assertThrows(ApiException.class,
        () -> service.requireScoringWindow(task(NOW.plusSeconds(1), NOW.plusSeconds(10), "待评分"))).code);
    assertEquals("TASK_EXPIRED", assertThrows(ApiException.class,
        () -> service.requireScoringWindow(task(NOW.minusSeconds(10), NOW, "待评分"))).code);
  }

  @Test
  void initialWindowRejectsPastStartAndEmptyOrReversedInterval() {
    var service = service();
    assertEquals("INVALID_START", assertThrows(ApiException.class,
        () -> service.initialWindow(m("startsAt", NOW.minusSeconds(1).toString()), 7)).code);
    assertEquals("INVALID_DEADLINE", assertThrows(ApiException.class,
        () -> service.initialWindow(m("dueAt", NOW.toString()), 7)).code);
  }

  @Test
  void beforeStartBothEndsCanChangeAndOldWindowRemainsInHistory() {
    var service = service();
    var task = task(NOW.plusSeconds(3600), NOW.plusSeconds(7200), "待评分");
    var changed = service.changedWindow(task, m("startsAt", NOW.plusSeconds(1800).toString(),
        "dueAt", NOW.plusSeconds(5400).toString(), "reason", "专家申请调整时间"));
    assertEquals(4L, changed.get("windowVersion"));
    var old = obj(list(changed.get("windowHistory")).getFirst());
    assertEquals(NOW.plusSeconds(7200).toString(), old.get("dueAt"));
    assertEquals("专家申请调整时间", old.get("reason"));
    assertFalse(task.data().containsKey("windowHistory"));
  }

  @Test
  void afterStartOnlyFutureDeadlineExtensionIsAllowedIncludingExpiredTasks() {
    var service = service();
    var task = task(NOW.minusSeconds(7200), NOW.minusSeconds(3600), "待评分");
    var extended = service.changedWindow(task, m("dueAt", NOW.plusSeconds(3600).toString(), "reason", "运营批准延期办理"));
    assertEquals(NOW.plusSeconds(3600).toString(), extended.get("dueAt"));
    assertEquals("WINDOW_ALREADY_STARTED", assertThrows(ApiException.class,
        () -> service.changedWindow(task, m("startsAt", NOW.toString(), "dueAt", NOW.plusSeconds(3600).toString(), "reason", "运营批准延期办理"))).code);
    assertEquals("EXTENSION_REQUIRED", assertThrows(ApiException.class,
        () -> service.changedWindow(task, m("dueAt", NOW.minusSeconds(1).toString(), "reason", "运营批准延期办理"))).code);
    for (String state : List.of("已完成", "已取消"))
      assertEquals("TASK_COMPLETED", assertThrows(ApiException.class,
          () -> service.changedWindow(task(NOW, NOW.plusSeconds(1), state), m())).code);
  }

  @Test
  void migrationCutoffSuppressesHistoricOverdueButRestartSelectsOnlyCurrentPhase() {
    long cutoff = NOW.minusSeconds(60).toEpochMilli();
    assertEquals("", JfReviewWindows.eligiblePhase(task(NOW.minusSeconds(3600), NOW.minusSeconds(61), "待评分"), NOW, cutoff));
    assertEquals("overdue", JfReviewWindows.eligiblePhase(task(NOW.minusSeconds(3600), NOW.minusSeconds(1), "待评分"), NOW, cutoff));
    assertEquals("due_soon", JfReviewWindows.eligiblePhase(task(NOW.minusSeconds(1), NOW.plusSeconds(3600), "待评分"), NOW, cutoff));
    assertEquals("", JfReviewWindows.eligiblePhase(task(NOW.plusSeconds(1), NOW.plusSeconds(3600), "待评分"), NOW, cutoff));
  }

  @Test
  void preferenceSavingWithoutReenablePreservesDurableCutoff() {
    var service = service();
    when(db.queryForMap("SELECT * FROM jf_review_reminder_state WHERE id=1 FOR UPDATE"))
        .thenReturn(m("initialized", true, "enabled", true, "cutoff_ms", 12L));
    service.reminderPreferenceChanged(true, true);
    verify(db).update("UPDATE jf_review_reminder_state SET enabled=?,initialized=TRUE,cutoff_ms=? WHERE id=1", true, 12L);
    service.reminderPreferenceChanged(false, true);
    verify(db).update("UPDATE jf_review_reminder_state SET enabled=?,initialized=TRUE,cutoff_ms=? WHERE id=1", true, NOW.toEpochMilli());
  }

  @Test
  void dueSoonAndWindowChangeOnlyNotifyExpertWhileOverdueAlsoNotifiesOriginalManager() {
    var service = service();
    when(db.queryForList(startsWith("SELECT a.*,u.user_name"), anyLong())).thenAnswer(invocation -> {
      long id = invocation.getArgument(1);
      return List.of(m("user_id", id, "roles", List.of(id == 10004 ? "expert" : "regional_admin"), "region_ids", List.of("zhejiang"), "version", 1));
    });
    var task = task(NOW.minusSeconds(10), NOW.plusSeconds(100), "待评分");
    task.data().put("windowHistory", List.of(m("reason", "专家申请调整时间")));
    service.notifyWindow(task, "due_soon");
    service.notifyWindow(task, "window_updated");
    verify(db, times(2)).queryForList(startsWith("SELECT a.*,u.user_name"), eq(10004L));
    verify(db, never()).queryForList(startsWith("SELECT a.*,u.user_name"), eq(10002L));
    service.notifyWindow(task, "overdue");
    verify(db).queryForList(startsWith("SELECT a.*,u.user_name"), eq(10002L));
    var payloads = org.mockito.ArgumentCaptor.forClass(String.class);
    verify(db, times(4)).update(startsWith("INSERT IGNORE INTO jf_entity"), anyString(), anyLong(), eq("zhejiang"), payloads.capture());
    assertTrue(payloads.getAllValues().stream().allMatch(p -> p.contains("北京时间") && p.contains("review-task") && !p.contains("PRIVATE BLIND MATERIAL")));
    assertTrue(payloads.getAllValues().stream().filter(p -> p.contains("window_updated")).allMatch(p -> p.contains("专家申请调整时间")));
  }

  @Test
  void movedRegionalManagerIsNotNotifiedAboutOldRegion() {
    var service = service();
    when(db.queryForList(startsWith("SELECT a.*,u.user_name"), anyLong())).thenReturn(
        List.of(m("user_id", 10002L, "roles", List.of("regional_admin"), "region_ids", List.of("beijing"), "version", 1)));
    service.notifyWindow(task(NOW.minusSeconds(10), NOW, "待评分"), "overdue");
    verify(db, never()).update(startsWith("INSERT IGNORE INTO jf_entity"), anyString(), anyLong(), anyString(), anyString());
  }

  @Test
  void markingAnotherRecipientsNoticeReadIsDenied() {
    var service = service();
    var notice = new JfStore.Entity("notice-1", "notification", 10002L, "zhejiang", "unread", m("sourceType", "review-task"), 1, "", "");
    when(store.find("notification", "notice-1", true)).thenReturn(notice);
    assertEquals("NOT_FOUND", assertThrows(ApiException.class, () -> service.markRead(actor(10004, "expert", "zhejiang"), "notice-1")).code);
    verify(store, never()).save(any(), anyString(), anyString(), anyMap());
  }
}
