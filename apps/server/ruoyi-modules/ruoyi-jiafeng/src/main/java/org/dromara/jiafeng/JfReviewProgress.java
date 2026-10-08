package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;

import java.util.*;
import org.springframework.stereotype.Service;

/** Author-safe projection of immutable policy and actual WarmFlow execution evidence. */
@Service
public class JfReviewProgress {
  private final JfStore store;
  public JfReviewProgress(JfStore store) { this.store = store; }

  public Map<String, Object> current(JfStore.Entity work) {
    return timeline(work, str(work.data(), "revisionId"), number(work.data().get("revisionNumber")), work.data());
  }

  public List<Object> revisions(JfStore.Entity work) {
    return store.db().queryForList("SELECT id,revision_number,payload FROM jf_revision WHERE submission_id=? ORDER BY revision_number", work.id())
        .stream().map(row -> (Object) timeline(work, text(row.get("id")), number(row.get("revision_number")), parse(text(row.get("payload")))))
        .toList();
  }

  private Map<String, Object> timeline(JfStore.Entity work, String revisionId, long revision, Map<String, Object> payload) {
    var bindings = store.db().queryForList("SELECT snapshot,flow_instance_id,source FROM jf_review_binding WHERE revision_id=?", revisionId);
    boolean current = revisionId.equals(str(work.data(), "revisionId"));
    Map<String, Object> snapshot = bindings.isEmpty() ? obj(payload.get("flowSnapshot")) : parse(text(bindings.getFirst().get("snapshot")));
    if (snapshot.isEmpty() && current) snapshot = obj(work.data().get("flowSnapshot"));
    String instance = bindings.isEmpty() ? "" : text(bindings.getFirst().get("flow_instance_id"));
    if (instance.isEmpty() && current) instance = str(work.data(), "flowInstanceId");
    List<Map<String, Object>> active = instance.isEmpty() ? List.of() : store.db().queryForList(
        "SELECT node_code,node_name FROM flow_task WHERE instance_id=? AND del_flag='0'", instance);
    List<Map<String, Object>> history = instance.isEmpty() ? List.of() : store.db().queryForList(
        "SELECT node_code,skip_type,flow_status,create_time,update_time FROM flow_his_task WHERE instance_id=? AND del_flag='0' ORDER BY update_time,id", instance);
    String source = bindings.isEmpty() ? (snapshot.isEmpty() ? "unrecorded" : "legacy_snapshot") : text(bindings.getFirst().get("source"));
    if (bindings.isEmpty() && !current && !snapshot.isEmpty() && instance.isEmpty()) source = "legacy_snapshot_unlinked";
    return project(revision, snapshot, source, active, history, !instance.isEmpty());
  }

  public static Map<String, Object> project(long revision, Map<String, Object> snapshot, String source,
      List<Map<String, Object>> active, List<Map<String, Object>> history, boolean started) {
    boolean known = !snapshot.isEmpty();
    var enabled = list(snapshot.get("enabled"));
    var stages = new ArrayList<Object>();
    var events = new ArrayList<Object>();
    boolean stopped = history.stream().anyMatch(h -> Set.of("4", "5", "6", "9", "10").contains(text(h.get("flow_status"))));
    for (int i = 0; i < 6; i++) {
      String code = "stage" + i;
      boolean isEnabled = enabled.size() > i && bool(enabled.get(i));
      var completed = history.stream().filter(h -> code.equals(text(h.get("node_code"))) && "PASS".equals(text(h.get("skip_type")))
          && !Set.of("4", "5", "6", "9", "10").contains(text(h.get("flow_status")))).toList();
      boolean current = active.stream().anyMatch(h -> code.equals(text(h.get("node_code"))));
      String state = !completed.isEmpty() ? "completed" : current ? "current" : !known ? "unknown"
          : !isEnabled ? "disabled" : source.equals("legacy_snapshot_unlinked") ? "unknown" : stopped ? "stopped" : started ? "pending" : "not_started";
      var stage = m("id", code, "label", STAGES.get(i), "enabled", known ? isEnabled : null,
          "state", state, "completedAt", completed.isEmpty() ? "" : timestamp(completed.getLast().get("update_time")));
      if (known) stage.put("rubric", JfRubrics.atStage(snapshot, code));
      stages.add(stage);
    }
    for (var event : history) {
      String code = text(event.get("node_code"));
      if (!code.matches("stage[0-5]")) continue;
      events.add(m("nodeCode", code, "stage", STAGES.get(Integer.parseInt(code.substring(5))),
          "outcome", Set.of("4", "5", "6", "9", "10").contains(text(event.get("flow_status"))) ? "stopped" : "PASS".equals(text(event.get("skip_type"))) ? "completed" : "recorded",
          "time", timestamp(event.get("update_time"))));
    }
    return m("revisionNumber", revision, "flowVersion", known ? snapshot.get("flowVersion") : null,
        "source", source, "started", started, "stages", stages, "events", events,
        "notice", source.equals("legacy_snapshot_unlinked") ? "本历史版本保存了流程标准，但没有可关联的办理实例；不推断是否启动或完成。"
            : known ? "流程和量表取自本版本记录；完成状态以工作流办理记录为准。" : "本历史版本未保存流程配置，未推断六级节点或量表。");
  }

  public Map<String, Object> revisionContent(Map<String, Object> payload) {
    var safe = new LinkedHashMap<String, Object>();
    for (String key : List.of("title", "author", "content", "genre", "channel", "themes", "attachments", "revisionNumber", "submittedAt", "agreementVersion", "agreementAcceptedAt", "copyrightAccepted", "source"))
      if (payload.containsKey(key)) safe.put(key, payload.get(key));
    return safe;
  }
}
