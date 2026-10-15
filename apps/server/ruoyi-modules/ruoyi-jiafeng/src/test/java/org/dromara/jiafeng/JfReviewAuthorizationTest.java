package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.*;
import org.dromara.common.core.utils.SpringUtils;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;
import tools.jackson.databind.json.JsonMapper;

class JfReviewAuthorizationTest {
  @BeforeAll static void mapper() {
    var beans = new DefaultListableBeanFactory();
    beans.registerSingleton("jsonMapper", JsonMapper.builder().build());
    new SpringUtils().postProcessBeanFactory(beans);
  }
  private final JfStore store = mock(JfStore.class);
  private final JfReviewFlow flow = mock(JfReviewFlow.class);
  private final JfReview review = new JfReview(store, mock(JfAuth.class), flow,
      mock(JfReviewWindows.class), mock(JfRubrics.class));

  private static JfAuth.Actor expert(String... permissions) {
    return new JfAuth.Actor(m("user_id", 42L, "roles", List.of("expert"), "region_ids", List.of("zhejiang"),
        "permissions", List.of(permissions), "version", 1));
  }

  private JfMember member() {
    return new JfMember(store, mock(JfAuth.class), mock(JfProjection.class), review,
        mock(JfPersonalRecords.class), mock(JfAi.class));
  }

  @Test void memberCompatibilityRouteCannotBypassRevokedScorePermission() {
    var failure = assertThrows(ApiException.class,
        () -> member().command(expert("reviews:read"), "review.submit", "task-1", 1, m()));
    assertEquals(403, failure.status);
    assertEquals("FORBIDDEN", failure.code);
    verifyNoInteractions(store, flow);
  }

  private void assignment(long owner, String currentRevision) {
    var task = new JfStore.Entity("task-1", "task", owner, "zhejiang", "待评分",
        m("submissionId", "work-1", "revisionId", "revision-1", "dimensions", List.of(m("id", "writing", "max", 100)),
            "flowInstanceId", "flow-1", "flowTaskId", "node-1", "managerId", 7L), 1, "", "");
    var work = new JfStore.Entity("work-1", "submission", 10L, "zhejiang", "in_review",
        m("revisionId", currentRevision, "revisionNumber", 1, "progressIndex", 0), 1, "", "");
    when(store.find("task", "task-1", false)).thenReturn(task);
    when(store.find("task", "task-1", true)).thenReturn(task);
    when(store.find("submission", "work-1", true)).thenReturn(work);
    when(flow.complete(anyString(), anyString(), anyLong(), anyLong(), anyString())).thenReturn(1);
  }

  @Test void authorizedOwningExpertCanStillScoreThroughCompatibilityRoute() {
    assignment(42L, "revision-1");
    var result = obj(member().command(expert("reviews:score"), "review.submit", "task-1", 1,
        m("scores", List.of(85), "comment", "正文表达完整且结构清晰")));
    assertEquals(true, result.get("ok"));
    verify(flow).complete("flow-1", "node-1", 42L, 7L, "正文表达完整且结构清晰");
    verify(store).save(argThat(e -> e.id().equals("task-1")), eq("zhejiang"), eq("已完成"), anyMap());
    verify(store).save(argThat(e -> e.id().equals("work-1")), eq("zhejiang"), eq("in_review"), anyMap());
  }

  @Test void scorePermissionDoesNotGrantAnotherExpertsTaskOrAnObsoleteRevision() {
    assignment(99L, "revision-1");
    assertEquals("NOT_FOUND", assertThrows(ApiException.class,
        () -> review.command(expert("reviews:score"), "submitReview", "task-1", 1, m())).code);
    assignment(42L, "revision-2");
    assertEquals("TASK_INVALID", assertThrows(ApiException.class,
        () -> review.command(expert("reviews:score"), "submitReview", "task-1", 1, m())).code);
    verifyNoInteractions(flow);
    verify(store, never()).save(any(), anyString(), anyString(), anyMap());
  }
}
