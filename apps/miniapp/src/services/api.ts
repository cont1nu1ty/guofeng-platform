import { reactive, ref, watch } from 'vue'
import { apiBaseUrl, isHttpMode } from '../config/dataMode'
import type {
  Activity,
  Classic,
  DemoCertificate,
  DemoNotification,
  Registration,
  SubmissionDraft,
  Work,
} from '../domain/types'
import {
  newsArticles,
  courses,
  venues,
  type Venue,
  type NewsArticle,
  type Course,
} from '../domain/contentCatalog'
import {
  culturalProducts,
  mediaCatalog,
  hallPeople,
  type MediaItem,
  type HallPerson,
  type CulturalProduct,
  type CommerceRequest,
} from '../domain/showcaseCatalog'
import { locale } from '../composables/useLocale'
import {
  normalizeMedia,
  normalizeVenue,
  normalizeHall,
  visibleEdition,
  editionText,
  type HomeBanner,
  type HomeSection,
  type MediaSubmission,
  type SupportTicket,
} from '../domain/remoteCatalog'
import type { NewsPreferences } from '../pkg-content/domain/newsPreferences'
import type { Excerpt, AiArchive } from '../domain/personalArchive'
import type { CloudRecitation, FamilyPromise } from '../domain/cloudRecords'

export interface SessionUser {
  id: string
  name: string
  roles: string[]
  regionIds: string[]
}
export interface RemoteReviewTask {
  id: string
  submissionId: string
  version: number
  ruleVersion: string
  status: 'pending' | 'submitted' | 'cancelled'
  title: string
  content: string
  startsAt?: string
  dueAt?: string
  windowVersion?: number
  windowStatus?: import('../domain/reviewWindow').ReviewWindowStatus
  canScore?: boolean
  serverNow?: string
  dimensions: { id: string; label: string; min?: number; max: number }[]
  scores?: number[]
  comment?: string
}
export interface RemoteWorkspace {
  serverNow?: string
  recitations: CloudRecitation[]
  familyPromises: FamilyPromise[]
  banners: HomeBanner[]
  mediaItems: MediaItem[]
  mediaSubmissions: MediaSubmission[]
  venues: Venue[]
  hallPeople: HallPerson[]
  homepageConfig: { sections?: HomeSection[]; lockVersion?: number }
  homeStats: { submissions: number; participants: number; regions: number; asOf: string } | null
  supportTickets: SupportTicket[]
  newsPreferences: NewsPreferences
  works: Work[]
  classics: Classic[]
  activities: Activity[]
  news: NewsArticle[]
  courses: Course[]
  products: CulturalProduct[]
  registrations: Registration[]
  favorites: string[]
  notifications: DemoNotification[]
  certificates: DemoCertificate[]
  reviewTasks: RemoteReviewTask[]
  scoringDimensions: RemoteReviewTask['dimensions']
  reviewRuleVersion: string
  learning: {
    courses: Record<string, { lessons: string[]; quizPassed: boolean; completedAt?: string }>
    checkIns: Record<string, string>
  }
  commerceRequests: CommerceRequest[]
  excerpts: Excerpt[]
  aiArchives: AiArchive[]
  mediaFavorites: string[]
  mediaLikes: string[]
}
export const emptyWorkspace = (): RemoteWorkspace => ({
  recitations: [],
  familyPromises: [],
  banners: [],
  mediaItems: [],
  mediaSubmissions: [],
  venues: [],
  hallPeople: [],
  homepageConfig: {},
  homeStats: null,
  supportTickets: [],
  newsPreferences: { categories: [], updates: false, digest: 'instant', quietHours: true },
  works: [],
  classics: [],
  activities: [],
  news: [],
  courses: [],
  products: [],
  registrations: [],
  favorites: [],
  notifications: [],
  certificates: [],
  reviewTasks: [],
  scoringDimensions: [],
  reviewRuleVersion: '',
  learning: { courses: {}, checkIns: {} },
  commerceRequests: [],
  excerpts: [],
  aiArchives: [],
  mediaFavorites: [],
  mediaLikes: [],
})
export const remoteWorkspace = reactive<RemoteWorkspace>(emptyWorkspace())
export const remoteUser = ref<SessionUser | null>(null)
export const remoteLoading = ref(false)
export const remoteError = ref('')
export const remoteRevision = ref(0)
export const remoteDraft = ref<SubmissionDraft | null>(null)
let draftEtag = ''
let sessionEpoch = 0
let workspaceGeneration = 0
export function currentSessionEpoch() {
  return sessionEpoch
}
const tokenKey = 'jiafeng:http:token'
const commandKeys = new Map<string, string>()
function readToken() {
  try {
    return String(uni.getStorageSync(tokenKey) || '')
  } catch {
    return ''
  }
}
let token = isHttpMode ? readToken() : ''
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 0,
    public requestId = '',
    public fieldErrors?: Record<string, string>,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
