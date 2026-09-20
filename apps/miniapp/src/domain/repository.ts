import {
  channels,
  genres,
  regions,
  seedActivities,
  seedClassics,
  seedWorks,
  themes,
} from './fixtures'
import type {
  DemoStorage,
  AttachmentMeta,
  DemoNotification,
  DemoCertificate,
  ReviewInput,
  ReviewRecord,
  WorkStatus,
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
  notifications: DemoNotification[]
  certificates: DemoCertificate[]
}
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const emptyState = (): StoredState => ({
  version: 1,
  sequence: 0,
  draft: null,
  submissions: [],
  favoriteIds: [],
  registrations: [],
  notifications: [],
  certificates: [],
})
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const validRegion = (value: unknown) => regions.some((item) => item.id === value)
const validGenre = (value: unknown) => genres.some((item) => item.id === value)
const validChannel = (value: unknown) => channels.some((item) => item.id === value)

export const statusLabels: Record<WorkStatus, string> = {
  pending_initial_review: '待初审（演示）',
  in_review: '评审中（演示）',
  returned: '退回修改（演示）',
  shortlisted: '已入围（演示）',
  awarded: '已获奖（演示）',
  collected: '已入藏（演示）',
}
function isAttachment(value: unknown): value is AttachmentMeta {
  return (
    object(value) &&
    typeof value.id === 'string' &&
    !!value.id &&
    typeof value.name === 'string' &&
    !!value.name.trim() &&
    typeof value.size === 'number' &&
    Number.isFinite(value.size) &&
    value.size >= 0 &&
    value.size <= 10 * 1024 * 1024 &&
    ['image', 'pdf', 'word'].includes(String(value.type))
  )
}
function isReviewRecord(value: unknown): value is ReviewRecord {
  return (
    object(value) &&
    typeof value.id === 'string' &&
    ['return', 'advance', 'shortlist', 'award', 'collect'].includes(String(value.action)) &&
    typeof value.comment === 'string' &&
    typeof value.createdAt === 'string' &&
    Number.isFinite(Date.parse(value.createdAt)) &&
    typeof value.stageIndex === 'number' &&
    Number.isInteger(value.stageIndex) &&
    value.stageIndex >= 0 &&
    value.stageIndex <= 5 &&
    typeof value.submissionRevision === 'number' &&
    value.submissionRevision >= 1 &&
    typeof value.averageScore === 'number' &&
    Number.isFinite(value.averageScore) &&
    object(value.scores) &&
    [value.scores.theme, value.scores.writing, value.scores.originality].every(
      (score) => typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 100,
    )
  )
}
function normalizeDraft(draft: SubmissionDraft): SubmissionDraft {
  const selected = Array.isArray(draft.themes)
    ? draft.themes.filter((id) => themes.some((item) => item.id === id))
    : draft.theme && themes.some((item) => item.id === draft.theme)
      ? [draft.theme]
      : []
  return {
    ...draft,
    themes: [...new Set(selected)].slice(0, 3),
    attachments: Array.isArray(draft.attachments)
      ? draft.attachments.filter(isAttachment).slice(0, 5)
      : [],
    editingWorkId: typeof draft.editingWorkId === 'string' ? draft.editingWorkId : undefined,
  }
}
function normalizeWork(work: Work): Work {
  const selected = Array.isArray(work.themes)
    ? work.themes.filter((id) => themes.some((item) => item.id === id))
    : work.theme && themes.some((item) => item.id === work.theme)
      ? [work.theme]
      : []
  return {
    ...work,
    themes: [...new Set(selected)].slice(0, 3),
    attachments: Array.isArray(work.attachments)
      ? work.attachments.filter(isAttachment).slice(0, 5)
      : [],
    reviews: Array.isArray(work.reviews) ? work.reviews.filter(isReviewRecord) : [],
    revisionNumber:
      Number.isSafeInteger(work.revisionNumber) && (work.revisionNumber ?? 0) > 0
        ? work.revisionNumber
        : 1,
  }
}

