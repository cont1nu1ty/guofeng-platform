import type { Activity } from './types'

/** HTTP activity actions reflect the last server snapshot; mutations are still checked server-side. */
export function activityAvailability(activity: Activity, registered: boolean, checkedIn: boolean) {
  return {
    canRegister:
      !registered && activity.status === '报名中' && activity.registeredCount < activity.capacity,
    canCancel: registered && activity.status === '报名中',
    canCheckIn: registered && !checkedIn && activity.status === '进行中',
  }
}
