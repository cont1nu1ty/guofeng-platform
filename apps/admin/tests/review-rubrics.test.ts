import { describe, expect, it } from "vitest";
import { editableRubrics, legacyRubric, validateRubrics } from "../src/domain/reviewRubrics";
describe("版本量表编辑", () => {
  it("六个节点及已发布量表互不共享编辑对象", () => {
    const saved = legacyRubric();
    const drafts = editableRubrics([saved]);
    drafts[0]!.dimensions[0]!.max = 50;
    expect(saved.dimensions[0]!.max).toBe(30);
    expect(drafts[1]!.dimensions[0]!.max).toBe(30);
  });
  it("要求总分100且标识唯一，允许不同节点不同维度数量", () => {
    const drafts = editableRubrics();
    drafts[2] = { title: "单维", dimensions: [{ id: "writing", label: "表达", max: 100 }] };
    expect(validateRubrics(drafts)).toBe("");
    drafts[2]!.dimensions[0]!.max = 99;
    expect(validateRubrics(drafts)).toContain("100");
    drafts[2]!.dimensions = [{ id: "x", label: "甲", max: 50 }, { id: "x", label: "乙", max: 50 }];
    expect(validateRubrics(drafts)).toContain("唯一");
  });
});
