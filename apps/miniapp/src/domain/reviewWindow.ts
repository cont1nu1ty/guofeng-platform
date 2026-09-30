export type ReviewWindowStatus =
  | 'not_started'
  | 'active'
  | 'due_soon'
  | 'overdue'
  | 'completed'
  | 'cancelled'
export interface ReviewWindow {
  windowStatus?: ReviewWindowStatus
  canScore?: boolean
  status: string
}
export function beijingTime(value?: string): string {
  if (!value || !Number.isFinite(Date.parse(value))) return '未设置'
  return (
    new Date(Date.parse(value) + 8 * 3600000).toISOString().slice(0, 19).replace('T', ' ') +
    '（北京时间）'
  )
}
export function reviewWindowLabel(task: ReviewWindow): string {
  const names = {
    not_started: '未开始',
    active: '进行中',
    due_soon: '24 小时内截止',
    overdue: '已逾期',
    completed: '已完成',
    cancelled: '已取消',
  }
  return task.windowStatus
    ? names[task.windowStatus]
    : task.status === 'submitted'
      ? '已完成'
      : task.status === 'cancelled'
        ? '已取消'
        : '待评分'
}
export function canSubmitReview(task?: ReviewWindow | null): boolean {
  return (
    task?.status === 'pending' &&
    task.canScore === true &&
    (task.windowStatus === 'active' || task.windowStatus === 'due_soon')
  )
}
export function reviewDisabledReason(task: ReviewWindow): string {
  if (task.windowStatus === 'not_started') return '评审尚未开始，请在开始时间后刷新任务。'
  if (task.windowStatus === 'overdue')
    return '评审已截止，暂不可评分；如需延期，请联系分配任务的管理员。'
  if (task.status === 'cancelled' || task.windowStatus === 'cancelled')
    return '任务已取消，不能评分。'
  if (task.status === 'submitted' || task.windowStatus === 'completed')
    return '评分已提交并锁定，不能重复修改。'
  return '当前任务不可评分，请刷新任务确认最新状态。'
}
