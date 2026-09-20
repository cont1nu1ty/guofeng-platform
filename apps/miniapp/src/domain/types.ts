export type RegionId = 'all' | 'beijing' | 'zhejiang' | 'sichuan'
export type GenreId =
  | 'letter'
  | 'essay'
  | 'poetry'
  | 'memoir'
  | 'biography'
  | 'family-rules'
  | 'family-notes'
  | 'commentary'
export type ChannelId = 'public-service' | 'school' | 'community' | 'special'
export type WorkStatus =
  | 'pending_initial_review'
  | 'in_review'
  | 'returned'
  | 'shortlisted'
  | 'awarded'
  | 'collected'
export type ThemeId =
  | 'integrity'
  | 'filial'
  | 'neighbor'
  | 'patriotism'
  | 'heritage'
  | 'family-history'
export type ReviewAction = 'return' | 'advance' | 'shortlist' | 'award' | 'collect'
export interface AttachmentMeta {
  id: string
  name: string
  size: number
  type: 'image' | 'pdf' | 'word'
  mimeType?: string
  tempPath?: string
  url?: string
}
export interface ReviewScores {
  theme: number
  writing: number
  originality: number
}
export interface ReviewInput {
  action: ReviewAction
  scores: ReviewScores
  comment: string
  reviewer?: string
}
export interface ReviewRecord extends ReviewInput {
  id: string
  stageIndex: number
  createdAt: string
  submissionRevision: number
  averageScore: number
}
export interface DemoNotification {
  id: string
  workId: string
  title: string
  content: string
  createdAt: string
  read: boolean
  isDemo: true
}
export interface DemoCertificate {
  id: string
  workId: string
  title: string
  author: string
  awardLabel: string
  issuedAt: string
  isDemo: true
}

export interface Option<T extends string = string> {
  id: T
  label: string
}
export interface ReviewStage {
  id: string
  label: string
  description: string
  tentative: true
}
export interface SubmissionDraft {
  title: string
  content: string
  genre: GenreId
  channel: ChannelId
  region: RegionId
  author?: string
  copyrightAccepted: boolean
  themes?: ThemeId[]
  theme?: ThemeId
  attachments?: AttachmentMeta[]
  editingWorkId?: string
}
export type ValidationErrors = Partial<Record<keyof SubmissionDraft, string>>
export interface Work {
  id: string
  title: string
  content: string
  excerpt: string
  author: string
  genre: GenreId
  channel: ChannelId
  region: RegionId
  status: WorkStatus
  statusLabel: string
  submittedAt: string
  progressIndex: number
  tags: string[]
  themes?: ThemeId[]
  theme?: ThemeId
  attachments?: AttachmentMeta[]
  reviews?: ReviewRecord[]
  revisionNumber?: number
  isMine: boolean
  isDemo: true
}
export interface Classic {
  id: string
  title: string
  subtitle: string
  author: string
  excerpt: string
  content: string
  region: RegionId
  category: string
  coverColor: string
  chapterCount: number
  isDemo: true
}
export interface Activity {
  id: string
  title: string
  excerpt: string
  content: string
  region: RegionId
  location: string
  organizer: string
  date: string
  time: string
  category: string
  capacity: number
  registeredCount: number
  isDemo: true
}
export interface Registration {
  activityId: string
  registeredAt: string
  isDemo: true
}
export interface WorkFilter {
  region?: RegionId
  genre?: GenreId
  channel?: ChannelId
}
export interface RegionFilter {
  region?: RegionId
}
export interface DemoStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}
