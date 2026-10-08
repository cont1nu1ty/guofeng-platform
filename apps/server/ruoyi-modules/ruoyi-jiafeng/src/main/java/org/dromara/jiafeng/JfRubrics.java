package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;

import java.util.*;
import org.springframework.stereotype.Service;

/** Immutable revision-level review policy. WarmFlow remains the execution authority. */
@Service
public class JfRubrics {
  private final JfStore store;
  public JfRubrics(JfStore store) { this.store = store; }

  public static Map<String, Object> legacy() {
    return m("ruleVersion", "jiafeng-four-v1", "title", "家风四维评分", "dimensions", DIMENSIONS);
  }

  public static Map<String, Object> normalize(Object input) {
    var value = obj(input);
    var dimensions = list(value.get("dimensions"));
    require(!dimensions.isEmpty() && dimensions.size() <= 10, 422, "INVALID_RUBRIC", "量表需包含1至10个维度");
    var result = new ArrayList<Object>();
    var ids = new HashSet<String>();
    long total = 0;
    for (Object raw : dimensions) {
      var d = obj(raw);
      String id = required(d, "id", 1, 40);
      require(id.matches("[a-zA-Z][a-zA-Z0-9_-]*") && ids.add(id), 422, "INVALID_RUBRIC", "维度标识须唯一且仅含英文、数字、横线或下划线");
      Object maxValue = d.get("max");
      require(maxValue instanceof Number && ((Number) maxValue).doubleValue() == number(maxValue)
          && number(maxValue) >= 1 && number(maxValue) <= 100, 422, "INVALID_RUBRIC", "维度分值须为1至100的整数");
      total += number(maxValue);
      result.add(m("id", id, "label", required(d, "label", 1, 80), "min", 0,
          "max", number(maxValue), "description", required(d, "description", 0, 1000)));
    }
    require(total == 100, 422, "INVALID_RUBRIC", "量表总分须为100分");
    String title = required(value, "title", 1, 100);
    // Preserve the historical identifier only for the exact historical dimensions.
    boolean original = result.size() == DIMENSIONS.size();
    for (int i = 0; original && i < result.size(); i++) {
      var actual = obj(result.get(i)); var old = DIMENSIONS.get(i);
      original = str(actual, "id").equals(str(old, "id")) && str(actual, "label").equals(str(old, "label"))
          && number(actual.get("max")) == number(old.get("max")) && str(actual, "description").isEmpty();
    }
    return m("ruleVersion", original ? "jiafeng-four-v1" : "jiafeng-rubric-" + hash(json(m("title", title, "dimensions", result))).substring(0, 24),
        "title", title, "dimensions", result);
  }

  public static List<Object> normalizeStages(Object value) {
    var inputs = list(value);
    require(inputs.size() == 6, 422, "INVALID_RUBRIC", "请为六个节点配置量表");
    return inputs.stream().map(JfRubrics::normalize).map(x -> (Object) x).toList();
  }

  public static Map<String, Object> snapshot(Map<String, Object> config) {
    var result = copy(config);
    if (list(result.get("rubrics")).isEmpty())
      result.put("rubrics", java.util.stream.IntStream.range(0, 6).mapToObj(i -> legacy()).toList());
    return result;
  }

  public static Map<String, Object> atStage(Map<String, Object> config, String nodeCode) {
    require(nodeCode.matches("stage[0-5]"), 409, "INVALID_REVIEW_NODE", "当前节点不可评分");
    var values = list(config.get("rubrics"));
    return values.isEmpty() ? legacy() : obj(values.get(Integer.parseInt(nodeCode.substring(5))));
  }

  public static int validateScores(List<Object> scores, List<Object> dimensions) {
    require(!dimensions.isEmpty() && scores.size() == dimensions.size(), 422, "INVALID_SCORE", "请完整填写当前任务量表");
    int total = 0;
    for (int i = 0; i < scores.size(); i++) {
      Object score = scores.get(i);
      require(score instanceof Number && Double.isFinite(((Number) score).doubleValue())
          && ((Number) score).doubleValue() == number(score)
          && number(score) >= 0 && number(score) <= number(obj(dimensions.get(i)).get("max")),
          422, "INVALID_SCORE", "评分须为当前维度范围内的整数");
      total += (int) number(score);
    }
    return total;
  }

  public Map<String, Object> bind(String revisionId, Map<String, Object> config, String source) {
    var snapshot = snapshot(config);
    store.db().update("INSERT IGNORE INTO jf_review_binding(revision_id,flow_version,snapshot,source) VALUES(?,?,?,?)",
        revisionId, number(snapshot.get("flowVersion")), json(snapshot), source);
    return bound(revisionId).orElseThrow();
  }

  public Optional<Map<String, Object>> bound(String revisionId) {
    var rows = store.db().queryForList("SELECT snapshot FROM jf_review_binding WHERE revision_id=?", revisionId);
    return rows.isEmpty() ? Optional.empty() : Optional.of(parse(text(rows.getFirst().get("snapshot"))));
  }

  public void attachInstance(String revisionId, String instance) {
    int changed = store.db().update("UPDATE jf_review_binding SET flow_instance_id=? WHERE revision_id=? AND flow_instance_id IS NULL", instance, revisionId);
    require(changed == 1, 409, "REVIEW_ALREADY_STARTED", "当前稿件版本已启动评审");
  }
}
