package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;

import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/** Review windows are business facts; the clock, database ledger and transactions decide delivery. */
@Service
public class JfReviewWindows {
  private static final org.slf4j.Logger LOG = org.slf4j.LoggerFactory.getLogger(JfReviewWindows.class);
  static final long DAY_MS = Duration.ofDays(1).toMillis();
  private final JfStore store;
  private final JfSchema schema;
  private final Clock clock;
  private final TransactionTemplate transaction;
  private final AtomicBoolean running = new AtomicBoolean();

  @Autowired
  public JfReviewWindows(JfStore store, JfSchema schema, PlatformTransactionManager transactions) {
    this(store, schema, transactions, Clock.systemUTC());
  }

  JfReviewWindows(JfStore store, JfSchema schema, PlatformTransactionManager transactions, Clock clock) {
    this.store = store;
    this.schema = schema;
    this.clock = clock;
    transaction = new TransactionTemplate(transactions);
    transaction.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
    transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
  }

  public Instant now() { return clock.instant(); }

  static Instant parseTime(String value) {
    try { return Instant.parse(value); }
    catch (RuntimeException ignored) {
      try { return LocalDateTime.parse(value.replace(' ', 'T')).atZone(ZoneId.of("Asia/Shanghai")).toInstant(); }
      catch (RuntimeException invalid) { throw error(422, "INVALID_DATE", "时间格式无效，请填写日期和时间"); }
    }
  }

  static Instant startsAt(JfStore.Entity task) {
    String value = str(task.data(), "startsAt");
    if (value.isBlank()) value = str(task.data(), "assignedAt");
    return parseTime(value.isBlank() ? task.createdAt() : value);
  }

  static Instant dueAt(JfStore.Entity task) { return parseTime(str(task.data(), "dueAt")); }
  static long windowVersion(JfStore.Entity task) { return Math.max(1, number(task.data().getOrDefault("windowVersion", 1))); }

  public Map<String, Object> initialWindow(Map<String, Object> data, long days) {
    Instant now = now();
    Instant starts = str(data, "startsAt").isBlank() ? now : parseTime(str(data, "startsAt"));
    Instant due = str(data, "dueAt").isBlank() ? starts.plus(Duration.ofDays(days)) : parseTime(str(data, "dueAt"));
    require(!starts.isBefore(now), 422, "INVALID_START", "开始时间不能早于当前时间");
    require(due.isAfter(starts), 422, "INVALID_DEADLINE", "截止时间须晚于开始时间");
    return m("startsAt", starts.toString(), "dueAt", due.toString(), "windowVersion", 1);
  }

  static String status(JfStore.Entity task, Instant now) {
    if (task.status().equals("已完成")) return "completed";
    if (!task.status().equals("待评分")) return "cancelled";
    if (now.isBefore(startsAt(task))) return "not_started";
    if (!now.isBefore(dueAt(task))) return "overdue";
    return !now.isBefore(dueAt(task).minus(Duration.ofDays(1))) ? "due_soon" : "active";
  }

  public Map<String, Object> projection(JfStore.Entity task, JfAuth.Actor actor) {
    Instant now = now();
    String state = status(task, now);
    return m("startsAt", startsAt(task).toString(), "dueAt", dueAt(task).toString(),
        "windowVersion", windowVersion(task), "windowStatus", state,
        "canScore", actor != null && actor.roles.contains("expert") && Objects.equals(task.owner(), actor.id)
            && Set.of("active", "due_soon").contains(state), "serverNow", now.toString());
  }

  public void requireScoringWindow(JfStore.Entity task) {
    String state = status(task, now());
    require(!state.equals("not_started"), 409, "TASK_NOT_STARTED", "评分窗口尚未开始");
    require(!state.equals("overdue"), 409, "TASK_EXPIRED", "评分窗口已关闭，请联系运营调整时间或重新分配");
    require(Set.of("active", "due_soon").contains(state), 409, "TASK_COMPLETED", "任务已完成或已失效");
  }

