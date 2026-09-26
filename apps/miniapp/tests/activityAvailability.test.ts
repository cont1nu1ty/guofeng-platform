import { describe, expect, it } from 'vitest'
import { activityAvailability } from '../src/domain/activityAvailability'
import type { Activity } from '../src/domain/types'

const activity = (status: Activity['status'], count = 1): Activity => ({
  id: 'event',
  title: '模拟家风共读',
  excerpt: '',
  content: '',
  region: 'beijing',
  location: '',
  organizer: '',
  date: '',
  time: '',
  category: '',
  capacity: 2,
  registeredCount: count,
  isDemo: false,
  status,
})
describe('HTTP activity availability', () => {
  it('allows new bookings only while registration is open and capacity remains', () => {
    expect(activityAvailability(activity('报名中'), false, false).canRegister).toBe(true)
    for (const state of ['草稿', '进行中', '已结束', undefined] as const)
      expect(activityAvailability(activity(state), false, false).canRegister).toBe(false)
    expect(activityAvailability(activity('报名中', 2), false, false).canRegister).toBe(false)
    expect(activityAvailability(activity('报名中'), true, false).canRegister).toBe(false)
  })
  it('lets existing participants cancel during registration even when the event is full', () => {
    expect(activityAvailability(activity('报名中', 2), true, false).canCancel).toBe(true)
    expect(activityAvailability(activity('报名中'), false, false).canCancel).toBe(false)
    for (const state of ['进行中', '已结束'] as const)
      expect(activityAvailability(activity(state), true, false).canCancel).toBe(false)
  })
  it('offers check-in only to registered participants during an ongoing activity', () => {
    expect(activityAvailability(activity('进行中'), true, false).canCheckIn).toBe(true)
    expect(activityAvailability(activity('进行中'), false, false).canCheckIn).toBe(false)
    expect(activityAvailability(activity('进行中'), true, true).canCheckIn).toBe(false)
    for (const state of ['报名中', '已结束'] as const)
      expect(activityAvailability(activity(state), true, false).canCheckIn).toBe(false)
  })
})
