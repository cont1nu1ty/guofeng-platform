import { channels, genres, regions, seedActivities, seedClassics, seedWorks } from './fixtures'
import type {
  DemoStorage,
  RegionFilter,
  Registration,
  SubmissionDraft,
  ValidationErrors,
  Work,
  WorkFilter,
} from './types'

export * from './types'
export * from './fixtures'
export const DEMO_STORAGE_KEY = 'jiafeng:demo:v1'

export class DemoStorageError extends Error {
  constructor(action: 'read' | 'write') {
    super(
      action === 'read'
        ? '无法读取本地演示数据，请检查设备存储权限。'
        : '本地保存失败，数据尚未保存。请检查存储空间或浏览器权限后重试。',
    )
    this.name = 'DemoStorageError'
  }
}
export class SubmissionValidationError extends Error {
  constructor(public readonly errors: ValidationErrors) {
    super('请完善投稿信息后再提交。')
    this.name = 'SubmissionValidationError'
  }
}

interface StoredState {
  version: 1
  sequence: number
  draft: SubmissionDraft | null
  submissions: Work[]
  favoriteIds: string[]
  registrations: Registration[]
}
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const emptyState = (): StoredState => ({
  version: 1,
  sequence: 0,
  draft: null,
  submissions: [],
  favoriteIds: [],
  registrations: [],
})
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const validRegion = (value: unknown) => regions.some((item) => item.id === value)
const validGenre = (value: unknown) => genres.some((item) => item.id === value)
const validChannel = (value: unknown) => channels.some((item) => item.id === value)

export function createEmptyDraft(): SubmissionDraft {
  return {
    title: '',
    content: '',
    genre: 'letter',
    channel: 'community',
    region: 'all',
    author: '',
    copyrightAccepted: false,
  }
}

export function validateSubmission(draft: SubmissionDraft): ValidationErrors {
  const errors: ValidationErrors = {}
  const titleLength = [...(typeof draft.title === 'string' ? draft.title.trim() : '')].length
  if (titleLength < 2 || titleLength > 50) errors.title = '标题需为 2–50 个字。'
  if ([...(typeof draft.content === 'string' ? draft.content.trim() : '')].length < 20)
    errors.content = '正文至少填写 20 个字。'
  if (!validGenre(draft.genre)) errors.genre = '请选择有效的投稿体裁。'
  if (!validChannel(draft.channel)) errors.channel = '请选择有效的投稿通道。'
  if (!validRegion(draft.region)) errors.region = '请选择有效的所属地区。'
  if (draft.copyrightAccepted !== true) errors.copyrightAccepted = '请阅读并同意演示版权声明。'
  return errors
}

function isDraft(value: unknown): value is SubmissionDraft {
  return (
    object(value) &&
    typeof value.title === 'string' &&
    typeof value.content === 'string' &&
    validGenre(value.genre) &&
    validChannel(value.channel) &&
    validRegion(value.region) &&
    typeof value.copyrightAccepted === 'boolean' &&
    (value.author === undefined || typeof value.author === 'string')
  )
}
function isStoredWork(value: unknown): value is Work {
  return (
    object(value) &&
    typeof value.id === 'string' &&
    value.id.startsWith('DEMO-') &&
    typeof value.title === 'string' &&
    typeof value.content === 'string' &&
    typeof value.excerpt === 'string' &&
    typeof value.author === 'string' &&
    validGenre(value.genre) &&
    validChannel(value.channel) &&
    validRegion(value.region) &&
    value.status === 'pending_initial_review' &&
    typeof value.statusLabel === 'string' &&
    typeof value.submittedAt === 'string' &&
    Number.isFinite(Date.parse(value.submittedAt)) &&
    value.progressIndex === 0 &&
    Array.isArray(value.tags) &&
    value.tags.every((tag) => typeof tag === 'string') &&
    value.isMine === true &&
    value.isDemo === true
  )
}

function loadState(storage: DemoStorage): StoredState {
  let raw: string | null
  try {
    raw = storage.getItem(DEMO_STORAGE_KEY)
  } catch {
    throw new DemoStorageError('read')
  }
  if (!raw) return emptyState()
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return emptyState()
  }
  if (!object(value) || value.version !== 1) return emptyState()
  const submissions = Array.isArray(value.submissions) ? value.submissions.filter(isStoredWork) : []
  const knownContent = new Set(
    [...seedWorks, ...seedClassics, ...submissions].map((item) => item.id),
  )
  const knownActivities = new Set(seedActivities.map((item) => item.id))
  const registrations: Registration[] = []
  if (Array.isArray(value.registrations)) {
    for (const item of value.registrations) {
      if (
        object(item) &&
        typeof item.activityId === 'string' &&
        knownActivities.has(item.activityId) &&
        typeof item.registeredAt === 'string' &&
        Number.isFinite(Date.parse(item.registeredAt)) &&
        !registrations.some((entry) => entry.activityId === item.activityId)
      ) {
        registrations.push({
          activityId: item.activityId,
          registeredAt: item.registeredAt,
          isDemo: true,
        })
      }
    }
  }
  return {
    version: 1,
    sequence:
      typeof value.sequence === 'number' &&
      Number.isSafeInteger(value.sequence) &&
      value.sequence >= 0
        ? value.sequence
        : submissions.length,
    draft: isDraft(value.draft) ? value.draft : null,
    submissions,
    favoriteIds: Array.isArray(value.favoriteIds)
      ? [
          ...new Set(
            value.favoriteIds.filter(
              (id): id is string => typeof id === 'string' && knownContent.has(id),
            ),
          ),
        ]
      : [],
    registrations,
  }
}

