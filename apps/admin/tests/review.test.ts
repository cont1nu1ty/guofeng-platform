import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  approveSubmission,
  assignReview,
  batchApproveSubmissions,
  configureReviewFlow,
  returnSubmission,
  reviewFlow,
  reviewState,
  submitReview,
  updateExpert,
} from "../src/domain/review";

const seed = JSON.parse(JSON.stringify(reviewState));
const flowSeed = JSON.parse(JSON.stringify(reviewFlow));
beforeEach(() => {
  Object.assign(reviewState, JSON.parse(JSON.stringify(seed)));
  Object.assign(reviewFlow, JSON.parse(JSON.stringify(flowSeed)));
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-21T10:00:00"));
});
afterEach(() => vi.useRealTimers());

describe("稿件初审与分配", () => {
  it("仅初审状态可通过，重复处理不追加记录", () => {
    const manuscript = reviewState.submissions[0]!;
    expect(approveSubmission(manuscript.id).ok).toBe(true);
    expect(manuscript.status).toBe("评审中");
    const historyCount = manuscript.history.length;
    expect(approveSubmission(manuscript.id).ok).toBe(false);
    expect(manuscript.history.length).toBe(historyCount);
  });
  it("混合状态批量操作整体阻止，不部分修改", () => {
    expect(
      batchApproveSubmissions([
        reviewState.submissions[0]!.id,
        reviewState.submissions[2]!.id,
      ]).ok,
    ).toBe(false);
    expect(reviewState.submissions[0]!.status).toBe("待初审");
    expect(batchApproveSubmissions([]).ok).toBe(false);
  });
  it("退回理由不能为空或过短，成功后保留具体意见", () => {
    const manuscript = reviewState.submissions[0]!;
    expect(returnSubmission(manuscript.id, "  ").ok).toBe(false);
    expect(returnSubmission(manuscript.id, "请补齐").ok).toBe(false);
    expect(manuscript.status).toBe("待初审");
    expect(returnSubmission(manuscript.id, " 请补充家训引用出处。 ").ok).toBe(
      true,
    );
    expect(manuscript.status).toBe("退回修改");
    expect(manuscript.history.at(-1)?.detail).toBe("请补充家训引用出处。");
  });
  it("限制可分配稿件、接单专家与有效截止日期", () => {
    const manuscript = reviewState.submissions[0]!;
    expect(assignReview(manuscript.id, "EXP-001", "2026-09-25").ok).toBe(false);
    approveSubmission(manuscript.id);
    expect(assignReview(manuscript.id, "EXP-004", "2026-09-25").ok).toBe(false);
    expect(assignReview(manuscript.id, "EXP-001", "2026-09-20").ok).toBe(false);
    expect(assignReview(manuscript.id, "EXP-001", "2027-02-31").ok).toBe(false);
    expect(assignReview(manuscript.id, "EXP-001", "2026-09-25").ok).toBe(true);
    expect(assignReview(manuscript.id, "EXP-001", "2026-09-25").ok).toBe(false);
    expect(
      reviewState.tasks.filter((task) => task.submissionId === manuscript.id),
    ).toHaveLength(1);
  });
});

describe("评分与方案", () => {
  it("评分维度、分值、评语验证失败不完成任务", () => {
    const task = reviewState.tasks[0]!;
    expect(
      submitReview(
        task.id,
        [31, 20, 20, 10],
        "叙事完整，建议补充具体的生活细节。",
      ).ok,
    ).toBe(false);
    expect(
      submitReview(
        task.id,
        [NaN, 20, 20, 10],
        "叙事完整，建议补充具体的生活细节。",
      ).ok,
    ).toBe(false);
    expect(
      submitReview(task.id, [20, 20, 20], "叙事完整，建议补充具体的生活细节。")
        .ok,
    ).toBe(false);
    expect(submitReview(task.id, [20, 20, 20, 10], "好").ok).toBe(false);
    expect(task.status).toBe("待评分");
  });
  it("完成评分防重复，不自动变为入围或公示", () => {
    const task = reviewState.tasks[0]!;
    expect(
      submitReview(
        task.id,
        [28, 27, 22, 13],
        "家庭记忆生动，主题鲜明，可进一步完善细节。",
      ).ok,
    ).toBe(true);
    expect(task.status).toBe("已完成");
    expect(
      reviewState.submissions.find((item) => item.id === task.submissionId)
        ?.status,
    ).toBe("评审中");
    expect(
      submitReview(
        task.id,
        [30, 30, 25, 15],
        "重复修改一份已经完成的评审任务。",
      ).ok,
    ).toBe(false);
    expect(task.scores).toEqual([28, 27, 22, 13]);
  });
  it("调整流程配置不迁移既有任务，拒绝全关和非法时限", () => {
    const tasksBefore = JSON.stringify(reviewState.tasks);
    expect(
      configureReviewFlow({
        blind: true,
        deadlineDays: 7,
        enabled: Array(6).fill(false),
      }).ok,
    ).toBe(false);
    expect(
      configureReviewFlow({
        blind: true,
        deadlineDays: 0,
        enabled: Array(6).fill(true),
      }).ok,
    ).toBe(false);
    expect(
      configureReviewFlow({
        blind: false,
        deadlineDays: 14,
        enabled: [true, false, true, false, false, true],
      }).ok,
    ).toBe(true);
    expect(reviewFlow.blind).toBe(false);
    expect(JSON.stringify(reviewState.tasks)).toBe(tasksBefore);
  });
  it("暂停专家接单保留既有任务", () => {
    const tasksBefore = JSON.stringify(reviewState.tasks);
    expect(updateExpert("EXP-003", "文史研究组", "暂不接单").ok).toBe(true);
    expect(
      reviewState.experts.find((expert) => expert.id === "EXP-003")
        ?.availability,
    ).toBe("暂不接单");
    expect(JSON.stringify(reviewState.tasks)).toBe(tasksBefore);
  });
});
