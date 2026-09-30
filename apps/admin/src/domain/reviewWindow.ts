import type { ReviewTask } from "./review";

export type WindowStatus =
  | "not_started"
  | "active"
  | "due_soon"
  | "overdue"
  | "completed"
  | "cancelled";
export const windowLabels: Record<WindowStatus, string> = {
  not_started: "未开始",
  active: "进行中",
  due_soon: "24 小时内截止",
  overdue: "已逾期",
  completed: "已完成",
  cancelled: "已取消",
};
/** Form values always represent Beijing wall time, independent of the browser timezone. */
export function beijingInput(value?: string): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  return new Date(Date.parse(value) + 8 * 3600000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
}
export function beijingTime(value?: string): string {
  return beijingInput(value) ? `${beijingInput(value)}（北京时间）` : "未设置";
}
export function windowInstant(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return "";
  const parsed = Date.parse(`${value.replace(" ", "T")}+08:00`);
  if (!Number.isFinite(parsed)) return "";
  const iso = new Date(parsed).toISOString();
  return beijingInput(iso) === value ? iso : "";
}
export function windowError(startsAt: string, dueAt: string): string {
  if (!windowInstant(startsAt) || !windowInstant(dueAt))
    return "请选择完整有效的开始和截止时间。";
  if (Date.parse(windowInstant(dueAt)) <= Date.parse(windowInstant(startsAt)))
    return "截止时间必须晚于开始时间。";
  return "";
}
export function windowLabel(
  task: Pick<ReviewTask, "windowStatus" | "status">,
): string {
  return task.windowStatus ? windowLabels[task.windowStatus] : task.status;
}
export function scoreUnavailable(
  task: Pick<ReviewTask, "windowStatus" | "canScore" | "status">,
): string {
  if (task.windowStatus === "not_started")
    return "评审尚未开始，请在开始时间后刷新任务。";
  if (task.windowStatus === "overdue")
    return "评审已截止，暂不可评分；如需延期，请联系分配任务的管理员。";
  if (task.windowStatus === "cancelled" || task.status === "已取消")
    return "任务已取消，不能评分。";
  if (task.windowStatus === "completed" || task.status === "已完成")
    return "评分已提交并锁定。";
  return task.canScore === true
    ? ""
    : "当前账号不能评分，仅被分配的专家可在评审时间内提交。";
}

/** Legacy date-only fixtures describe a sample date, not an enforceable time window. */
export function hasMockTimeWindow(
  task: Pick<ReviewTask, "startsAt" | "dueAt">,
): boolean {
  return [task.startsAt, task.dueAt].every(
    (value) =>
      typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}T/.test(value) &&
      Number.isFinite(Date.parse(value)),
  );
}
export function projectMockReviewTask(
  task: ReviewTask,
  now = Date.now(),
): ReviewTask {
  if (!hasMockTimeWindow(task))
    return {
      ...task,
      windowStatus: undefined,
      canScore: task.status === "待评分",
    };
  const windowStatus: WindowStatus =
    task.status === "已完成"
      ? "completed"
      : task.status === "已取消"
        ? "cancelled"
        : now < Date.parse(task.startsAt!)
          ? "not_started"
          : now >= Date.parse(task.dueAt)
            ? "overdue"
            : Date.parse(task.dueAt) - now <= 86400000
              ? "due_soon"
              : "active";
  return {
    ...task,
    windowStatus,
    canScore: windowStatus === "active" || windowStatus === "due_soon",
  };
}
export function mockScoreUnavailable(task: ReviewTask): string {
  if (task.windowStatus === "not_started")
    return "本地模拟评审尚未开始，请在开始时间后评分。";
  if (task.windowStatus === "overdue")
    return "本地模拟评审已截止，不能提交；时间调整与自动预警仅在真实服务模式提供。";
  return scoreUnavailable(task);
}