function clearSession() {
  token = ''
  remoteUser.value = null
  sessionEpoch++
  workspaceGeneration++
  draftEtag = ''
  remoteDraft.value = null
  remoteLoading.value = false
  commandKeys.clear()
  submissionKeys.clear()
  try {
    uni.removeStorageSync(tokenKey)
  } catch {
    /* memory is cleared even if storage is unavailable */
  }
  applyWorkspace(emptyWorkspace())
}
export function request<T>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  data?: unknown,
  headers: Record<string, string> = {},
): Promise<{ data: T; headers: Record<string, string> }> {
  const epoch = sessionEpoch
  return new Promise((resolve, reject) => {
    uni.request({
      url: apiBaseUrl + path,
      method,
      data: data as Record<string, unknown>,
      timeout: 20000,
      header: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      success(response) {
        const status = response.statusCode
        if (status >= 200 && status < 300) {
          const responseHeaders = Object.fromEntries(
            Object.entries(response.header || {}).map(([key, value]) => [
              key.toLowerCase(),
              String(value),
            ]),
          )
          resolve({ data: response.data as T, headers: responseHeaders })
          return
        }
        const body = response.data as Partial<ApiError> | undefined
        if (status === 401 && epoch === sessionEpoch) clearSession()
        reject(
          new ApiError(
            body?.code || 'REQUEST_FAILED',
            body?.message || `请求未完成（${status}）`,
            status,
            body?.requestId,
            body?.fieldErrors,
          ),
        )
      },
      fail() {
        reject(new ApiError('NETWORK_ERROR', '无法连接服务，请检查网络后重试。数据尚未保存。'))
      },
    })
  })
}
const bilingual = (value: unknown) =>
  typeof value === 'object' && value !== null && 'zh' in value
    ? value
    : { zh: String(value ?? ''), en: String(value ?? '') }
