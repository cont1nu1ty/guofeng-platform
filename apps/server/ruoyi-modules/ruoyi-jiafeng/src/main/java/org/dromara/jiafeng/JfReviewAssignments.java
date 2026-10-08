package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;

import java.util.*;
import org.springframework.stereotype.Service;

/** Explicit preview/confirm allocation; the existing assignReview command owns all mutations. */
@Service
public class JfReviewAssignments {
  private final JfStore store;
  private final JfAuth auth;
  private final JfReview review;
  private final JfReviewFlow flow;
  private final JfReviewWindows windows;
  public JfReviewAssignments(JfStore store, JfAuth auth, JfReview review, JfReviewFlow flow, JfReviewWindows windows) {
    this.store = store; this.auth = auth; this.review = review; this.flow = flow; this.windows = windows;
  }
  private record Candidate(JfStore.Entity expert, JfAuth.Actor account) {}

  private List<Candidate> experts(JfAuth.Actor actor, String group, boolean lock) {
    var result = new ArrayList<Candidate>();
    var experts = store.select("expert", "status<>'deleted'").stream().sorted(Comparator.comparing(JfStore.Entity::id)).toList();
    for (var record : experts) {
      if (!actor.region(record.region())) continue;
      var expert = lock ? store.find("expert", record.id(), true) : record;
      if (!List.of("可接单", "可分配").contains(str(expert.data(), "availability"))) continue;
      if (!group.isBlank() && !group.equals(str(expert.data(), "group"))) continue;
      try {
        var account = auth.byId(expert.owner());
        if (account.roles.contains("expert")) result.add(new Candidate(expert, account));
      } catch (ApiException unavailable) {
        if (unavailable.status != 401) throw unavailable;
      }
    }
    return result;
  }

  private Map<String, Integer> loads() {
    var loads = new HashMap<String, Integer>();
    for (var row : store.db().queryForList("SELECT e.id,COUNT(w.task_id) open_count FROM jf_entity e LEFT JOIN jf_review_window w"
        + " ON w.owner_id=e.owner_id AND w.status='待评分' AND w.due_at_ms>? WHERE e.kind='expert' GROUP BY e.id", windows.now().toEpochMilli()))
      loads.put(text(row.get("id")), (int) number(row.get("open_count")));
    return loads;
  }

  public List<Object> candidates(JfAuth.Actor actor, String id) {
    var work = store.find("submission", id, false); auth.operate(actor, work.region());
    var loads = loads();
    return experts(actor, "", false).stream().filter(c -> eligible(c, work)).map(c -> (Object) m(
        "id", c.expert.id(), "name", str(c.expert.data(), "name"), "region", regionName(c.expert.region()),
        "group", str(c.expert.data(), "group"), "availability", "可分配", "openTasks", loads.getOrDefault(c.expert.id(), 0))).toList();
  }

  private boolean eligible(Candidate candidate, JfStore.Entity work) {
    return !Objects.equals(candidate.expert.owner(), work.owner()) && candidate.account.region(work.region());
  }

  public static String pick(List<String> candidates, Map<String, Integer> loads) {
    return candidates.stream().min(Comparator.comparingInt((String id) -> loads.getOrDefault(id, 0)).thenComparing(id -> id)).orElse("");
  }

  public Map<String, Object> preview(JfAuth.Actor actor, Map<String, Object> input, boolean lock) {
    var ids = list(input.get("ids")).stream().map(Jf::text).distinct().sorted().toList();
    require(!ids.isEmpty() && ids.size() <= 100, 422, "INVALID_BATCH", "请选择1至100篇稿件");
    String group = required(input, "group", 0, 50);
    var manuscripts = new ArrayList<JfStore.Entity>();
    for (String id : ids) {
      var work = store.find("submission", id, lock); auth.operate(actor, work.region());
      if (obj(input.get("versions")).containsKey(id)) store.checkVersion(work, obj(input.get("versions")).get(id));
      manuscripts.add(work);
    }
    var experts = experts(actor, group, lock);
    var initialLoads = loads(); var load = new HashMap<>(initialLoads);
    var rows = new ArrayList<Object>(); var excluded = new ArrayList<Object>();
    for (var work : manuscripts) {
      String reason = !work.status().equals("in_review") ? "稿件不在评审中"
          : !bool(work.data().get("blindConfirmed")) ? "尚未确认脱敏材料"
          : store.db().queryForObject("SELECT COUNT(*) FROM jf_review_window WHERE submission_id=? AND status='待评分' AND due_at_ms>?", Long.class, work.id(), windows.now().toEpochMilli()) > 0 ? "已有有效待评分任务"
          : str(work.data(), "flowInstanceId").isBlank() ? "缺少实际工作流实例"
          : flow.currentStage(str(work.data(), "flowInstanceId")) >= 6 ? "所有开启节点已办理" : "";
      var candidates = experts.stream().filter(c -> eligible(c, work)).toList();
      String chosen = pick(candidates.stream().map(c -> c.expert.id()).toList(), load);
      if (reason.isEmpty() && chosen.isEmpty()) reason = "没有符合地区、分组及接单条件的专家";
      if (!reason.isEmpty()) { excluded.add(m("submissionId", work.id(), "title", str(work.data(), "title"), "reason", reason)); continue; }
      var expert = candidates.stream().filter(c -> c.expert.id().equals(chosen)).findFirst().orElseThrow().expert;
      rows.add(m("submissionId", work.id(), "title", str(work.data(), "title"), "version", work.version(),
          "expertId", chosen, "expertName", str(expert.data(), "name"), "openTasks", load.getOrDefault(chosen, 0)));
      load.merge(chosen, 1, Integer::sum);
    }
    var signature = m("actor", actor.id, "group", group, "rows", rows, "excluded", excluded,
        "works", manuscripts.stream().map(e -> m("id", e.id(), "version", e.version())).toList(),
        "experts", experts.stream().map(c -> m("id", c.expert.id(), "version", c.expert.version(), "accountVersion", c.account.version,
            "regions", c.account.regions.stream().sorted().toList(), "roles", c.account.roles.stream().sorted().toList(),
            "load", initialLoads.getOrDefault(c.expert.id(), 0))).toList());
    return m("rows", rows, "excluded", excluded, "fingerprint", hash(json(signature)),
        "rule", "按授权地区、可接单状态及所选分组过滤；按有效待评分数升序、专家编号升序分配，逐篇计入拟分配数。");
  }

  public Object confirm(JfAuth.Actor actor, Map<String, Object> input) {
    var plan = preview(actor, input, true);
    require(!str(input, "fingerprint").isEmpty() && str(input, "fingerprint").equals(str(plan, "fingerprint")),
        409, "ASSIGNMENT_PREVIEW_STALE", "稿件、专家或工作量已变化，请重新预览后确认");
    require(!list(plan.get("rows")).isEmpty(), 422, "EMPTY_ASSIGNMENT", "没有可分配稿件");
    for (Object item : list(plan.get("rows"))) {
      var row = obj(item);
      review.command(actor, "assignReview", str(row, "submissionId"), row.get("version"), m("expertId", str(row, "expertId")));
    }
    store.audit(actor, "review.assignment.batch", "batch", actor.regions.stream().sorted().findFirst().orElse("all"),
        m("fingerprint", plan.get("fingerprint"), "count", list(plan.get("rows")).size()));
    return m("ok", true, "assigned", list(plan.get("rows")).size(), "excluded", plan.get("excluded"));
  }
}
