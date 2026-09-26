package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;

import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class JfReview {
  private final JfStore store;
  private final JfAuth auth;
  private final JfReviewFlow flow;

  public JfReview(JfStore s, JfAuth a, JfReviewFlow f) {
    store = s;
    auth = a;
    flow = f;
  }

  private JfStore.Entity manuscript(JfAuth.Actor a, String id, Object version) {
    var e = store.find("submission", id, true);
    auth.operate(a, e.region());
    store.checkVersion(e, version);
    return e;
  }

  public Object command(
      JfAuth.Actor a, String command, String id, Object version, Map<String, Object> data) {
    if (command.equals("configureReviewFlow")) {
      require(bool(data.get("blind")), 422, "BLIND_REVIEW_REQUIRED", "本期固定采用匿名评审");
      require(a.national(), 403, "FORBIDDEN", "只有全国管理员可修改流程");
      var e = store.find("setting", "reviewFlow", true);
      store.checkVersion(e, version);
      List<Object> enabled = list(data.get("enabled"));
      require(
          enabled.size() == 6
              && enabled.stream().allMatch(x -> x instanceof Boolean)
              && enabled.stream().anyMatch(Jf::bool),
          422,
          "INVALID_FLOW",
          "至少开启一个评审节点");
      long days = number(data.get("deadlineDays"));
      require(days >= 1 && days <= 90, 422, "INVALID_DEADLINE", "评审期限为1至90天");
      Map<String, Object> d = copy(e.data());
      d.putAll(
          m(
              "blind",
              bool(data.get("blind")),
              "deadlineDays",
              days,
              "enabled",
              enabled,
              "flowVersion",
              number(e.data().get("flowVersion")) + 1));
      store.save(e, "all", "active", d);
      return ok();
    }
    if (command.equals("updateExpert")) {
      var e = store.find("expert", id, true);
      auth.operate(a, e.region());
      store.checkVersion(e, version);
      String group = required(data, "group", 1, 50), availability = str(data, "availability");
      require(
          List.of("可分配", "可接单", "暂停接单", "暂不接单").contains(availability),
          422,
          "INVALID_STATUS",
          "接单状态无效");
      var d = copy(e.data());
      d.putAll(m("group", group, "availability", availability));
      store.save(e, e.region(), e.status(), d);
      return ok();
    }
    if (command.equals("submitReview")) return score(a, id, version, data);
    if (command.equals("batchApproveSubmissions")) {
      List<Object> ids = list(data.get("ids"));
      require(!ids.isEmpty() && ids.size() <= 100, 422, "INVALID_BATCH", "请选择1至100篇稿件");
      for (Object sid : ids)
        command(a, "approveSubmission", text(sid), obj(data.get("versions")).get(text(sid)), m());
      return ok();
    }
    var e = manuscript(a, id, version);
    var d = copy(e.data());
    String status = e.status();
    switch (command) {
      case "approveSubmission" -> {
        require(status.equals("pending_initial_review"), 409, "INVALID_STATE", "稿件当前不能初审");
        var config = store.find("setting", "reviewFlow", true);
        d.put("flowSnapshot", config.data());
        d.put("flowInstanceId", flow.start(str(d, "revisionId"), config.data(), a.id));
        d.put("reviewManagerId", a.id);
        d.put("progressIndex", flow.currentStage(str(d, "flowInstanceId")));
        status = "in_review";
      }
      case "returnSubmission" -> {
        require(
            List.of("pending_initial_review", "in_review").contains(status),
            409,
            "INVALID_STATE",
            "当前状态不能退修");
        String reason = required(data, "reason", 5, 2000);
        flow.terminate(str(d, "flowInstanceId"), a.id, reason);
        for (var t : store.all("task"))
          if (str(t.data(), "submissionId").equals(id) && t.status().equals("待评分"))
            store.save(t, t.region(), "已取消", t.data());
        d.put("returnReason", reason);
        d.put("published", false);
        status = "returned";
        store.notifyUser(e.owner(), e.region(), "作品退回修改", reason, id);
      }
      case "prepareBlindMaterial" -> {
        require(status.equals("in_review"), 409, "INVALID_STATE", "只能为评审中稿件准备材料");
        require(bool(data.get("confirmed")), 422, "CONFIRMATION_REQUIRED", "请确认已检查并移除身份信息");
        d.put("blindContent", required(data, "content", 20, 10000));
        d.put("blindConfirmed", true);
        d.put("blindPreparedBy", a.id);
      }
      case "assignReview" -> {
        require(status.equals("in_review"), 409, "INVALID_STATE", "稿件当前不可分配评审");
        require(bool(d.get("blindConfirmed")), 422, "BLIND_MATERIAL_REQUIRED", "请先准备并确认脱敏正文");
        for (var pending : store.all("task")) {
          if (str(pending.data(), "submissionId").equals(id) && pending.status().equals("待评分")) {
            require(
                !Instant.parse(str(pending.data(), "dueAt")).isAfter(Instant.now()),
                409,
                "TASK_EXISTS",
                "当前已有待评分任务");
            store.save(pending, pending.region(), "已取消", pending.data());
          }
        }
        String expertId = required(data, "expertId", 1, 64);
        var expert = store.find("expert", expertId, true);
        var expertActor = auth.adminTarget(number(expert.owner()));
        var availableAccount =
            store
                .db()
                .queryForObject(
                    "SELECT COUNT(*) FROM jf_account a JOIN sys_user u ON u.user_id=a.user_id WHERE"
                        + " a.user_id=? AND a.enabled=1 AND u.status='0' AND u.del_flag='0'",
                    Long.class,
                    expert.owner());
        require(
            availableAccount == 1
                && expertActor.roles.contains("expert")
                && List.of("可接单", "可分配").contains(str(expert.data(), "availability")),
            409,
            "EXPERT_UNAVAILABLE",
            "专家当前不可接单");
        require(!Objects.equals(e.owner(), expert.owner()), 409, "REVIEW_CONFLICT", "投稿人不能评审自己的稿件");
        require(a.national() || a.region(expert.region()), 404, "NOT_FOUND", "专家不可见");
        Instant due =
            parseDue(
                str(data, "dueAt"),
                number(obj(d.get("flowSnapshot")).getOrDefault("deadlineDays", 7)));
        require(due.isAfter(Instant.now()), 422, "INVALID_DEADLINE", "截止时间须晚于当前时间");
        Map<String, Object> task = flow.assign(str(d, "flowInstanceId"), expert.owner(), a.id);
        task.putAll(
            m(
                "submissionId",
                id,
                "revisionId",
                str(d, "revisionId"),
                "title",
                "匿名评审稿件 · 第" + d.get("revisionNumber") + "版",
                "content",
                str(d, "blindContent"),
                "expertId",
                expertId,
                "expertName",
                str(expert.data(), "name"),
                "dueAt",
                due.toString(),
                "assignedAt",
                now(),
                "ruleVersion",
                "jiafeng-four-v1",
                "flowInstanceId",
                str(d, "flowInstanceId"),
                "managerId",
                a.id,
                "dimensions",
                DIMENSIONS));
        store.create("task", expert.owner(), e.region(), "待评分", task);
      }
      case "decideSubmission" -> {
        String decision = str(data, "result");
        require(
            List.of("shortlisted", "rejected", "awarded", "collected").contains(decision),
            422,
            "INVALID_DECISION",
            "决定无效");
        require(
            status.equals("in_review") || List.of("shortlisted", "awarded").contains(status),
            409,
            "INVALID_STATE",
            "当前状态不可决定结果");
        require(flow.finished(str(d, "flowInstanceId")), 409, "REVIEW_INCOMPLETE", "请先完成全部开启的评审节点");
        d.put("published", false);
        d.put("decision", decision);
        d.put("decisionNote", required(data, "note", 1, 2000));
        status = decision;
        store.notifyUser(e.owner(), e.region(), "评审结果更新", str(d, "decisionNote"), id);
      }
      case "publishSubmission" -> {
        boolean publish = bool(data.get("published"));
        require(
            !publish || List.of("shortlisted", "awarded", "collected").contains(status),
            409,
            "NOT_APPROVED",
            "只有批准后的稿件才能公开");
        d.put("published", publish);
      }
      default -> throw error(422, "UNKNOWN_COMMAND", "不支持的评审动作");
    }
    List<Object> history = new ArrayList<>(list(d.get("history")));
    history.add(
        m(
            "time",
            now(),
            "action",
            command,
            "actor",
            a.name,
            "note",
            data.getOrDefault("reason", data.getOrDefault("note", "")),
            "revision",
            d.get("revisionNumber")));
    d.put("history", history);
    store.save(e, e.region(), status, d);
    return ok();
  }

  private Object score(JfAuth.Actor a, String id, Object version, Map<String, Object> input) {
    var t = store.find("task", id, true);
    require(
        Objects.equals(t.owner(), a.id) && a.roles.contains("expert"),
        404,
        "NOT_FOUND",
        "任务不存在或未分配给当前专家");
    store.checkVersion(t, version);
    require(t.status().equals("待评分"), 409, "TASK_COMPLETED", "任务已完成或已失效");
    require(
        Instant.parse(str(t.data(), "dueAt")).isAfter(Instant.now()),
        409,
        "TASK_EXPIRED",
        "评分窗口已关闭，请联系运营重新分配");
    var e = store.find("submission", str(t.data(), "submissionId"), true);
    require(
        e.status().equals("in_review")
            && str(e.data(), "revisionId").equals(str(t.data(), "revisionId")),
        409,
        "TASK_INVALID",
        "任务对应的稿件版本已失效");
    List<Object> scores = list(input.get("scores"));
    require(scores.size() == 4, 422, "INVALID_SCORE", "请填写四个评分维度");
    int total = 0;
    for (int i = 0; i < 4; i++) {
      long score = number(scores.get(i));
      require(
          score >= 0 && score <= number(DIMENSIONS.get(i).get("max")),
          422,
          "INVALID_SCORE",
          "评分超出维度范围");
      total += score;
    }
    String comment = required(input, "comment", 5, 5000);
    int next =
        flow.complete(
            str(t.data(), "flowInstanceId"),
            str(t.data(), "flowTaskId"),
            a.id,
            number(t.data().get("managerId")),
            comment.substring(0, Math.min(450, comment.length())));
    var d = copy(t.data());
    d.putAll(m("scores", scores, "total", total, "comment", comment, "completedAt", now()));
    store.save(t, t.region(), "已完成", d);
    var work = copy(e.data());
    List<Object> reviews = new ArrayList<>(list(work.get("reviews")));
    reviews.add(
        m(
            "id",
            id,
            "stageIndex",
            number(work.get("progressIndex")),
            "createdAt",
            now(),
            "submissionRevision",
            work.get("revisionNumber"),
            "averageScore",
            total,
            "scores",
            scores,
            "comment",
            comment,
            "reviewer",
            a.name,
            "action",
            "score",
            "ruleVersion",
            "jiafeng-four-v1"));
    work.put("reviews", reviews);
    work.put("progressIndex", next);
    store.save(e, e.region(), e.status(), work);
    return ok();
  }

  private Instant parseDue(String value, long days) {
    if (value.isBlank()) return Instant.now().plus(Duration.ofDays(days));
    try {
      return Instant.parse(value);
    } catch (Exception ignored) {
      try {
        return LocalDateTime.parse(value.replace(' ', 'T'))
            .atZone(ZoneId.of("Asia/Shanghai"))
            .toInstant();
      } catch (Exception e) {
        throw error(422, "INVALID_DATE", "截止时间格式无效");
      }
    }
  }

  private Map<String, Object> ok() {
    return m("ok", true, "message", "操作已保存");
  }
}