export function createEmptyDraft(): SubmissionDraft {
  return {
    title: '',
    content: '',
    genre: 'letter',
    channel: 'community',
    region: 'all',
    author: '',
    copyrightAccepted: false,
    themes: [],
    attachments: [],
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
  const selected = draft.themes ?? (draft.theme ? [draft.theme] : [])
  if (
    !Array.isArray(selected) ||
    selected.length > 3 ||
    selected.some((id) => !themes.some((item) => item.id === id)) ||
    new Set(selected).size !== selected.length
  )
    errors.themes = '请选择最多3个不重复的有效主题。'
  if (
    draft.attachments !== undefined &&
    (!Array.isArray(draft.attachments) ||
      draft.attachments.length > 5 ||
      !draft.attachments.every(isAttachment) ||
      new Set(draft.attachments.map((item) => item.id)).size !== draft.attachments.length)
  )
    errors.attachments = '附件最多5个，单个不超过10MB，仅支持图片、PDF和Word元数据。'
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
    [
      'pending_initial_review',
      'in_review',
      'returned',
      'shortlisted',
      'awarded',
      'collected',
    ].includes(String(value.status)) &&
    typeof value.statusLabel === 'string' &&
    typeof value.submittedAt === 'string' &&
    Number.isFinite(Date.parse(value.submittedAt)) &&
    typeof value.progressIndex === 'number' &&
    Number.isInteger(value.progressIndex) &&
    value.progressIndex >= 0 &&
    value.progressIndex <= 5 &&
    Array.isArray(value.tags) &&
    value.tags.every((tag) => typeof tag === 'string') &&
    typeof value.isMine === 'boolean' &&
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
    draft: isDraft(value.draft) ? normalizeDraft(value.draft) : null,
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
    notifications: Array.isArray(value.notifications)
      ? value.notifications.filter(
          (item): item is DemoNotification =>
            object(item) &&
            typeof item.id === 'string' &&
            typeof item.workId === 'string' &&
            typeof item.title === 'string' &&
            typeof item.content === 'string' &&
            typeof item.createdAt === 'string' &&
            typeof item.read === 'boolean' &&
            item.isDemo === true,
        )
      : [],
    certificates: Array.isArray(value.certificates)
      ? value.certificates.filter(
          (item): item is DemoCertificate =>
            object(item) &&
            typeof item.id === 'string' &&
            typeof item.workId === 'string' &&
            typeof item.title === 'string' &&
            typeof item.author === 'string' &&
            typeof item.awardLabel === 'string' &&
            typeof item.issuedAt === 'string' &&
            item.isDemo === true,
        )
      : [],
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
  const allWorks = () =>
    [
      ...state.submissions,
      ...seedWorks.filter((seed) => !state.submissions.some((item) => item.id === seed.id)),
    ].map(normalizeWork)
  const getRequiredWork = (id: string) => {
    const work = allWorks().find((item) => item.id === id)
    if (!work) throw new Error('未找到演示作品。')
    return work
  }
  const saveWork = (work: Work) => [
    work,
    ...state.submissions.filter((item) => item.id !== work.id),
  ]
  const notification = (work: Work, title: string, content: string): DemoNotification => ({
    id: `DEMO-N-${state.sequence + 1}-${work.id}`,
    workId: work.id,
    title,
    content,
    createdAt: new Date().toISOString(),
    read: false,
    isDemo: true,
  })
  const certificateFor = (work: Work): DemoCertificate => ({
    id: `DEMO-CERT-${work.id}`,
    workId: work.id,
    title: work.title,
    author: work.author,
    awardLabel:
      work.status === 'collected' ? '家风典藏纪念证书（模拟）' : '家风优秀作品证书（模拟）',
    issuedAt: new Date().toISOString(),
    isDemo: true,
  })
  function submitDraft(draft: SubmissionDraft): Work {
    const errors = validateSubmission(draft)
    if (Object.keys(errors).length) throw new SubmissionValidationError(errors)
    const existing = draft.editingWorkId ? getRequiredWork(draft.editingWorkId) : undefined
    if (existing && (!existing.isMine || existing.status !== 'returned'))
      throw new Error('仅本人被退回的作品可以修改重投。')
    let sequence = state.sequence + 1
    const prefix = `DEMO-${Date.now().toString(36).toUpperCase()}`
    let id = existing?.id ?? `${prefix}-${String(sequence).padStart(4, '0')}`
    while (!existing && allWorks().some((item) => item.id === id))
      id = `${prefix}-${String(++sequence).padStart(4, '0')}`
    const content = draft.content.trim()
    const selected = draft.themes ?? (draft.theme ? [draft.theme] : [])
    const author = draft.author?.trim().replace(/（演示投稿）$/, '')
    const work: Work = {
      id,
      title: draft.title.trim(),
      content,
      excerpt: [...content].slice(0, 72).join(''),
      author: author ? `${author}（演示投稿）` : '体验用户（演示投稿）',
      genre: draft.genre,
      channel: draft.channel,
      region: draft.region,
      status: 'pending_initial_review',
      statusLabel: statusLabels.pending_initial_review,
      submittedAt: new Date().toISOString(),
      progressIndex: 0,
      tags: ['本地演示投稿', ...selected.map((id) => themes.find((item) => item.id === id)!.label)],
      isMine: true,
      isDemo: true,
      themes: [...selected],
      attachments: copy(draft.attachments ?? []),
      reviews: existing?.reviews ?? [],
      revisionNumber: (existing?.revisionNumber ?? 0) + 1,
    }
    const message = notification(
      work,
      existing ? '作品已重新提交（模拟）' : '投稿已收到（模拟）',
      existing
        ? '作品保留原编号，已重新进入初审，历史评语保留。'
        : '作品已保存到本机演示库，等待模拟初审。',
    )
    commit({
      ...state,
      sequence,
      draft: null,
      submissions: saveWork(work),
      notifications: [message, ...state.notifications],
    })
    return copy(work)
  }
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
      return copy(allWorks().filter((work) => work.isMine))
    },
    getDraft() {
      return copy(state.draft)
    },
    saveDraft(draft: SubmissionDraft) {
      if (!isDraft(draft)) throw new Error('草稿格式不正确，请检查体裁、通道和地区。')
      const errors = validateSubmission(draft)
      if (errors.themes || errors.attachments)
        throw new SubmissionValidationError({
          themes: errors.themes,
          attachments: errors.attachments,
        })
      const saved = copy(draft)
      commit({ ...state, draft: saved })
      return copy(saved)
    },
    clearDraft() {
      commit({ ...state, draft: null })
    },
    validateSubmission,
    submitWork: submitDraft,
    resubmitWork(id: string, draft: SubmissionDraft) {
      return submitDraft({ ...draft, editingWorkId: id })
    },
    prepareRevision(id: string) {
      const work = getRequiredWork(id)
      if (!work.isMine || work.status !== 'returned')
        throw new Error('仅本人被退回的作品可以修改重投。')
      if (state.draft?.editingWorkId === id) return copy(state.draft)
      const draft: SubmissionDraft = {
        title: work.title,
        content: work.content,
        author: work.author.replace(/（演示投稿）$/, ''),
        genre: work.genre,
        channel: work.channel,
        region: work.region,
        themes: [...(work.themes ?? [])],
        attachments: copy(work.attachments ?? []),
        copyrightAccepted: false,
        editingWorkId: id,
      }
      commit({ ...state, draft })
      return copy(draft)
    },
    listReviewTasks(filter: RegionFilter = {}) {
      return copy(
        allWorks().filter(
          (work) => matchesRegion(work, filter) && !['returned', 'collected'].includes(work.status),
        ),
      )
    },
    listPublicWorks(status?: 'shortlisted' | 'awarded' | 'collected') {
      const included =
        status === 'collected'
          ? ['collected']
          : status === 'awarded'
            ? ['awarded', 'collected']
            : ['shortlisted', 'awarded', 'collected']
      return copy(allWorks().filter((work) => included.includes(work.status)))
    },
    reviewWork(id: string, input: ReviewInput) {
      const work = getRequiredWork(id)
      const actions = ['return', 'advance', 'shortlist', 'award', 'collect']
      if (!actions.includes(input.action)) throw new Error('请选择有效的评审操作。')
      if (
        !input.scores ||
        [input.scores.theme, input.scores.writing, input.scores.originality].some(
          (score) => !Number.isFinite(score) || score < 0 || score > 100,
        )
      )
        throw new Error('每项评分须为0–100之间的数字。')
      if (
        typeof input.comment !== 'string' ||
        input.comment.trim().length < 5 ||
        input.comment.trim().length > 1000
      )
        throw new Error('请填写5–1000字的评审意见。')
      if (['returned', 'collected'].includes(work.status))
        throw new Error('该作品当前不能继续评审。')
      if (
        input.action === 'return' &&
        !['pending_initial_review', 'in_review'].includes(work.status)
      )
        throw new Error('仅审核中的作品可以退回修改。')
      if (
        input.action === 'advance' &&
        !['pending_initial_review', 'in_review'].includes(work.status)
      )
        throw new Error('该作品已完成层级评审。')
      if (
        input.action === 'shortlist' &&
        (!['pending_initial_review', 'in_review'].includes(work.status) || work.progressIndex !== 5)
      )
        throw new Error('完成前五级评审后方可确认入围。')
      if (input.action === 'award' && work.status !== 'shortlisted')
        throw new Error('只有入围作品可以模拟授奖。')
      if (input.action === 'collect' && work.status !== 'awarded')
        throw new Error('只有已获奖作品可以模拟入藏。')
      const status: WorkStatus =
        input.action === 'return'
          ? 'returned'
          : input.action === 'award'
            ? 'awarded'
            : input.action === 'collect'
              ? 'collected'
              : input.action === 'shortlist' || work.progressIndex === 5
                ? 'shortlisted'
                : 'in_review'
      const progressIndex =
        input.action === 'advance' ? Math.min(5, work.progressIndex + 1) : work.progressIndex
      const entry = {
        ...copy(input),
        comment: input.comment.trim(),
        reviewer: input.reviewer?.trim() || '演示评审员（虚构）',
        id: `DEMO-R-${state.sequence + 1}-${id}`,
        stageIndex: work.progressIndex,
        createdAt: new Date().toISOString(),
        submissionRevision: work.revisionNumber ?? 1,
        averageScore:
          Math.round(
            ((input.scores.theme + input.scores.writing + input.scores.originality) / 3) * 10,
          ) / 10,
      }
      const updated: Work = {
        ...work,
        status,
        statusLabel: statusLabels[status],
        progressIndex,
        reviews: [...(work.reviews ?? []), entry],
      }
      const message = notification(updated, statusLabels[status], entry.comment)
      const certificates = ['awarded', 'collected'].includes(status)
        ? [certificateFor(updated), ...state.certificates.filter((item) => item.workId !== id)]
        : state.certificates
      commit({
        ...state,
        sequence: state.sequence + 1,
        submissions: saveWork(updated),
        notifications: [message, ...state.notifications],
        certificates,
      })
      return copy(updated)
    },
    listNotifications() {
      return copy(
        state.notifications.filter((item) =>
          allWorks().some((work) => work.id === item.workId && work.isMine),
        ),
      )
    },
    markNotificationRead(id: string) {
      if (!state.notifications.some((item) => item.id === id))
        throw new Error('未找到这条演示消息。')
      commit({
        ...state,
        notifications: state.notifications.map((item) =>
          item.id === id ? { ...item, read: true } : item,
        ),
      })
    },
    listCertificates() {
      return copy(
        state.certificates.filter((item) =>
          allWorks().some((work) => work.id === item.workId && work.isMine),
        ),
      )
    },
    getCertificate(workId: string) {
      const certificate = state.certificates.find((item) => item.workId === workId)
      return certificate ? copy(certificate) : undefined
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
