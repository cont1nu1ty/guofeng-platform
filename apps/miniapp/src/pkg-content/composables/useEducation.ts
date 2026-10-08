import { ref } from 'vue'
import { request, currentSessionEpoch, remoteUser } from '../../services/api'
import {
  emptyEducationAccount,
  emptyProgress,
  type PublishedCourse,
  type CourseProgress,
  type EducationAccount,
} from '../domain/education'

export function useEducation() {
  const courses = ref<PublishedCourse[]>([])
  const account = ref<EducationAccount>(emptyEducationAccount())
  const course = ref<PublishedCourse | null>(null)
  const progress = ref<CourseProgress>(emptyProgress())
  const error = ref(''),
    busy = ref(false)
  const result = ref<{ score: number; passed: boolean } | null>(null)
  let sequence = 0
  const keys = new Map<string, string>()
  async function load(id = '', version?: string) {
    const serial = ++sequence,
      epoch = currentSessionEpoch()
    busy.value = true
    error.value = ''
    course.value = null
    account.value = emptyEducationAccount()
    result.value = null
    try {
      const [catalog, mine, detail] = await Promise.all([
        request<{ items: PublishedCourse[] }>('/education/courses'),
        remoteUser.value
          ? request<EducationAccount>('/education/me')
          : Promise.resolve({ data: emptyEducationAccount() }),
        id
          ? request<{ course: PublishedCourse; progress: CourseProgress }>(
              `/education/courses/${encodeURIComponent(id)}${version ? '?version=' + encodeURIComponent(version) : ''}`,
            )
          : Promise.resolve(null),
      ])
      if (serial !== sequence || epoch !== currentSessionEpoch()) return
      courses.value = catalog.data.items
      account.value = mine.data
      course.value = detail?.data.course || null
      progress.value = detail?.data.progress || emptyProgress()
    } catch (e) {
      if (serial === sequence && epoch === currentSessionEpoch())
        error.value = e instanceof Error ? e.message : '课程加载失败，请重试。'
    } finally {
      if (serial === sequence) busy.value = false
    }
  }
  async function change(command: string, id: string, data: unknown, version?: number) {
    if (busy.value) return false
    const epoch = currentSessionEpoch(),
      owner = remoteUser.value?.id
    if (!owner) {
      error.value = '请先登录，再保存学习记录或提交申请。'
      return false
    }
    busy.value = true
    error.value = ''
    const payload = { command, entityId: id, version, data }
    const fingerprint = `${owner}:${JSON.stringify(payload)}`
    const key =
      keys.get(fingerprint) ||
      `education_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`
    keys.set(fingerprint, key)
    try {
      const response = await request<{
        progress?: CourseProgress
        result?: { score?: number; passed?: boolean }
      }>('/education/commands', 'POST', payload, { 'Idempotency-Key': key })
      if (epoch !== currentSessionEpoch()) return false
      keys.delete(fingerprint)
      if (response.data.progress) progress.value = response.data.progress
      if (response.data.result?.score !== undefined)
        result.value = { score: response.data.result.score, passed: !!response.data.result.passed }
      const mine = await request<EducationAccount>('/education/me')
      if (epoch !== currentSessionEpoch()) return false
      account.value = mine.data
      return true
    } catch (e) {
      if (epoch === currentSessionEpoch())
        error.value = e instanceof Error ? e.message : '未保存，请重试。'
      return false
    } finally {
      if (epoch === currentSessionEpoch()) busy.value = false
    }
  }
  return { courses, account, course, progress, error, busy, result, load, change }
}