function normalizeNews(value: NewsArticle | Record<string, unknown>): NewsArticle {
  const v = value as Record<string, any>
  const language = ['en', 'English', '英文'].includes(v.language) ? 'en' : 'zh'
  return {
    ...v,
    id: String(v.id),
    language,
    region: v.regionId || v.region || 'all',
    category:
      (
        {
          资讯: 'activity',
          公告: 'notice',
          专题: 'role-model',
          Banner: 'notice',
          政策解读: 'policy',
          行业动态: 'industry',
          活动报道: 'activity',
          榜样人物: 'role-model',
        } as Record<string, string>
      )[v.category] ||
      v.category ||
      'activity',
    topic: v.topic || 'everyday',
    title: editionText(v.title, language),
    excerpt: editionText(v.excerpt ?? v.summary, language),
    date: String(v.date || v.updatedAt || '').slice(0, 10),
    paragraphs: Array.isArray(v.paragraphs)
      ? v.paragraphs.map((x: unknown) => editionText(x, language))
      : String(v.body || '')
          .split('\n')
          .filter(Boolean)
          .map((x: unknown) => editionText(x, language)),
  } as NewsArticle
}
function normalizeCourse(value: Course | Record<string, unknown>): Course {
  const v = value as Record<string, any>
  return {
    ...v,
    id: String(v.id),
    title: bilingual(v.title),
    theme: bilingual(v.theme || v.category),
    description: bilingual(v.description || v.summary),
    mark: v.mark || '学',
    audience: bilingual(v.audience || '平台用户'),
    lessons: Array.isArray(v.lessons)
      ? v.lessons.map((x: any) => ({
          ...x,
          duration: Number(x.duration || v.duration || 0),
          title: bilingual(x.title),
          body: bilingual(x.body),
          practice: bilingual(x.practice || ''),
        }))
      : [],
    quiz: (v.quiz
      ? {
          ...v.quiz,
          question: bilingual(v.quiz.question),
          options: (v.quiz.options || []).map(bilingual),
          explanation: bilingual(v.quiz.explanation),
        }
      : null) || {
      question: bilingual('课程测验暂未发布'),
      options: [],
      answer: -1,
      explanation: bilingual(''),
    },
  } as Course
}
function normalizeProduct(value: CulturalProduct | Record<string, unknown>): CulturalProduct {
  const v = value as Record<string, any>
  return {
    ...v,
    id: String(v.id),
    name: bilingual(v.name || v.title),
    description: bilingual(v.description || v.summary || v.subtitle),
    category: bilingual(v.category),
    mark: v.mark || '礼',
    kind: v.kind || 'public',
    specification: bilingual(v.specification || v.description),
    details: (v.details || []).map(bilingual),
  } as CulturalProduct
}
export function applyWorkspace(value: Partial<RemoteWorkspace>) {
  const next = { ...emptyWorkspace(), ...value }
  next.learning = { courses: {}, checkIns: {}, ...value.learning }
  next.news = (next.news || []).map(normalizeNews)
  next.courses = (next.courses || []).map(normalizeCourse)
  next.products = (next.products || []).map(normalizeProduct)
  next.banners = (next.banners || []).map((b) => ({
    ...b,
    cover:
      b.cover && b.cover.startsWith('/api/') && /^https?:/.test(apiBaseUrl)
        ? apiBaseUrl.replace(/\/api\/v1\/?$/, '') + b.cover
        : b.cover,
  }))
  next.mediaItems = (next.mediaItems || []).map(normalizeMedia)
  next.mediaSubmissions = (next.mediaSubmissions || []).map(normalizeMedia)
  next.venues = (next.venues || []).map(normalizeVenue)
  next.hallPeople = (next.hallPeople || []).map(normalizeHall)
  Object.assign(remoteWorkspace, next)
  syncPublishedCatalogs()
  courses.splice(0, courses.length, ...next.courses)
  culturalProducts.splice(0, culturalProducts.length, ...next.products)
  remoteRevision.value++
}
function syncPublishedCatalogs() {
  newsArticles.splice(0, newsArticles.length, ...visibleEdition(remoteWorkspace.news, locale.value))
  mediaCatalog.splice(
    0,
    mediaCatalog.length,
    ...visibleEdition(remoteWorkspace.mediaItems, locale.value),
  )
  venues.splice(0, venues.length, ...visibleEdition(remoteWorkspace.venues, locale.value))
  hallPeople.splice(
    0,
    hallPeople.length,
    ...visibleEdition(remoteWorkspace.hallPeople, locale.value),
  )
}
if (isHttpMode) watch(locale, syncPublishedCatalogs, { flush: 'sync' })
export async function refreshWorkspace() {
  const epoch = sessionEpoch
  const generation = ++workspaceGeneration
  remoteLoading.value = true
  remoteError.value = ''
  try {
    const response = await request<RemoteWorkspace>('/workspace')
    if (epoch === sessionEpoch && generation === workspaceGeneration) applyWorkspace(response.data)
  } catch (error) {
    remoteError.value = error instanceof Error ? error.message : '加载失败'
    throw error
  } finally {
    if (epoch === sessionEpoch) remoteLoading.value = false
  }
}
export async function signInRemote(username: string, password: string) {
  const response = await request<{ token: string; user: SessionUser }>('/auth/login', 'POST', {
    username,
    password,
    client: 'member',
  })
  clearSession()
  token = response.data.token
  remoteUser.value = response.data.user
  try {
    uni.setStorageSync(tokenKey, token)
  } catch {
    /* this session still works without persistence */
  }
  await refreshWorkspace()
}
export async function signOutRemote() {
  try {
    await request('/auth/logout', 'POST')
  } catch {
    clearSession()
    remoteError.value = '已退出当前设备，但服务暂不可达，未能确认服务端会话注销。'
    throw new ApiError('LOGOUT_UNCONFIRMED', remoteError.value)
  }
  clearSession()
  await refreshWorkspace()
}
export async function initializeRemote() {
  if (!isHttpMode) return
  if (token) {
    try {
      const response = await request<SessionUser | { user: SessionUser }>('/auth/me')
      remoteUser.value = 'user' in response.data ? response.data.user : response.data
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) {
        remoteError.value = error instanceof Error ? error.message : '会话加载失败'
        return
      }
    }
  }
  await refreshWorkspace().catch(() => {})
}
export async function command<T = unknown>(
  name: string,
  entityId?: string,
  data?: unknown,
  version?: number,
): Promise<T> {
  const epoch = sessionEpoch
  const payload = { command: name, entityId, data, version }
  const fingerprint = JSON.stringify(payload)
  let key = commandKeys.get(fingerprint)
  if (!key) {
    key = `miniapp-command-${Date.now()}-${Math.random().toString(36).slice(2)}`
    commandKeys.set(fingerprint, key)
  }
  const response = await request<{ result?: T; workspace?: RemoteWorkspace }>(
    '/commands',
    'POST',
    payload,
    { 'Idempotency-Key': key },
  )

  if (epoch !== sessionEpoch)
    throw new ApiError('SESSION_CHANGED', '账户已改变，请重新打开此页面。')
  if (response.data.workspace) {
    workspaceGeneration++
    applyWorkspace(response.data.workspace)
  } else await refreshWorkspace()
  commandKeys.delete(fingerprint)
  return response.data.result as T
}
export async function loadRemoteDraft() {
  const epoch = sessionEpoch
  const response = await request<{ draft: SubmissionDraft | null }>('/me/draft')
  if (epoch !== sessionEpoch) throw new ApiError('SESSION_CHANGED', '账户已改变，请重新打开草稿。')
  draftEtag = response.headers.etag || ''
  remoteDraft.value = response.data.draft
  return response.data.draft
}
export async function saveRemoteDraft(draft: SubmissionDraft) {
  const epoch = sessionEpoch
  if (!draftEtag) await loadRemoteDraft()
  const response = await request<{ draft: SubmissionDraft } | SubmissionDraft>(
    '/me/draft',
    'PUT',
    draft,
    { 'If-Match': draftEtag },
  )
  if (epoch !== sessionEpoch) throw new ApiError('SESSION_CHANGED', '账户已改变，草稿响应未应用。')
  draftEtag = response.headers.etag || draftEtag
  remoteDraft.value = 'draft' in response.data ? response.data.draft : response.data
  return remoteDraft.value
}
export async function clearRemoteDraft() {
  const epoch = sessionEpoch
  if (!draftEtag) await loadRemoteDraft()
  const response = await request('/me/draft', 'DELETE', undefined, { 'If-Match': draftEtag })
  if (epoch !== sessionEpoch) throw new ApiError('SESSION_CHANGED', '账户已改变，请重新加载草稿。')
  draftEtag = response.headers.etag || ''
  remoteDraft.value = null
}
const submissionKeys = new Map<string, string>()
export async function submitRemote(draft: SubmissionDraft) {
  const epoch = sessionEpoch
  const payload = JSON.stringify(draft)
  let key = submissionKeys.get(payload)
  if (!key) {
    key = `miniapp-${Date.now()}-${Math.random().toString(36).slice(2)}`
    submissionKeys.set(payload, key)
  }
  const work = draft.editingWorkId
    ? remoteWorkspace.works.find((x) => x.id === draft.editingWorkId)
    : undefined
  const response = await request<Work>(
    draft.editingWorkId
      ? `/submissions/${encodeURIComponent(draft.editingWorkId)}/revisions`
      : '/submissions',
    'POST',
    draft,
    { 'Idempotency-Key': key, ...(work ? { 'If-Match': `"${work.version}"` } : {}) },
  )
  if (epoch !== sessionEpoch)
    throw new ApiError('SESSION_CHANGED', '账户已改变，请在原账号查看投稿结果。')
  remoteDraft.value = null
  draftEtag = ''
  submissionKeys.delete(payload)
  // The accepted submission is authoritative even if the subsequent list refresh fails.
  remoteWorkspace.works = [
    response.data,
    ...remoteWorkspace.works.filter((x) => x.id !== response.data.id),
  ]
  remoteRevision.value++
  // The server only clears a matching draft. A newer draft from another device
  // must remain available, together with its current ETag, for the next editor.
  await loadRemoteDraft().catch(() => {})
  await refreshWorkspace().catch(() => {})
  return response.data
}
export async function uploadRemoteFile<T extends string = 'image' | 'pdf' | 'word'>(
  path: string,
  name: string,
  purpose?: 'media' | 'recitation',
): Promise<{
  fileId: string
  name: string
  size: number
  type: T
  mimeType?: string
  duration?: number
  purpose?: string
  originalName?: string
  url?: string
}> {
  const epoch = sessionEpoch
  if (!token) throw new ApiError('UNAUTHENTICATED', '请先登录，再上传附件。', 401)
  // #ifdef H5
  // Uni's blob-path conversion loses the original file name. Preserve it in the
  // multipart File so the server validates the same Chinese filename the user chose.
  let selectedFile: File | undefined
  if (path.startsWith('blob:')) {
    try {
      const response = await fetch(path)
      if (!response.ok) throw new Error('unreadable')
      const blob = await response.blob()
      selectedFile = new File([blob], name, { type: blob.type || 'application/octet-stream' })
    } catch {
      throw new ApiError('FILE_UNAVAILABLE', '无法读取所选文件，请重新选择。')
    }
  }
  if (epoch !== sessionEpoch) throw new ApiError('SESSION_CHANGED', '账户已改变，请重新选择文件。')
  // #endif
  return new Promise((resolve, reject) =>
    uni.uploadFile({
      url: apiBaseUrl + '/files' + (purpose ? '?purpose=' + purpose : ''),
      filePath: path,
      // #ifdef H5
      ...(selectedFile ? { file: selectedFile } : {}),
      // #endif
      name: 'file',
      formData: { filename: name },
      header: { Authorization: `Bearer ${token}` },
      timeout: 60000,
      success(response) {
        if (epoch !== sessionEpoch) {
          reject(new ApiError('SESSION_CHANGED', '账户已改变，请重新上传附件。'))
          return
        }
        let body: any
        try {
          body = JSON.parse(response.data)
        } catch {
          reject(new ApiError('INVALID_RESPONSE', '上传响应无法读取，请重试。'))
          return
        }
        if (response.statusCode >= 200 && response.statusCode < 300 && body.fileId) resolve(body)
        else {
          if (response.statusCode === 401) clearSession()
          reject(
            new ApiError(
              body.code || 'UPLOAD_FAILED',
              body.message || '附件上传失败。',
              response.statusCode,
            ),
          )
        }
      },
      fail() {
        reject(new ApiError('NETWORK_ERROR', '附件上传失败，请检查网络后重新选择。'))
      },
    }),
  )
}
