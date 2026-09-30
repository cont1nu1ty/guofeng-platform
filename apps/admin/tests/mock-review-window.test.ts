import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  approveSubmission,
  assignReview,
  reviewState,
  reviewFlow,
  submitReview,
} from "../src/domain/review";
import {
  hasMockTimeWindow,
  projectMockReviewTask,
} from "../src/domain/reviewWindow";
const initialState = JSON.parse(JSON.stringify(reviewState));
const initialFlow = JSON.parse(JSON.stringify(reviewFlow));
const start = "2026-09-30T10:00:00.000Z";
const due = "2026-10-01T10:00:00.000Z";
const scores = [28, 27, 22, 13];
const comment = "家庭记忆生动，主题鲜明，可进一步完善细节。";
beforeEach(() => {
  Object.assign(reviewState, JSON.parse(JSON.stringify(initialState)));
  Object.assign(reviewFlow, JSON.parse(JSON.stringify(initialFlow)));
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-30T00:00:00.000Z"));
});
afterEach(() => vi.useRealTimers());
function newTask() {
  const work = reviewState.submissions[0]!;
  expect(approveSubmission(work.id).ok).toBe(true);
  expect(assignReview(work.id, "EXP-001", due, start).ok).toBe(true);
  return reviewState.tasks.find((task) => task.submissionId === work.id)!;
}
describe("完整ISO窗口的本地模拟评分", () => {
  it("开始前一毫秒禁止评分，拒绝后仍保留待评分状态", () => {
    const task = newTask();
    vi.setSystemTime(new Date(Date.parse(start) - 1));
    expect(projectMockReviewTask(task)).toMatchObject({
      windowStatus: "not_started",
      canScore: false,
    });
    expect(submitReview(task.id, scores, comment)).toMatchObject({
      ok: false,
      message: expect.stringContaining("尚未开始"),
    });
    expect(task.status).toBe("待评分");
    expect(task.scores).toBeUndefined();
  });
  it("开始瞬间可以评分", () => {
    const task = newTask();
    vi.setSystemTime(new Date(start));
    expect(projectMockReviewTask(task)).toMatchObject({
      windowStatus: "due_soon",
      canScore: true,
    });
    expect(submitReview(task.id, scores, comment).ok).toBe(true);
    expect(projectMockReviewTask(task)).toMatchObject({
      windowStatus: "completed",
      canScore: false,
    });
  });
  it("截止前一毫秒可以评分", () => {
    const task = newTask();
    vi.setSystemTime(new Date(Date.parse(due) - 1));
    expect(projectMockReviewTask(task).canScore).toBe(true);
    expect(submitReview(task.id, scores, comment).ok).toBe(true);
  });
  it.each([0, 1, 60000])(
    "截止后偏移 %i 毫秒时禁止评分，旧投影不能绕过提交校验",
    (offset) => {
      const task = newTask();
      vi.setSystemTime(new Date(start));
      expect(projectMockReviewTask(task).canScore).toBe(true);
      vi.setSystemTime(new Date(Date.parse(due) + offset));
      expect(projectMockReviewTask(task)).toMatchObject({
        windowStatus: "overdue",
        canScore: false,
      });
      expect(submitReview(task.id, scores, comment)).toMatchObject({
        ok: false,
        message: expect.stringContaining("已截止"),
      });
      expect(task.status).toBe("待评分");
      expect(task.comment).toBeUndefined();
    },
  );
  it("历史仅日期样例保留原模拟评分，不冒充完整时间窗口", () => {
    const task = reviewState.tasks[0]!;
    expect(hasMockTimeWindow(task)).toBe(false);
    expect(projectMockReviewTask(task)).toMatchObject({
      windowStatus: undefined,
      canScore: true,
    });
    expect(submitReview(task.id, scores, comment).ok).toBe(true);
  });
  it("缺省截止使用稿件快照；后续配置变化不重算已分配任务", () => {
    const work = reviewState.submissions[0]!;
    approveSubmission(work.id);
    work.flowSnapshot = { deadlineDays: 3 };
    reviewFlow.deadlineDays = 9;
    expect(assignReview(work.id, "EXP-001", "", start).ok).toBe(true);
    const task = reviewState.tasks.find(
      (item) => item.submissionId === work.id,
    )!;
    expect(Date.parse(task.dueAt) - Date.parse(start)).toBe(3 * 86400000);
    const frozenDue = task.dueAt;
    reviewFlow.deadlineDays = 14;
    expect(task.dueAt).toBe(frozenDue);
  });
});
