export interface PublishedLesson {
  id: string
  title: string
  body: string
  practice: string
}
export interface PublishedQuestion {
  id: string
  prompt: string
  options: { id: string; text: string }[]
}
export interface PublishedCourse {
  id: string
  title: string
  description: string
  category: string
  teacher: string
  duration: number
  region: string
  publicationVersion: number
  lessons: PublishedLesson[]
  questions: PublishedQuestion[]
  passPercent: number
}
export interface CourseProgress {
  lessons: string[]
  quizPassed: boolean
  bestScore: number | null
  complete: boolean
  completedAt: string | null
  percent: number
}
export interface AssignedGroup {
  id: string
  name: string
  courseId: string
  publicationVersion: number
  cadreOnly: boolean
  declarationText: string
  declarationHash: string
  version: number
  confirmed: boolean
}
export interface EducationAccount {
  groups: AssignedGroup[]
  identity: {
    organization: string
    requestNote: string
    status: string
    reason: string
    version: number
  } | null
  declarations: {
    id: string
    groupId: string
    groupVersion: number
    text: string
    textHash: string
    confirmedAt: string
  }[]
  history: {
    courseId: string
    publicationVersion: number
    completedAt: string | null
    bestScore: number | null
  }[]
  legacyRecords: {
    courseId: string
    status: string
    recordedAt: string
    versionUnverified: boolean
  }[]
}
export const emptyProgress = (): CourseProgress => ({
  lessons: [],
  quizPassed: false,
  bestScore: null,
  complete: false,
  completedAt: null,
  percent: 0,
})
export const emptyEducationAccount = (): EducationAccount => ({
  groups: [],
  identity: null,
  declarations: [],
  history: [],
  legacyRecords: [],
})
export function allQuestionsAnswered(course: PublishedCourse, answers: Record<string, string>) {
  return (
    course.questions.length > 0 &&
    course.questions.every((question) =>
      question.options.some((o) => o.id === answers[question.id]),
    )
  )
}
