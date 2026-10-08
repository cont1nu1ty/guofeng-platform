package org.dromara.jiafeng;

import static org.dromara.jiafeng.Jf.*;
import java.util.*;

/** Course drafts and frozen exams share validation; learner projections never expose answer keys. */
final class JfEducationContent {
  private JfEducationContent() {}

  static String stableId(Map<String, Object> value, String fallback) {
    String id = str(value, "id");
    if (id.isEmpty()) id = fallback;
    require(id.matches("[A-Za-z0-9_-]{1,64}"), 422, "INVALID_CONTENT_ID", "章节或题目编号无效");
    return id;
  }

  static String plain(Object value) {
    if (value instanceof Map<?, ?>) return str(obj(value), "zh");
    return text(value);
  }

  static Map<String, Object> normalize(Map<String, Object> input, Map<String, Object> previous) {
    var d = copy(previous);
    d.putAll(input);
    d.remove("draft");
    var result = m("title", required(d, "title", 4, 100), "category", required(d, "category", 1, 100),
        "description", required(d, "description", 10, 10000), "teacher", required(d, "teacher", 1, 100));
    long duration = number(d.getOrDefault("duration", 30));
    long passPercent = number(d.getOrDefault("passPercent", 100));
    require(duration >= 1 && duration <= 300 && passPercent >= 1 && passPercent <= 100,
        422, "INVALID_COURSE", "参考时长须为1–300分钟，及格线须为1–100");
    result.put("duration", duration);
    result.put("passPercent", passPercent);
    var lessons = new ArrayList<Object>();
    var ids = new HashSet<String>();
    List<Object> sourceLessons = list(d.get("lessons"));
    if (sourceLessons.isEmpty() && !input.containsKey("lessons"))
      sourceLessons = List.of(m("id", "intro", "title", "课程导读", "body", d.get("description"), "practice", "阅读后记录你的理解。"));
    require(!sourceLessons.isEmpty() && sourceLessons.size() <= 50, 422, "INVALID_LESSONS", "请编排1–50节课程");
    for (var value : sourceLessons) {
      var lesson = obj(value);
      String id = stableId(lesson, "lesson_" + lessons.size());
      require(ids.add(id), 422, "DUPLICATE_LESSON", "章节编号重复");
      var clean = m("id", id, "title", required(lesson, "title", 1, 150),
          "body", required(lesson, "body", 1, 30000), "practice", str(lesson, "practice"));
      require(str(clean, "practice").length() <= 10000, 422, "INVALID_LESSON", "练习说明过长");
      lessons.add(clean);
    }
    result.put("lessons", lessons);
    result.put("chapters", lessons.size());
    List<Object> sourceQuestions = list(d.get("questions"));
    // Preserve legacy quiz when an old client edits only course metadata.
    if (!d.containsKey("questions") && !obj(d.get("quiz")).isEmpty()) {
      var quiz = obj(d.get("quiz"));
      var options = new ArrayList<Object>();
      int index = 0;
      for (var option : list(quiz.get("options"))) options.add(m("id", "option_" + index++, "text", plain(option)));
      sourceQuestions = List.of(m("id", "legacy_quiz", "prompt", plain(quiz.get("question")),
          "options", options, "answerId", "option_" + number(quiz.get("answer")),
          "explanation", plain(quiz.get("explanation"))));
    }
    require(sourceQuestions.size() <= 200, 422, "INVALID_QUESTIONS", "每门课程题库最多200题");
    var questions = new ArrayList<Object>();
    var questionIds = new LinkedHashSet<String>();
    for (var value : sourceQuestions) {
      var q = obj(value);
      String id = stableId(q, "question_" + questions.size());
      require(questionIds.add(id), 422, "DUPLICATE_QUESTION", "题目编号重复");
      var options = new ArrayList<Object>();
      var optionIds = new HashSet<String>();
      require(list(q.get("options")).size() >= 2 && list(q.get("options")).size() <= 6,
          422, "INVALID_OPTIONS", "每道单选题需2–6个选项");
      for (var raw : list(q.get("options"))) {
        var option = obj(raw);
        String oid = stableId(option, "option_" + options.size());
        require(optionIds.add(oid), 422, "DUPLICATE_OPTION", "选项编号重复");
        options.add(m("id", oid, "text", required(option, "text", 1, 2000)));
      }
      String answer = str(q, "answerId");
      require(optionIds.contains(answer), 422, "INVALID_ANSWER", "请选择题目的正确选项");
      questions.add(m("id", id, "prompt", required(q, "prompt", 1, 3000), "options", options,
          "answerId", answer, "explanation", required(q, "explanation", 0, 5000)));
    }
    List<Object> exam = d.containsKey("examQuestionIds") ? list(d.get("examQuestionIds")) : new ArrayList<>(questionIds);
    var chosen = new LinkedHashSet<String>();
    for (Object raw : exam) {
      String id = text(raw);
      require(questionIds.contains(id) && chosen.add(id), 422, "INVALID_EXAM", "组卷含未知或重复题目");
    }
    require(chosen.size() <= 100, 422, "INVALID_EXAM", "一次测验最多100题");
    result.put("questions", questions);
    result.put("examQuestionIds", new ArrayList<>(chosen));
    return result;
  }

  static Map<String, Object> learner(Map<String, Object> raw) {
    var clean = normalize(raw, m());
    Set<String> exam = new HashSet<>();
    list(clean.get("examQuestionIds")).forEach(id -> exam.add(text(id)));
    var questions = new ArrayList<Object>();
    for (var value : list(clean.get("questions"))) {
      var q = obj(value);
      if (exam.contains(str(q, "id"))) questions.add(m("id", q.get("id"), "prompt", q.get("prompt"), "options", q.get("options")));
    }
    clean.put("questions", questions);
    // Old clients expect a single quiz; -1 cannot reveal the server-held correct answer.
    var first = questions.isEmpty() ? m() : obj(questions.getFirst());
    clean.put("quiz", questions.isEmpty() ? m() : m("question", first.get("prompt"), "options",
        list(first.get("options")).stream().map(o -> obj(o).get("text")).toList(), "answer", -1, "explanation", ""));
    return clean;
  }

  static Map<String, Object> grade(Map<String, Object> course, Map<String, Object> answers) {
    List<Object> ids = list(course.get("examQuestionIds"));
    require(!ids.isEmpty(), 409, "QUIZ_NOT_PUBLISHED", "本版本没有测验");
    require(answers.size() == ids.size(), 422, "INCOMPLETE_ANSWERS", "请回答所有组卷题目");
    int correct = 0;
    for (var value : ids) {
      String id = text(value);
      var q = list(course.get("questions")).stream().map(Jf::obj).filter(v -> str(v, "id").equals(id)).findFirst().orElseThrow();
      String chosen = str(answers, id);
      require(list(q.get("options")).stream().anyMatch(o -> str(obj(o), "id").equals(chosen)),
          422, "INVALID_ANSWER", "答案包含未知选项");
      if (chosen.equals(str(q, "answerId"))) correct++;
    }
    int score = correct * 100 / ids.size();
    return m("score", score, "passed", correct * 100 >= number(course.get("passPercent")) * ids.size());
  }
}