  Map<String, Object> changedWindow(JfStore.Entity task, Map<String, Object> input) {
    require(task.status().equals("待评分"), 409, "TASK_COMPLETED", "已完成或已取消的任务不能修改窗口");
    Instant now = now(), oldStart = startsAt(task), oldDue = dueAt(task);
    Instant start = str(input, "startsAt").isBlank() ? oldStart : parseTime(str(input, "startsAt"));
    Instant due = parseTime(required(input, "dueAt", 1, 50));
    if (now.isBefore(oldStart)) require(!start.isBefore(now), 422, "INVALID_START", "开始时间不能早于当前时间");
    else {
      require(start.equals(oldStart), 409, "WINDOW_ALREADY_STARTED", "窗口开始后不能修改开始时间");
      require(due.isAfter(oldDue) && due.isAfter(now), 422, "EXTENSION_REQUIRED", "窗口开始后只能延长至当前时间之后");
    }
    require(due.isAfter(start), 422, "INVALID_DEADLINE", "截止时间须晚于开始时间");
    require(!start.equals(oldStart) || !due.equals(oldDue), 422, "WINDOW_UNCHANGED", "评审时间没有变化");
    String reason = required(input, "reason", 5, 2000);
    var result = copy(task.data());
    result.putAll(m("startsAt", start.toString(), "dueAt", due.toString(), "windowVersion", windowVersion(task) + 1));
    List<Object> history = new ArrayList<>(list(result.get("windowHistory")));
    history.add(m("startsAt", oldStart.toString(), "dueAt", oldDue.toString(), "windowVersion", windowVersion(task),
        "changedAt", now.toString(), "reason", reason));
    result.put("windowHistory", history);
    return result;
  }

  /** Called only for task writes, inside the same transaction as the entity mutation. */
  public static void sync(JdbcTemplate db, JfStore.Entity task) {
    if (!task.kind().equals("task")) return;
    db.update("INSERT INTO jf_review_window(task_id,submission_id,owner_id,manager_id,region_id,status,starts_at_ms,due_at_ms,window_version)"
        + " VALUES(?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE submission_id=VALUES(submission_id),owner_id=VALUES(owner_id),"
        + " manager_id=VALUES(manager_id),region_id=VALUES(region_id),status=VALUES(status),starts_at_ms=VALUES(starts_at_ms),due_at_ms=VALUES(due_at_ms),"
        + " due_soon_checked=IF(window_version=VALUES(window_version),due_soon_checked,FALSE),"
        + " overdue_checked=IF(window_version=VALUES(window_version),overdue_checked,FALSE),window_version=VALUES(window_version)",
        task.id(), str(task.data(), "submissionId"), task.owner(), number(task.data().get("managerId")), task.region(), task.status(),
        startsAt(task).toEpochMilli(), dueAt(task).toEpochMilli(), windowVersion(task));
  }

  /** The caller holds the platform setting lock; persisted cutoff changes only on enable transitions. */
  public void reminderPreferenceChanged(boolean oldEnabled, boolean enabled) {
    var state = store.db().queryForMap("SELECT * FROM jf_review_reminder_state WHERE id=1 FOR UPDATE");
    boolean reset = !oldEnabled && enabled;
    store.db().update("UPDATE jf_review_reminder_state SET enabled=?,initialized=TRUE,cutoff_ms=? WHERE id=1", enabled,
        reset ? now().toEpochMilli() : number(state.get("cutoff_ms")));
  }

  static String eligiblePhase(JfStore.Entity task, Instant now, long cutoff) {
    if (!task.status().equals("待评分") || dueAt(task).toEpochMilli() < cutoff) return "";
    String state = status(task, now);
    return Set.of("due_soon", "overdue").contains(state) ? state : "";
  }

  @Scheduled(initialDelay = 15000, fixedDelay = 60000)
  public void scan() {
    if (!schema.ready() || !running.compareAndSet(false, true)) return;
    try {
      var gate = transaction.execute(tx -> {
        var state = store.db().queryForMap("SELECT * FROM jf_review_reminder_state WHERE id=1 FOR UPDATE");
        if (!bool(state.get("initialized"))) {
          boolean enabled = bool(store.find("setting", "platformConfig", false).data().get("reviewReminder"));
          store.db().update("UPDATE jf_review_reminder_state SET enabled=?,initialized=TRUE WHERE id=1", enabled);
          return store.db().queryForMap("SELECT * FROM jf_review_reminder_state WHERE id=1");
        }
        return state;
      });
      if (gate == null || !bool(gate.get("enabled"))) return;
      long budget = System.nanoTime() + Duration.ofSeconds(30).toNanos();
      while (System.nanoTime() < budget) {
        long now = now().toEpochMilli(), cutoff = number(gate.get("cutoff_ms"));
        var ids = store.db().queryForList("SELECT task_id FROM jf_review_window WHERE status='待评分' AND due_at_ms>=? AND "
            + "((due_at_ms<=? AND overdue_checked=FALSE) OR (starts_at_ms<=? AND due_at_ms>? AND due_at_ms<=? AND due_soon_checked=FALSE))"
            + " ORDER BY due_at_ms,task_id LIMIT 200", String.class, cutoff, now, now, now, now + DAY_MS);
        for (String id : ids) transaction.executeWithoutResult(tx -> process(id));
        if (ids.size() < 200) break;
        gate = store.db().queryForMap("SELECT * FROM jf_review_reminder_state WHERE id=1");
        if (!bool(gate.get("enabled"))) break;
      }
    } catch (RuntimeException failure) {
      LOG.warn("Review reminder scan failed; durable pending work will retry: {}", failure.getClass().getSimpleName());
    } finally { running.set(false); }
  }

