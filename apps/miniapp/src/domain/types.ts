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
export type WorkStatus = 'pending_initial_review' | 'in_review' | 'collected'

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