/** 可替换为真实 API 仓库。当前仅处理本设备的演示数据，不产生真实投稿或预约。 */
export function createDemoRepository(storage: DemoStorage) {
  let state = loadState(storage)
  function commit(next: StoredState) {
    try {
      storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(next))
    } catch {
      throw new DemoStorageError('write')
    }
    // 只有持久化成功才更新内存，避免界面将失败的操作显示为成功。
    state = next
  }
  const allWorks = () => [...state.submissions, ...seedWorks]
  const allContent = () => [...allWorks(), ...seedClassics]
  const matchesRegion = (item: { region: string }, filter: RegionFilter) =>
    !filter.region || filter.region === 'all' || item.region === filter.region
  const getActivity = (id: string) => {
    const activity = seedActivities.find((item) => item.id === id)
    if (!activity) throw new Error('未找到这个演示活动，请返回活动列表重试。')
    return activity
  }
  return {
    listWorks(filter: WorkFilter = {}) {
      return copy(
        allWorks().filter(
          (item) =>
            matchesRegion(item, filter) &&
            (!filter.genre || item.genre === filter.genre) &&
            (!filter.channel || item.channel === filter.channel),
        ),
      )
    },
    getWork(id: string) {
      const work = allWorks().find((item) => item.id === id)
      return work ? copy(work) : undefined
    },
    listMyWorks() {
      return copy(state.submissions)
    },
    getDraft() {
      return copy(state.draft)
    },
    saveDraft(draft: SubmissionDraft) {
      if (!isDraft(draft)) throw new Error('草稿格式不正确，请检查体裁、通道和地区。')
      const saved = copy(draft)
      commit({ ...state, draft: saved })
      return copy(saved)
    },
    clearDraft() {
      commit({ ...state, draft: null })
    },
    validateSubmission,
    submitWork(draft: SubmissionDraft) {
      const errors = validateSubmission(draft)
      if (Object.keys(errors).length) throw new SubmissionValidationError(errors)
      let sequence = state.sequence + 1
      const prefix = `DEMO-${Date.now().toString(36).toUpperCase()}`
      let id = `${prefix}-${String(sequence).padStart(4, '0')}`
      while (allWorks().some((item) => item.id === id))
        id = `${prefix}-${String(++sequence).padStart(4, '0')}`
      const content = draft.content.trim()
      const work: Work = {
        id,
        title: draft.title.trim(),
        content,
        excerpt: [...content].slice(0, 72).join(''),
        author: draft.author?.trim()
          ? `${draft.author.trim()}（演示投稿）`
          : '体验用户（演示投稿）',
        genre: draft.genre,
        channel: draft.channel,
        region: draft.region,
        status: 'pending_initial_review',
        statusLabel: '待初审（演示）',
        submittedAt: new Date().toISOString(),
        progressIndex: 0,
        tags: ['本地演示投稿'],
        isMine: true,
        isDemo: true,
      }
      commit({ ...state, sequence, draft: null, submissions: [work, ...state.submissions] })
      return copy(work)
    },
    toggleFavorite(id: string) {
      if (!allContent().some((item) => item.id === id)) throw new Error('未找到可收藏的演示内容。')
      const exists = state.favoriteIds.includes(id)
      commit({
        ...state,
        favoriteIds: exists
          ? state.favoriteIds.filter((item) => item !== id)
          : [...state.favoriteIds, id],
      })
      return !exists
    },
    isFavorite(id: string) {
      return state.favoriteIds.includes(id)
    },
    listFavorites() {
      return copy(allContent().filter((item) => state.favoriteIds.includes(item.id)))
    },
    listClassics(filter: RegionFilter = {}) {
      return copy(seedClassics.filter((item) => matchesRegion(item, filter)))
    },
    getClassic(id: string) {
      const classic = seedClassics.find((item) => item.id === id)
      return classic ? copy(classic) : undefined
    },
    listActivities(filter: RegionFilter = {}) {
      return copy(
        seedActivities
          .filter((item) => matchesRegion(item, filter))
          .map((item) => ({
            ...item,
            registeredCount:
              item.registeredCount +
              (state.registrations.some((entry) => entry.activityId === item.id) ? 1 : 0),
          })),
      )
    },
    registerActivity(id: string) {
      const activity = getActivity(id)
      const previous = state.registrations.find((item) => item.activityId === id)
      if (previous) return copy(previous)
      if (activity.registeredCount >= activity.capacity) throw new Error('该演示活动名额已满。')
      const registration: Registration = {
        activityId: id,
        registeredAt: new Date().toISOString(),
        isDemo: true,
      }
      commit({ ...state, registrations: [...state.registrations, registration] })
      return copy(registration)
    },
    cancelRegistration(id: string) {
      getActivity(id)
      if (!state.registrations.some((item) => item.activityId === id)) return false
      commit({
        ...state,
        registrations: state.registrations.filter((item) => item.activityId !== id),
      })
      return true
    },
    isRegistered(id: string) {
      return state.registrations.some((item) => item.activityId === id)
    },
    listRegistrations() {
      return copy(state.registrations)
    },
  }
}
export type DemoRepository = ReturnType<typeof createDemoRepository>