  void process(String taskId) {
    var gate = store.db().queryForMap("SELECT * FROM jf_review_reminder_state WHERE id=1 FOR UPDATE");
    if (!bool(gate.get("enabled"))) return;
    var preliminary = store.find("task", taskId, false);
    var work = store.find("submission", str(preliminary.data(), "submissionId"), true);
    var task = store.find("task", taskId, true);
    var index = store.db().queryForMap("SELECT * FROM jf_review_window WHERE task_id=? FOR UPDATE", taskId);
    String phase = eligiblePhase(task, now(), number(gate.get("cutoff_ms")));
    if (phase.isEmpty() || bool(index.get(phase + "_checked"))) return;
    boolean current = work.status().equals("in_review")
        && str(work.data(), "revisionId").equals(str(task.data(), "revisionId"));
    if (current) notifyWindow(task, phase);
    store.db().update("UPDATE jf_review_window SET " + phase + "_checked=TRUE WHERE task_id=? AND window_version=?", taskId, windowVersion(task));
  }

  public void notifyWindow(JfStore.Entity task, String phase) {
    Set<Long> recipients = new LinkedHashSet<>();
    if (task.owner() != null) recipients.add(task.owner());
    if (phase.equals("overdue")) recipients.add(number(task.data().get("managerId")));
    for (long recipient : recipients) {
      var accounts = store.db().queryForList("SELECT a.*,u.user_name,u.nick_name FROM jf_account a JOIN sys_user u ON u.user_id=a.user_id"
          + " WHERE a.user_id=? AND a.enabled=TRUE AND u.status='0' AND u.del_flag='0'", recipient);
      if (accounts.isEmpty()) continue;
      var actor = new JfAuth.Actor(accounts.getFirst());
      boolean expert = Objects.equals(task.owner(), actor.id) && actor.roles.contains("expert");
      boolean manager = actor.id == number(task.data().get("managerId")) && actor.operator() && actor.region(task.region());
      if (!expert && !manager) continue;
      String noticeId = "reviewNotice_" + hash(task.id() + ":" + windowVersion(task) + ":" + phase + ":" + recipient).substring(0, 40);
      String title = switch (phase) { case "due_soon" -> "评审即将截止"; case "overdue" -> "评审任务已逾期"; default -> "评审时间窗口已调整"; };
      var formatter = java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(ZoneId.of("Asia/Shanghai"));
      String content = "匿名评审任务「" + str(task.data(), "title") + "」，北京时间开始 "
          + formatter.format(startsAt(task)) + "，截止 " + formatter.format(dueAt(task)) + "。";
      if (phase.equals("window_updated")) {
        var history = list(task.data().get("windowHistory"));
        if (!history.isEmpty()) content += " 调整原因：" + str(obj(history.getLast()), "reason");
      }
      store.db().update("INSERT IGNORE INTO jf_entity(id,kind,owner_id,region_id,status,payload) VALUES(?,'notification',?,?,'unread',?)",
          noticeId, recipient, task.region(), json(m("title", title, "content", content, "sourceType", "review-task", "targetId", task.id(),
              "workId", "", "phase", phase, "windowVersion", windowVersion(task), "read", false)));
      store.db().update("INSERT IGNORE INTO jf_review_delivery(task_id,window_version,phase,recipient_id,notification_id) VALUES(?,?,?,?,?)",
          task.id(), windowVersion(task), phase, recipient, noticeId);
    }
  }

  public Object markRead(JfAuth.Actor actor, String id) {
    var notice = store.find("notification", id, true);
    require(Objects.equals(notice.owner(), actor.id) && str(notice.data(), "sourceType").equals("review-task"),
        404, "NOT_FOUND", "提醒不存在或不可见");
    if (!notice.status().equals("read")) store.save(notice, notice.region(), "read", notice.data());
    return m("ok", true);
  }

