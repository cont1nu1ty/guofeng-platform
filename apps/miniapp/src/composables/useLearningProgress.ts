import { isHttpMode } from '../config/dataMode'
import { command, remoteWorkspace, remoteError } from '../services/api'
import { computed, ref } from 'vue'
import { courses, venues } from '../domain/contentCatalog'

export const LEARNING_STORAGE_KEY = 'jiafeng:learning:v1'
interface CourseRecord {
  lessons: string[]
  quizPassed: boolean
  completedAt?: string
}
interface LearningState {
  version: 1
  courses: Record<string, CourseRecord>
  checkIns: Record<string, string>
}
const emptyState = (): LearningState => ({ version: 1, courses: {}, checkIns: {} })
export const learningStorageError = ref(false)
function restore(): LearningState {
  try {
    const raw = uni.getStorageSync(LEARNING_STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : null
    if (!parsed || parsed.version !== 1) return emptyState()
    const next = emptyState()
    for (const course of courses) {
      const record = parsed.courses?.[course.id]
      if (!record || !Array.isArray(record.lessons)) continue
      const lessons = course.lessons
        .filter((lesson) => record.lessons.includes(lesson.id))
        .map((lesson) => lesson.id)
      const quizPassed = record.quizPassed === true && lessons.length === course.lessons.length
      next.courses[course.id] = {
        lessons,
        quizPassed,
        completedAt:
          quizPassed &&
          typeof record.completedAt === 'string' &&
          Number.isFinite(Date.parse(record.completedAt))
            ? record.completedAt
            : undefined,
      }
    }
    for (const venue of venues) {
      if (!venue.activityId) continue
      const value = parsed.checkIns?.[venue.activityId]
      if (typeof value === 'string' && Number.isFinite(Date.parse(value)))
        next.checkIns[venue.activityId] = value
    }
    return next
  } catch {
    learningStorageError.value = true
    return emptyState()
  }
}
const state = ref<LearningState>(isHttpMode ? emptyState() : restore())
function save(next: LearningState) {
  if (learningStorageError.value) return false
  try {
    uni.setStorageSync(LEARNING_STORAGE_KEY, JSON.stringify(next))
    state.value = next
    return true
  } catch {
    learningStorageError.value = true
    return false
  }
}
export function getCourseProgress(id: string) {
  const course = courses.find((item) => item.id === id)
  const record = (isHttpMode ? remoteWorkspace.learning.courses : state.value.courses)[id] ?? {
    lessons: [],
    quizPassed: false,
  }
  const requiresQuiz = Boolean(course?.quiz.options.length)
  const total = Math.max(1, (course?.lessons.length ?? 0) + Number(requiresQuiz))
  const allLessons = Boolean(
    course?.lessons.length && record.lessons.length === course.lessons.length,
  )
  return {
    ...record,
    percent: Math.round(
      ((record.lessons.length + Number(requiresQuiz && record.quizPassed)) / total) * 100,
    ),
    complete: Boolean(allLessons && (!requiresQuiz || record.quizPassed)),
  }
}
export async function completeLesson(courseId: string, lessonId: string) {
  if (isHttpMode) return remoteChange('course.progress', courseId, { lessonId })
  const course = courses.find((item) => item.id === courseId)
  if (!course?.lessons.some((item) => item.id === lessonId)) return false
  const record = (isHttpMode ? remoteWorkspace.learning.courses : state.value.courses)[
    courseId
  ] ?? { lessons: [], quizPassed: false }
  if (record.lessons.includes(lessonId)) return true
  return save({
    ...state.value,
    courses: {
      ...(isHttpMode ? remoteWorkspace.learning.courses : state.value.courses),
      [courseId]: { ...record, lessons: [...record.lessons, lessonId] },
    },
  })
}
export async function completeQuiz(courseId: string, answer: number) {
  if (isHttpMode) return remoteChange('course.progress', courseId, { answer })
  const course = courses.find((item) => item.id === courseId)
  const record = (isHttpMode ? remoteWorkspace.learning.courses : state.value.courses)[courseId]
  if (
    !course ||
    !record ||
    record.lessons.length !== course.lessons.length ||
    answer !== course.quiz.answer
  )
    return false
  return save({
    ...state.value,
    courses: {
      ...(isHttpMode ? remoteWorkspace.learning.courses : state.value.courses),
      [courseId]: {
        ...record,
        quizPassed: true,
        completedAt: record.completedAt ?? new Date().toISOString(),
      },
    },
  })
}
export function isCheckedIn(id: string) {
  return Boolean((isHttpMode ? remoteWorkspace.learning.checkIns : state.value.checkIns)[id])
}
export async function checkInActivity(id: string) {
  if (isHttpMode) return remoteChange('activity.checkIn', id)
  if (!venues.some((item) => item.activityId === id)) return false
  if (isCheckedIn(id)) return true
  return save({
    ...state.value,
    checkIns: {
      ...(isHttpMode ? remoteWorkspace.learning.checkIns : state.value.checkIns),
      [id]: new Date().toISOString(),
    },
  })
}
export function clearActivityCheckIn(id: string) {
  if (isHttpMode) return true
  const next = { ...(isHttpMode ? remoteWorkspace.learning.checkIns : state.value.checkIns) }
  delete next[id]
  return save({ ...state.value, checkIns: next })
}
export const learningRecords = computed(() =>
  courses
    .filter(
      (course) => (isHttpMode ? remoteWorkspace.learning.courses : state.value.courses)[course.id],
    )
    .map((course) => ({ course, ...getCourseProgress(course.id) })),
)
export const learningSummary = computed(() => ({
  started: learningRecords.value.length,
  completed: learningRecords.value.filter((record) => record.complete).length,
  checkIns: Object.keys(isHttpMode ? remoteWorkspace.learning.checkIns : state.value.checkIns)
    .length,
}))
export const checkedInActivities = computed(() =>
  Object.entries(isHttpMode ? remoteWorkspace.learning.checkIns : state.value.checkIns).map(
    ([activityId, checkedInAt]) => ({
      activityId,
      checkedInAt,
    }),
  ),
)

async function remoteChange(name: string, id: string, data?: unknown) {
  try {
    await command(name, id, data)
    return true
  } catch (error) {
    remoteError.value = error instanceof Error ? error.message : '记录未保存'
    return false
  }
}
