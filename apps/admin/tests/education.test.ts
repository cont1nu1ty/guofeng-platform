import { describe, expect, it } from "vitest";
import {
  newCourse,
  newLesson,
  newQuestion,
  validateCourse,
} from "../src/domain/education";
describe("course editing", () => {
  it("keeps stable content ids while reorder and metadata change preserve answers", () => {
    const c = newCourse();
    c.title = "诚信家风课程";
    c.description = "这是完整课程简介，供学习和讨论使用。";
    c.lessons[0]!.title = "第一节";
    c.lessons[0]!.body = "正文";
    const q = newQuestion();
    q.prompt = "请选择";
    q.options.forEach((o, i) => (o.text = `选项${i}`));
    c.questions.push(q);
    c.examQuestionIds.push(q.id);
    const original = JSON.stringify(c.questions);
    const extra = newLesson();
    extra.title = "第二节";
    extra.body = "第二节正文";
    c.lessons.unshift(extra);
    c.title = "更新诚信家风课程";
    expect(validateCourse(c)).toBe("");
    expect(JSON.stringify(c.questions)).toBe(original);
  });
  it("rejects a removed bank question still referenced by the exam", () => {
    const c = newCourse();
    c.title = "诚信家风课程";
    c.description = "这是完整课程简介，供学习和讨论使用。";
    c.lessons[0]!.title = "第一节";
    c.lessons[0]!.body = "正文";
    c.examQuestionIds = ["removed"];
    expect(validateCourse(c)).toContain("组卷");
  });
});
