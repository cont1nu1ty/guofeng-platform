package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.util.*;
import org.dromara.common.core.utils.SpringUtils;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;
import tools.jackson.databind.json.JsonMapper;

class JfReviewVersionsTest {
  @BeforeAll static void mapper() {
    var beans = new DefaultListableBeanFactory();
    beans.registerSingleton("jsonMapper", JsonMapper.builder().build());
    new SpringUtils().postProcessBeanFactory(beans);
  }
  @Test void oldRubricRemainsExactAndCustomRulesAreVersionedByContent() {
    assertEquals("jiafeng-four-v1", JfRubrics.normalize(JfRubrics.legacy()).get("ruleVersion"));
    var custom = m("title", "文学表达", "dimensions", List.of(m("id", "writing", "label", "表达", "max", 100, "description", "依据正文")));
    var first = JfRubrics.normalize(custom);
    assertEquals(first, JfRubrics.normalize(custom));
    assertNotEquals("jiafeng-four-v1", first.get("ruleVersion"));
    obj(list(custom.get("dimensions")).getFirst()).put("description", "依据结构和正文");
    assertNotEquals(first.get("ruleVersion"), JfRubrics.normalize(custom).get("ruleVersion"));
  }
  @Test void rubricRejectsInvalidWeightsDuplicateIdsAndFractionalScores() {
    var invalid = m("title", "规则", "dimensions", List.of(m("id", "x", "label", "甲", "max", 60), m("id", "x", "label", "乙", "max", 40)));
    assertEquals("INVALID_RUBRIC", assertThrows(ApiException.class, () -> JfRubrics.normalize(invalid)).code);
    obj(list(invalid.get("dimensions")).getLast()).put("id", "y");
    obj(list(invalid.get("dimensions")).getLast()).put("max", 39);
    assertThrows(ApiException.class, () -> JfRubrics.normalize(invalid));
    var dims = List.<Object>of(m("id", "only", "max", 100));
    assertEquals(87, JfRubrics.validateScores(List.of(87), dims));
    for (var values : List.of(List.<Object>of(50.5), List.<Object>of("50"), List.<Object>of(101), List.<Object>of(-1), List.<Object>of(50, 50)))
      assertThrows(ApiException.class, () -> JfRubrics.validateScores(values, dims));
  }
  @Test void timelineUsesWorkflowFactsAndNeverPublishesApproverOrPrivateMessages() {
    var snapshot = JfRubrics.snapshot(m("flowVersion", 4, "enabled", List.of(true, true, false, true, true, true)));
    var history = List.of(m("node_code", "stage0", "skip_type", "PASS", "flow_status", "2", "update_time", "2026-10-07T00:00:00Z", "approver", "SECRET EXPERT", "message", "PRIVATE NOTE"));
    var result = JfReviewProgress.project(2, snapshot, "submission", List.of(m("node_code", "stage1")), history, true);
    var stages = list(result.get("stages"));
    assertEquals("completed", obj(stages.get(0)).get("state"));
    assertEquals("current", obj(stages.get(1)).get("state"));
    assertEquals("disabled", obj(stages.get(2)).get("state"));
    assertEquals("pending", obj(stages.get(3)).get("state"));
    assertFalse(json(result).contains("SECRET"));
    assertFalse(json(result).contains("PRIVATE NOTE"));
  }
  @Test void noHistoryNeverBecomesCompletionAndTerminationIsNotAPass() {
    var unknown = JfReviewProgress.project(1, m(), "unrecorded", List.of(), List.of(), false);
    assertNull(unknown.get("flowVersion"));
    assertTrue(list(unknown.get("stages")).stream().allMatch(s -> "unknown".equals(obj(s).get("state"))));
    var config = JfRubrics.snapshot(m("flowVersion", 1, "enabled", List.of(true, true, true, true, true, true)));
    var unlinked = JfReviewProgress.project(1, config, "legacy_snapshot_unlinked", List.of(), List.of(), false);
    assertTrue(list(unlinked.get("stages")).stream().allMatch(s -> "unknown".equals(obj(s).get("state"))));
    assertTrue(obj(list(unlinked.get("stages")).getFirst()).containsKey("rubric"));
    var stopped = JfReviewProgress.project(1, config, "legacy_snapshot", List.of(), List.of(m("node_code", "stage1", "skip_type", "PASS", "flow_status", "4")), true);
    assertEquals("stopped", obj(list(stopped.get("stages")).get(1)).get("state"));
  }
  @Test void allocationIsDeterministicAndBalancesEachPlannedTask() {
    var load = new HashMap<>(Map.of("expert-b", 1, "expert-a", 1, "expert-c", 2));
    assertEquals("expert-a", JfReviewAssignments.pick(List.of("expert-c", "expert-b", "expert-a"), load));
    load.merge("expert-a", 1, Integer::sum);
    assertEquals("expert-b", JfReviewAssignments.pick(List.of("expert-a", "expert-b", "expert-c"), load));
    assertEquals("", JfReviewAssignments.pick(List.of(), load));
  }
  @Test void offlineImportCannotForgeAuthorConsentOrCrossRecipientScope() {
    var service = new JfSubmissions(mock(JfStore.class), mock(JfAuth.class), mock(JfFiles.class), mock(JfRubrics.class), mock(JfReviewProgress.class));
    var owner = new JfAuth.Actor(m("user_id", 100L, "nick_name", "作者", "roles", List.of("member"), "region_ids", List.of("zhejiang"), "version", 1));
    var input = m("title", "线下归集家书", "content", "这是一封用于核对正文与来源的家书，需要账号本人明确确认才可进入评审。", "region", "zhejiang", "genre", "letter", "channel", "community", "themes", List.of(),
        "sourceRef", "A001", "sourceName", "社区归集", "copyrightAccepted", true, "agreementAcceptedAt", "forged");
    var clean = service.validateOffline(input, owner);
    assertEquals(false, clean.get("copyrightAccepted"));
    assertEquals(true, clean.get("requiresAuthorConfirmation"));
    assertFalse(clean.containsKey("agreementAcceptedAt"));
    input.put("region", "beijing");
    assertEquals("INVALID_REGION", assertThrows(ApiException.class, () -> service.validateOffline(input, owner)).code);
  }
}
