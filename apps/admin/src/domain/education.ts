export interface LessonDraft {
  id: string;
  title: string;
  body: string;
  practice: string;
}
export interface QuestionDraft {
  id: string;
  prompt: string;
  options: { id: string; text: string }[];
  answerId: string;
  explanation: string;
}
export interface EducationCourse {
  id: string;
  title: string;
  description: string;
  teacher: string;
  category: string;
  region: string;
  duration: number;
  passPercent: number;
  lessons: LessonDraft[];
  questions: QuestionDraft[];
  examQuestionIds: string[];
  status: string;
  lockVersion?: number;
  publishedVersion: number;
  versions: { version: number; publishedAt: string; legacy: boolean }[];
}
export interface EducationGroup {
  id: string;
  name: string;
  region: string;
  courseId: string;
  publicationVersion: number;
  cadreOnly: boolean;
  declarationText: string;
  version: number;
  members: number;
  completed: number;
  declarations: number;
  memberRecords: {
    id: string;
    name: string;
    completedAt: string | null;
    bestScore: number | null;
    identityStatus: string | null;
  }[];
  declarationHistory: {
    id: string;
    userId: number;
    name: string;
    groupVersion: number;
    text: string;
    textHash: string;
    confirmedAt: string;
  }[];
}
export interface EducationIdentity {
  userId: string;
  name: string;
  region: string;
  organization: string;
  requestNote: string;
  status: string;
  reason: string;
  version: number;
}
export interface EducationWorkspace {
  pageSize?: number;
  courseTotal?: number;
  groupTotal?: number;
  identityTotal?: number;
  courses: EducationCourse[];
  learningGroups: EducationGroup[];
  identities: EducationIdentity[];
  members: { id: string; name: string; regions: string[] }[];
}
export function contentId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
export function newLesson(): LessonDraft {
  return { id: contentId("lesson"), title: "", body: "", practice: "" };
}
export function newQuestion(): QuestionDraft {
  const options = [0, 1, 2].map(() => ({ id: contentId("option"), text: "" }));
  return {
    id: contentId("question"),
    prompt: "",
    options,
    answerId: options[0]!.id,
    explanation: "",
  };
}
export function newCourse(region = "all"): EducationCourse {
  return {
    id: "",
    title: "",
    description: "",
    category: "清廉家风",
    teacher: "家风教研组",
    region,
    duration: 30,
    passPercent: 100,
    lessons: [newLesson()],
    questions: [],
    examQuestionIds: [],
    status: "草稿",
    publishedVersion: 0,
    versions: [],
  };
}
export function validateCourse(course: EducationCourse): string {
  if (
    course.title.trim().length < 4 ||
    course.description.trim().length < 10 ||
    !course.teacher.trim()
  )
    return "请填写课程名称（至少4字）、简介（至少10字）和教研团队。";
  if (
    !course.lessons.length ||
    course.lessons.some((x) => !x.title.trim() || !x.body.trim())
  )
    return "每节课程必须填写标题和正文。";
  if (new Set(course.lessons.map((x) => x.id)).size !== course.lessons.length)
    return "章节编号重复，请重新添加该章节。";
  for (const q of course.questions)
    if (
      !q.prompt.trim() ||
      q.options.length < 2 ||
      q.options.some((x) => !x.text.trim()) ||
      !q.options.some((x) => x.id === q.answerId)
    )
      return "每道题需题干、至少两个完整选项和一个正确答案。";
  if (
    new Set(course.examQuestionIds).size !== course.examQuestionIds.length ||
    course.examQuestionIds.some(
      (id) => !course.questions.some((q) => q.id === id),
    )
  )
    return "组卷包含失效或重复题目。";
  return "";
}
