import { describe, expect, it } from 'vitest'
import { beijingTime, canSubmitReview, reviewDisabledReason } from '../src/domain/reviewWindow'
describe('专家评分时间窗口', () => {
  it('仅服务端明确允许且窗口进行中的待评分任务可提交', () => {
    expect(canSubmitReview({ status: 'pending', windowStatus: 'active', canScore: true })).toBe(
      true,
    )
    expect(canSubmitReview({ status: 'pending', windowStatus: 'due_soon', canScore: true })).toBe(
      true,
    )
    expect(canSubmitReview({ status: 'pending', windowStatus: 'active' })).toBe(false)
    expect(canSubmitReview({ status: 'pending', windowStatus: 'active', canScore: false })).toBe(
      false,
    )
    for (const windowStatus of ['not_started', 'overdue', 'completed', 'cancelled'] as const)
      expect(canSubmitReview({ status: 'pending', windowStatus, canScore: true })).toBe(false)
    expect(canSubmitReview({ status: 'submitted', windowStatus: 'active', canScore: true })).toBe(
      false,
    )
  })
  it('展示完整北京时间及实际不可评分原因', () => {
    expect(beijingTime('2026-09-30T16:30:25Z')).toBe('2026-10-01 00:30:25（北京时间）')
    expect(reviewDisabledReason({ status: 'pending', windowStatus: 'overdue' })).toContain(
      '联系分配任务的管理员',
    )
    expect(reviewDisabledReason({ status: 'cancelled' })).toContain('已取消')
  })
})
