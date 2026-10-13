package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class JfEducationTest {
  @org.junit.jupiter.api.BeforeAll static void initializeJsonMapper() {
    var beans = new org.springframework.beans.factory.support.DefaultListableBeanFactory();
    beans.registerSingleton("jsonMapper", tools.jackson.databind.json.JsonMapper.builder().build());
    new org.dromara.common.core.utils.SpringUtils().postProcessBeanFactory(beans);
  }

  private Map<String, Object> course() {
    return m("title", "诚信家风课程", "description", "通过阅读家庭故事理解诚信与责任的课程。", "teacher", "教研组", "category", "清廉家风", "duration", 30,
        "lessons", List.of(m("id", "lesson_1", "title", "诚信", "body", "认真阅读并反思。", "practice", "共同讨论")),
        "questions", List.of(question("q1", "b"), question("q2", "a")), "examQuestionIds", List.of("q1", "q2"), "passPercent", 50);
  }
  private Map<String, Object> question(String id, String answer) {
    return m("id", id, "prompt", "哪种行为符合约定？", "options", List.of(m("id", "a", "text", "做出承诺"), m("id", "b", "text", "履行承诺")), "answerId", answer, "explanation", "内部解析不应下发");
  }
  @Test void MetadataOnlyEditsPreserveBankAndExam() {
    var previous = JfEducationContent.normalize(course(), m());
    var edited = JfEducationContent.normalize(m("title", "更新诚信家风课程"), previous);
    assertEquals(previous.get("questions"), edited.get("questions"));
    assertEquals(previous.get("examQuestionIds"), edited.get("examQuestionIds"));
    assertEquals(previous.get("lessons"), edited.get("lessons"));
  }
  @Test void LegacySingleQuestionSurvivesMetadataEditAndUsesStableIds() {
    var original = course(); original.remove("questions"); original.remove("examQuestionIds");
    original.put("quiz", m("question", "旧题目", "options", List.of("选项一", "选项二"), "answer", 1, "explanation", "旧解析"));
    var result = JfEducationContent.normalize(m("title", "修改后的课程名称"), original);
    assertEquals("option_1", obj(list(result.get("questions")).getFirst()).get("answerId"));
    assertEquals(List.of("legacy_quiz"), result.get("examQuestionIds"));
    assertEquals(result, JfEducationContent.normalize(result, m()));
  }
  @Test void LearnerReceivesOnlySelectedQuestionsWithoutAnswerKeys() {
    var draft = course(); draft.put("examQuestionIds", List.of("q2"));
    var learner = JfEducationContent.learner(draft);
    assertEquals(1, list(learner.get("questions")).size());
    assertEquals("q2", obj(list(learner.get("questions")).getFirst()).get("id"));
    assertFalse(json(learner).contains("answerId"));
    assertFalse(json(learner).contains("内部解析"));
    assertEquals(-1, obj(learner.get("quiz")).get("answer"));
    assertEquals(2, list(draft.get("questions")).size());
  }
  @Test void ServerGradesFrozenQuestionIdsAndThresholdWithoutTrustingClientResult() {
    var frozen = JfEducationContent.normalize(course(), m());
    assertTrue(bool(JfEducationContent.grade(frozen, m("q1", "b", "q2", "b")).get("passed")));
    assertFalse(bool(JfEducationContent.grade(frozen, m("q1", "a", "q2", "b")).get("passed")));
    assertThrows(ApiException.class, () -> JfEducationContent.grade(frozen, m("q1", "b")));
    assertThrows(ApiException.class, () -> JfEducationContent.grade(frozen, m("q1", "unknown", "q2", "a")));
    assertThrows(ApiException.class, () -> JfEducationContent.grade(frozen, m("q1", "b", "q2", "a", "passed", true)));
  }
  @Test void DuplicateOrDanglingExamIdsAndInvalidAnswerKeysAreRejected() {
    var d = course(); d.put("examQuestionIds", List.of("q1", "q1"));
    assertThrows(ApiException.class, () -> JfEducationContent.normalize(d, m()));
    d.put("examQuestionIds", List.of("missing"));
    assertThrows(ApiException.class, () -> JfEducationContent.normalize(d, m()));
    d.put("examQuestionIds", List.of("q1")); d.put("questions", List.of(question("q1", "missing")));
    assertThrows(ApiException.class, () -> JfEducationContent.normalize(d, m()));
  }
  @Test void EmptyExamUsesReadingOnlyAndDoesNotExposeBank() {
    var d = course(); d.put("examQuestionIds", List.of());
    assertTrue(list(JfEducationContent.learner(d).get("questions")).isEmpty());
    assertThrows(ApiException.class, () -> JfEducationContent.grade(JfEducationContent.normalize(d, m()), m()));
    var progress = JfEducation.progressDto(m(), d);
    assertEquals(0, progress.get("percent")); assertFalse(bool(progress.get("complete")));
  }
  @Test void OutOfRegionAndReadOnlyCannotMutateCourse() {
    var store = mock(JfStore.class); var auth = mock(JfAuth.class); var service = new JfEducation(store, auth);
    var member = new JfAuth.Actor(m("user_id", 1, "version", 1, "roles", List.of(), "region_ids", List.of("zhejiang")));
    assertThrows(ApiException.class, () -> service.adminCommand(member, "saveCourse", "", null, course()));
    verifyNoInteractions(store);
    var operator = new JfAuth.Actor(m("user_id", 2, "version", 1, "roles", List.of("regional_admin"), "permissions", List.of("education:write"), "region_ids", List.of("zhejiang")));
    when(store.find("course", "foreign", true)).thenReturn(new JfStore.Entity("foreign", "course", 3L, "beijing", "草稿", course(), 1, "", ""));
    assertThrows(ApiException.class, () -> service.adminCommand(operator, "saveCourse", "foreign", 1, course()));
    verify(store, never()).save(any(), anyString(), anyString(), anyMap());
  }
  @Test void EditingPublishedCourseOnlyChangesDraftNotLiveSnapshot() {
    var store = mock(JfStore.class); var auth = mock(JfAuth.class); var service = new JfEducation(store, auth);
    var a = new JfAuth.Actor(m("user_id", 2, "version", 1, "roles", List.of("national_admin"), "permissions", List.of("education:write"), "region_ids", List.of("all")));
    var live = course(); live.put("publishedVersion", 1);
    var entity = new JfStore.Entity("course_1", "course", 2L, "all", "已上架", live, 3, "", "");
    when(store.find("course", "course_1", true)).thenReturn(entity);
    when(store.save(eq(entity), eq("all"), eq("已上架"), anyMap())).thenAnswer(call -> new JfStore.Entity("course_1", "course", 2L, "all", "已上架", call.getArgument(3), 4, "", ""));
    service.adminCommand(a, "saveCourse", "course_1", 3, m("title", "尚未发布的新课程"));
    verify(store).save(eq(entity), eq("all"), eq("已上架"), argThat(data -> str(data, "title").equals("诚信家风课程") && str(obj(data.get("draft")), "title").equals("尚未发布的新课程")));
  }
  @Test void NonMemberCannotConfirmGroupDeclaration() {
    var store = mock(JfStore.class); var auth = mock(JfAuth.class); var db = mock(JdbcTemplate.class); when(store.db()).thenReturn(db);
    var service = new JfEducation(store, auth);
    var a = new JfAuth.Actor(m("user_id", 1, "version", 1, "roles", List.of(), "region_ids", List.of("zhejiang")));
    when(db.queryForList(anyString(), eq("g"))).thenReturn(List.of(m("id", "g", "version", 1, "declaration_text", "承诺内容")));
    when(db.queryForObject(anyString(), eq(Long.class), eq("g"), eq(1L))).thenReturn(0L);
    var failure = assertThrows(ApiException.class, () -> service.memberCommand(a, "education.confirmDeclaration", "g", 1, m("accepted", true, "textHash", hash("承诺内容"))));
    assertEquals("NOT_FOUND", failure.code);
    verify(db, never()).update(anyString(), any(Object[].class));
  }
}