  public Map<String, Object> alerts(JfAuth.Actor actor, String phase, String scope, boolean unreadOnly, int page, int pageSize) {
    require(Set.of("all", "due_soon", "overdue").contains(phase), 422, "INVALID_PHASE", "预警类型无效");
    require(Set.of("mine", "all").contains(scope), 422, "INVALID_SCOPE", "预警范围无效");
    require(page >= 1 && page <= 100000 && pageSize >= 1 && pageSize <= 100, 422, "INVALID_PAGE", "分页参数无效");
    Instant instant = now();
    long now = instant.toEpochMilli();
    List<Object> args = new ArrayList<>();
    String filter = " w.status='待评分' AND ";
    if (phase.equals("overdue")) { filter += "w.due_at_ms<=?"; args.add(now); }
    else if (phase.equals("due_soon")) { filter += "w.starts_at_ms<=? AND w.due_at_ms>? AND w.due_at_ms<=?"; args.addAll(List.of(now, now, now + DAY_MS)); }
    else { filter += "(w.due_at_ms<=? OR (w.starts_at_ms<=? AND w.due_at_ms<=?))"; args.addAll(List.of(now, now, now + DAY_MS)); }
    if (actor.operator()) {
      if (!actor.national()) {
        if (actor.regions.isEmpty()) filter += " AND 1=0";
        else { filter += " AND w.region_id IN (" + String.join(",", Collections.nCopies(actor.regions.size(), "?")) + ")"; args.addAll(actor.regions); }
      }
      if (scope.equals("mine")) { filter += " AND (w.owner_id=? OR w.manager_id=?)"; args.addAll(List.of(actor.id, actor.id)); }
    } else { filter += " AND w.owner_id=?"; args.add(actor.id); }
    if (unreadOnly) {
      filter += " AND EXISTS(SELECT 1 FROM jf_review_delivery d JOIN jf_entity n ON n.id=d.notification_id WHERE d.task_id=w.task_id"
          + " AND d.window_version=w.window_version AND d.recipient_id=? AND n.status='unread')";
      args.add(actor.id);
    }
    Long total = store.db().queryForObject("SELECT COUNT(*) FROM jf_review_window w WHERE " + filter, Long.class, args.toArray());
    List<Object> queryArgs = new ArrayList<>(args); queryArgs.add(pageSize); queryArgs.add((page - 1) * pageSize);
    var ids = store.db().queryForList("SELECT w.task_id FROM jf_review_window w WHERE " + filter + " ORDER BY w.due_at_ms,w.task_id LIMIT ? OFFSET ?",
        String.class, queryArgs.toArray());
    List<Object> items = new ArrayList<>();
    for (String id : ids) {
      var task = store.find("task", id, false);
      var dto = m("id", id, "taskId", id, "submissionId", str(task.data(), "submissionId"), "title", str(task.data(), "title"),
          "stage", str(task.data(), "stage"), "expertName", str(task.data(), "expertName"), "regionId", task.region(),
          "status", task.status(), "lockVersion", task.version(), "version", task.version());
      dto.putAll(projection(task, actor));
      var notices = store.db().queryForList("SELECT n.id,n.status FROM jf_review_delivery d JOIN jf_entity n ON n.id=d.notification_id"
          + " WHERE d.task_id=? AND d.window_version=? AND d.recipient_id=?", id, windowVersion(task), actor.id);
      dto.put("notificationIds", notices.stream().filter(n -> text(n.get("status")).equals("unread")).map(n -> text(n.get("id"))).toList());
      dto.put("unread", notices.stream().anyMatch(n -> text(n.get("status")).equals("unread")));
      items.add(dto);
    }
    var own = notices(actor);
    return m("items", items, "total", total == null ? 0 : total, "page", page, "pageSize", pageSize,
        "unreadCount", own.get("unreadCount"), "notifications", own.get("notifications"), "serverNow", instant.toString());
  }

  public Map<String, Object> notices(JfAuth.Actor actor) {
    String from = " FROM jf_review_delivery d JOIN jf_entity n ON n.id=d.notification_id WHERE d.recipient_id=? AND n.owner_id=?";
    Long unread = store.db().queryForObject("SELECT COUNT(*)" + from + " AND n.status='unread'", Long.class, actor.id, actor.id);
    List<Object> notifications = new ArrayList<>();
    for (var row : store.db().queryForList("SELECT n.id,n.payload,n.status,n.created_at" + from
        + " ORDER BY (n.status='unread') DESC,n.created_at DESC,n.id LIMIT 100", actor.id, actor.id)) {
      var dto = parse(text(row.get("payload")));
      dto.putAll(m("id", row.get("id"), "read", text(row.get("status")).equals("read"), "createdAt", timestamp(row.get("created_at"))));
      notifications.add(dto);
    }
    return m("notifications", notifications, "unreadCount", unread == null ? 0 : unread);
  }
}
