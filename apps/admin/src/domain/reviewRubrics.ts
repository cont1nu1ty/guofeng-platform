export interface ReviewDimension {
  id: string;
  label: string;
  max: number;
  description?: string;
}
export interface ReviewRubric {
  ruleVersion?: string;
  title: string;
  dimensions: ReviewDimension[];
}
export function legacyRubric(): ReviewRubric {
  return {
    ruleVersion: "jiafeng-four-v1",
    title: "家风四维评分",
    dimensions: [
      { id: "value", label: "思想与价值", max: 30, description: "" },
      { id: "expression", label: "内容与表达", max: 30, description: "" },
      { id: "culture", label: "文化与传承", max: 25, description: "" },
      { id: "originality", label: "原创与特色", max: 15, description: "" },
    ],
  };
}
export function editableRubrics(values?: ReviewRubric[]): ReviewRubric[] {
  return Array.from({ length: 6 }, (_, index) =>
    structuredClone(
      values?.[index]
        ? JSON.parse(JSON.stringify(values[index]))
        : legacyRubric(),
    ),
  );
}
export function validateRubrics(values: ReviewRubric[]): string {
  if (values.length !== 6) return "请为六个节点配置量表。";
  for (const [index, rubric] of values.entries()) {
    const prefix = `第 ${index + 1} 个节点：`;
    if (!rubric.title.trim() || rubric.title.length > 100)
      return prefix + "量表名称为 1–100 字。";
    if (!rubric.dimensions.length || rubric.dimensions.length > 10)
      return prefix + "量表包含 1–10 个维度。";
    const ids = new Set<string>();
    for (const dimension of rubric.dimensions) {
      if (
        !/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/.test(dimension.id) ||
        ids.has(dimension.id)
      )
        return prefix + "维度标识须为唯一英文标识。";
      ids.add(dimension.id);
      if (!dimension.label.trim() || dimension.label.length > 80)
        return prefix + "请填写 1–80 字维度名称。";
      if (
        !Number.isInteger(dimension.max) ||
        dimension.max < 1 ||
        dimension.max > 100
      )
        return prefix + "分值须为 1–100 的整数。";
    }
    if (
      rubric.dimensions.reduce((sum, dimension) => sum + dimension.max, 0) !==
      100
    )
      return prefix + "各维度合计须为 100 分。";
  }
  return "";
}
