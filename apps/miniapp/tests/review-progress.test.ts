import { describe, expect, it } from 'vitest'
import { selectTimeline, reviewStateLabels, type ReviewTimeline } from '../src/domain/reviewProgress'
describe('稿件修订进度', () => {
  it('切换历史版本不使用最新配置覆盖历史标准', () => {
    const old = { revisionNumber: 1, flowVersion: null, source: 'unrecorded', stages: [], events: [], started: false, notice: '' } satisfies ReviewTimeline
    const current = { ...old, revisionNumber: 2, flowVersion: 5, source: 'submission' }
    expect(selectTimeline([old, current], 1, current)).toBe(old)
    expect(selectTimeline([old, current], 2, current)).toBe(current)
    expect(reviewStateLabels.unknown![0]).toBe('历史记录不足')
    expect(reviewStateLabels.disabled![0]).not.toBe(reviewStateLabels.completed![0])
  })
})
