export interface ReviewRubric {
  ruleVersion: string
  title: string
  dimensions: { id: string; label: string; max: number; description?: string }[]
}
export interface ReviewTimeline {
  revisionNumber: number
  flowVersion: number | null
  source: string
  started: boolean
  notice: string
  stages: {
    id: string
    label: string
    enabled: boolean | null
    state: string
    completedAt: string
    rubric?: ReviewRubric
  }[]
  events: { nodeCode: string; stage: string; outcome: string; time: string }[]
}
export const reviewStateLabels: Record<string, [string, string]> = {
  completed: ['已办理', 'Completed'],
  current: ['当前节点', 'Current stage'],
  pending: ['待办理', 'Pending'],
  not_started: ['尚未启动', 'Not started'],
  disabled: ['本版本未启用', 'Disabled in this version'],
  stopped: ['流程已终止', 'Stopped'],
  unknown: ['历史记录不足', 'Historical evidence unavailable'],
  recorded: ['已有办理记录', 'Recorded'],
}

export function selectTimeline(
  timelines: ReviewTimeline[],
  revision: number,
  current?: ReviewTimeline,
) {
  return timelines.find((item) => item.revisionNumber === revision) ?? current
}
