import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface Call {
  url: string
  method: string
  data?: any
  header?: Record<string, string>
  success: (response: any) => void
  fail: () => void
}
let calls: Call[]
let handle: (call: Call) => void
let storage: Map<string, string>
const respond = (call: Call, data: unknown, statusCode = 200, header = {}) =>
  call.success({ statusCode, data, header })
const draft = {
  title: '给未来的一封家书',
  content: '愿你记得家人教导的诚实勤俭，在每一天认真待人和做事。',
  genre: 'letter' as const,
  channel: 'community' as const,
  region: 'beijing' as const,
  copyrightAccepted: true,
  themes: [],
  attachments: [],
}
beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_DATA_MODE', 'http')
  vi.stubEnv('VITE_API_BASE_URL', 'https://pilot.example/api/v1')
  calls = []
  storage = new Map()
  handle = (call) => respond(call, {})
  vi.stubGlobal('uni', {
    getStorageSync: (key: string) => storage.get(key),
    setStorageSync: (key: string, value: string) => storage.set(key, value),
    removeStorageSync: (key: string) => storage.delete(key),
    request: (call: Call) => {
      calls.push(call)
      handle(call)
    },
    uploadFile: (call: Call) => {
      calls.push(call)
      handle(call)
    },
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
describe('HTTP mode isolation and persistence boundaries', () => {
  it('reads versioned scoring rules from the server and never fills absent rules with demo criteria', async () => {
    const api = await import('../src/services/api')
    expect(api.remoteWorkspace.scoringDimensions).toEqual([])
    const dimensions = [30, 30, 25, 15].map((max, index) => ({
      id: `d-${index}`,
      label: `维度${index}`,
      max,
    }))
    api.applyWorkspace({ scoringDimensions: dimensions, reviewRuleVersion: 'pilot-v2' })
    expect(api.remoteWorkspace.scoringDimensions).toEqual(dimensions)
    expect(api.remoteWorkspace.reviewRuleVersion).toBe('pilot-v2')
    api.applyWorkspace({ works: [] })
    expect(api.remoteWorkspace.scoringDimensions).toEqual([])
    expect(api.remoteWorkspace.reviewRuleVersion).toBe('')
  })
  it('keeps published news in the four supported topics and defaults older records to everyday', async () => {
    const api = await import('../src/services/api')
    const { familyTopics, newsArticles } = await import('../src/domain/contentCatalog')
    api.applyWorkspace({
      news: [
        ...familyTopics.map(({ id }) => ({
          id,
          topic: id,
          title: `专题${id}`,
          category: '资讯',
          summary: '专题摘要',
          body: '专题正文',
        })),
        { id: 'older-record', title: '未指定专题的资讯', category: '资讯', body: '正文' },
      ] as any,
    })
    for (const { id } of familyTopics)
      expect(newsArticles.filter((item) => item.topic === id).map((item) => item.id)).toContain(id)
    expect(newsArticles.find((item) => item.id === 'older-record')?.topic).toBe('everyday')
  })
  it('keeps unpublished and withdrawn decisions in personal progress, outside public results', async () => {
    const api = await import('../src/services/api')
    const { createRemoteRepository } = await import('../src/domain/remoteRepository')
    const repo = createRemoteRepository()
    const decisions = ['shortlisted', 'awarded', 'collected'] as const
    api.applyWorkspace({
      works: decisions.flatMap((status) => [
        { id: `${status}-public`, status, published: true, isMine: false },
        { id: `${status}-private`, status, published: false, isMine: true },
      ]) as any,
    })
    expect(repo.listPublicWorks().map((work) => work.id)).toEqual(
      decisions.map((status) => `${status}-public`),
    )
    for (const status of decisions) {
      expect(repo.listPublicWorks(status).map((work) => work.id)).toEqual([`${status}-public`])
      expect(repo.getWork(`${status}-private`)).toMatchObject({ status, isMine: true })
    }
    expect(repo.listMyWorks()).toHaveLength(3)
    api.remoteWorkspace.works[0]!.published = false
    expect(repo.listPublicWorks('shortlisted')).toEqual([])
    // Missing publication confirmation must also remain private in HTTP mode.
    delete api.remoteWorkspace.works[2]!.published
    expect(repo.listPublicWorks('awarded')).toEqual([])
  })
  it('never shows local sample records after a workspace network failure', async () => {
    const api = await import('../src/services/api')
    handle = (call) => call.fail()
    await api.initializeRemote()
    expect(api.remoteError.value).toContain('无法连接服务')
    expect(api.remoteWorkspace.works).toEqual([])
    expect((await import('../src/domain/contentCatalog')).newsArticles).toEqual([])
  })
  it('sends the real session token and clears account-owned data on expiry', async () => {
    const api = await import('../src/services/api')
    handle = (call) =>
      call.url.endsWith('/auth/login')
        ? respond(call, {
            token: 'member-token',
            user: { id: 'member-a', name: '甲', roles: ['member'], regionIds: ['beijing'] },
          })
        : respond(call, { ...api.emptyWorkspace(), favorites: ['private-work'] })
    await api.signInRemote('member-a', 'password')
    expect(calls[0]!.data).toEqual({ username: 'member-a', password: 'password', client: 'member' })
    expect(calls[1]!.header?.Authorization).toBe('Bearer member-token')
    handle = (call) =>
      respond(call, { code: 'SESSION_EXPIRED', message: '会话已过期', requestId: 'r1' }, 401)
    await expect(api.command('favorite.toggle', 'private-work')).rejects.toMatchObject({
      status: 401,
      requestId: 'r1',
    })
    expect(api.remoteUser.value).toBeNull()
    expect(api.remoteWorkspace.favorites).toEqual([])
    expect(storage.has('jiafeng:http:token')).toBe(false)
  })
  it('uses ETag for cloud draft changes and preserves the last confirmed draft on conflicts', async () => {
    const api = await import('../src/services/api')
    handle = (call) => respond(call, { draft }, 200, { ETag: '"7"' })
    await api.loadRemoteDraft()
    handle = (call) => respond(call, { code: 'VERSION_CONFLICT', message: '草稿已被更新' }, 412)
    await expect(api.saveRemoteDraft({ ...draft, title: '尚未保存的编辑' })).rejects.toMatchObject({
      status: 412,
    })
    expect(calls.at(-1)?.header?.['If-Match']).toBe('"7"')
    expect(api.remoteDraft.value?.title).toBe(draft.title)
  })
  it('reuses an idempotency key after an uncertain submit and clears the draft only after acceptance', async () => {
    const api = await import('../src/services/api')
    api.remoteDraft.value = draft
    handle = (call) => call.fail()
    await expect(api.submitRemote(draft)).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
    const key = calls[0]!.header!['Idempotency-Key']
    expect(api.remoteDraft.value).not.toBeNull()
    handle = (call) =>
      call.url.endsWith('/submissions')
        ? respond(call, {
            id: 'S-1',
            ...draft,
            version: 1,
            revisionNumber: 1,
            isMine: true,
            isDemo: false,
          })
        : call.url.endsWith('/me/draft')
          ? respond(call, { draft: null }, 200, { ETag: '"8"' })
          : respond(call, api.emptyWorkspace())
    const work = await api.submitRemote(draft)
    expect(calls[1]!.header?.['Idempotency-Key']).toBe(key)
    expect(work.id).toBe('S-1')
    expect(api.remoteDraft.value).toBeNull()
  })
  it('refreshes the cloud draft version after accepted submission and preserves a newer device draft', async () => {
    const api = await import('../src/services/api')
    handle = (call) => respond(call, { draft }, 200, { ETag: '"7"' })
    await api.loadRemoteDraft()
    const newer = { ...draft, title: '另一台设备的新稿' }
    handle = (call) => {
      if (call.url.endsWith('/submissions')) respond(call, { id: 'S-2', ...draft, version: 1 })
      else if (call.url.endsWith('/me/draft')) respond(call, { draft: newer }, 200, { ETag: '"9"' })
      else respond(call, api.emptyWorkspace())
    }
    await api.submitRemote(draft)
    expect(api.remoteDraft.value?.title).toBe(newer.title)
    await api.saveRemoteDraft({ ...newer, title: '继续编辑新稿' })
    expect(calls.at(-1)?.header?.['If-Match']).toBe('"9"')
    expect(calls.filter((call) => call.method === 'DELETE')).toHaveLength(0)
  })
  it('uploads through uni.uploadFile with a bearer token and returns only a confirmed server file id', async () => {
    const api = await import('../src/services/api')
    handle = (call) =>
      call.url.endsWith('/auth/login')
        ? respond(call, {
            token: 'token',
            user: { id: 'a', name: '甲', roles: ['member'], regionIds: ['beijing'] },
          })
        : respond(call, api.emptyWorkspace())
    await api.signInRemote('a', 'p')
    handle = (call) =>
      respond(
        call,
        JSON.stringify({ fileId: 'F-1', name: '家书.pdf', size: 123, type: 'pdf' }),
        201,
      )
    expect(await api.uploadRemoteFile('/tmp/selected.pdf', '家书.pdf')).toMatchObject({
      fileId: 'F-1',
    })
    expect(calls.at(-1)?.header?.Authorization).toBe('Bearer token')
    expect(calls.at(-1)).toMatchObject({ name: 'file', filePath: '/tmp/selected.pdf' })
  })
  it('does not let an old workspace response expose the previous account after logout', async () => {
    const api = await import('../src/services/api')
    let pending: Call | undefined
    handle = (call) => {
      pending = call
    }
    const first = api.refreshWorkspace()
    handle = (call) => respond(call, api.emptyWorkspace())
    await api.signOutRemote()
    respond(pending!, { ...api.emptyWorkspace(), favorites: ['previous-account-private-record'] })
    await first
    expect(api.remoteWorkspace.favorites).toEqual([])
  })
  it('clears local credentials and private records when the server cannot confirm logout', async () => {
    const api = await import('../src/services/api')
    handle = (call) =>
      call.url.endsWith('/auth/login')
        ? respond(call, {
            token: 'old-token',
            user: { id: 'a', name: '甲', roles: ['member'], regionIds: ['beijing'] },
          })
        : respond(call, { ...api.emptyWorkspace(), favorites: ['private'] })
    await api.signInRemote('a', 'p')
    handle = (call) => call.fail()
    await expect(api.signOutRemote()).rejects.toMatchObject({ code: 'LOGOUT_UNCONFIRMED' })
    expect(api.remoteUser.value).toBeNull()
    expect(api.remoteWorkspace.favorites).toEqual([])
    expect(storage.has('jiafeng:http:token')).toBe(false)
    expect(api.remoteError.value).toContain('已退出当前设备')
  })
  it('retries a member command with the same key, then gives a new intentional operation a new key', async () => {
    const api = await import('../src/services/api')
    handle = (call) => call.fail()
    await expect(api.command('welfare.claim', 'P-1', { quantity: 1 })).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    })
    const firstKey = calls.at(-1)!.header!['Idempotency-Key']
    handle = (call) => respond(call, { workspace: api.emptyWorkspace(), result: { id: 'C-1' } })
    await api.command('welfare.claim', 'P-1', { quantity: 1 })
    expect(calls.at(-1)!.header!['Idempotency-Key']).toBe(firstKey)
    await api.command('welfare.claim', 'P-1', { quantity: 1 })
    expect(calls.at(-1)!.header!['Idempotency-Key']).not.toBe(firstKey)
  })
  it('counts a published course without a quiz as complete after all real lessons', async () => {
    const api = await import('../src/services/api')
    api.applyWorkspace({
      courses: [
        {
          id: 'course-1',
          title: '后台课程',
          description: '课程正文',
          duration: 10,
          lessons: [{ id: 'intro', title: '导读', body: '正文' }],
        } as any,
      ],
      learning: {
        courses: {
          'course-1': {
            lessons: ['intro'],
            quizPassed: false,
            completedAt: '2026-09-26T00:00:00Z',
          },
        },
        checkIns: {},
      },
    })
    const learning = await import('../src/composables/useLearningProgress')
    expect(learning.getCourseProgress('course-1')).toMatchObject({ percent: 100, complete: true })
  })
  it('loads real catalogues and clears every private catalogue field on logout without local fallbacks', async () => {
    const api = await import('../src/services/api')
    const catalog = await import('../src/domain/showcaseCatalog')
    const content = await import('../src/domain/contentCatalog')
    const { locale } = await import('../src/composables/useLocale')
    api.applyWorkspace({
      mediaItems: [
        { id: 'm-zh', title: '中文', language: 'zh', source: '/api/v1/files/f/public' },
        { id: 'm-en', title: 'English', language: 'en' },
      ],
      venues: [{ id: 'v', title: '阵地', language: 'zh' }],
      hallPeople: [{ id: 'h', title: '人物', language: 'zh' }],
      mediaSubmissions: [
        { id: 'private-m', title: '退回稿', reviewNote: '修改声音', lockVersion: 2 },
      ],
      supportTickets: [{ id: 'private-ticket', body: '本人问题' }],
      newsPreferences: {
        categories: ['industry'],
        updates: true,
        digest: 'instant',
        quietHours: true,
      },
    } as any)
    expect(catalog.mediaCatalog.map((x) => x.id)).toEqual(['m-zh'])
    locale.value = 'en'
    expect(catalog.mediaCatalog.map((x) => x.id)).toEqual(['m-en'])
    expect(content.venues).toEqual([])
    expect(catalog.hallPeople).toEqual([])
    handle = (call) => respond(call, api.emptyWorkspace())
    await api.signOutRemote()
    expect(catalog.mediaCatalog).toEqual([])
    expect(api.remoteWorkspace.mediaSubmissions).toEqual([])
    expect(api.remoteWorkspace.supportTickets).toEqual([])
    expect(api.remoteWorkspace.newsPreferences).toEqual({
      categories: [],
      updates: false,
      digest: 'instant',
      quietHours: true,
    })
    expect(api.remoteWorkspace.homeStats).toBeNull()
  })
  it('maps industry subscription categories and isolates cloud preferences from device demo data', async () => {
    const api = await import('../src/services/api')
    const prefs = await import('../src/pkg-content/composables/useNewsPreferences')
    storage.set(
      'jiafeng:news-preferences:v1',
      JSON.stringify({ categories: ['policy'], updates: true, digest: 'daily', quietHours: false }),
    )
    expect(prefs.newsPreferences.value.categories).toEqual([])
    api.remoteUser.value = { id: 'member', name: '用户', roles: ['member'], regionIds: ['beijing'] }
    handle = (call) =>
      respond(call, { workspace: { ...api.emptyWorkspace(), newsPreferences: call.data.data } })
    expect(await prefs.toggleNewsCategory('industry')).toBe(true)
    expect(calls.at(-1)?.data).toMatchObject({
      command: 'news.preferences',
      data: { categories: ['industry'], digest: 'instant' },
    })
    expect(prefs.newsPreferences.value.categories).toEqual(['industry'])
    api.applyWorkspace({
      news: [{ id: 'industry', title: '行业报道', category: '行业动态', language: 'zh' }] as any,
    })
    expect(api.remoteWorkspace.news[0]?.category).toBe('industry')
  })
  it('uploads media with an explicit purpose and keeps normal submission uploads unchanged', async () => {
    storage.set('jiafeng:http:token', 'member-token')
    const api = await import('../src/services/api')
    handle = (call) =>
      respond(
        call,
        JSON.stringify({ fileId: 'media-file', name: '朗诵.mp3', type: 'audio', size: 128 }),
        201,
      )
    await api.uploadRemoteFile<'audio'>('/tmp/朗诵.mp3', '朗诵.mp3', 'media')
    expect(calls.at(-1)?.url).toBe('https://pilot.example/api/v1/files?purpose=media')
    expect(calls.at(-1)?.header?.Authorization).toBe('Bearer member-token')
    await api.uploadRemoteFile('/tmp/材料.pdf', '材料.pdf')
    expect(calls.at(-1)?.url).toBe('https://pilot.example/api/v1/files')
    handle = (call) =>
      respond(call, JSON.stringify({ code: 'FILE_TYPE_INVALID', message: '文件类型不符' }), 422)
    await expect(
      api.uploadRemoteFile<'audio'>('/tmp/bad.mp3', 'bad.mp3', 'media'),
    ).rejects.toMatchObject({ code: 'FILE_TYPE_INVALID' })
  })
  it('preserves a selected Chinese media filename in H5 multipart uploads instead of a blob-generated name', async () => {
    storage.set('jiafeng:http:token', 'member-token')
    const api = await import('../src/services/api')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new Blob(['MP4 media'], { type: 'video/mp4' }))),
    )
    handle = (call) =>
      respond(
        call,
        JSON.stringify({ fileId: 'F-CN', name: '家风演绎.mp4', size: 9, type: 'video' }),
        201,
      )
    await api.uploadRemoteFile<'video'>('blob:chosen-media', '家风演绎.mp4', 'media')
    const upload = calls.at(-1) as any
    expect(upload.file.name).toBe('家风演绎.mp4')
    expect(upload.file.type).toBe('video/mp4')
    expect(upload.name).toBe('file')
    expect(upload.header.Authorization).toBe('Bearer member-token')
  })
  it('normalizes the existing Chinese and English news language labels before edition filtering', async () => {
    const api = await import('../src/services/api')
    const { newsArticles } = await import('../src/domain/contentCatalog')
    const { locale } = await import('../src/composables/useLocale')
    api.applyWorkspace({
      news: [
        { id: 'cn', title: '中文资讯', language: '中文', region: '浙江', regionId: 'zhejiang' },
        { id: 'en', title: 'English update', language: 'English' },
        { id: 'en-alias', title: 'Another English update', language: '英文' },
      ] as any,
    })
    expect(newsArticles.map((x) => x.id)).toEqual(['cn'])
    expect(newsArticles[0]?.region).toBe('zhejiang')
    locale.value = 'en'
    expect(newsArticles.map((x) => x.id)).toEqual(['en', 'en-alias'])
    expect(newsArticles[0]?.title).toEqual({ zh: '', en: 'English update' })
  })
  it('matches every existing editorial category to the same subscription category used by notifications', async () => {
    const api = await import('../src/services/api')
    const mapping = {
      公告: 'notice',
      Banner: 'notice',
      政策解读: 'policy',
      行业动态: 'industry',
      活动报道: 'activity',
      榜样人物: 'role-model',
      资讯: 'activity',
      专题: 'role-model',
    }
    api.applyWorkspace({
      news: Object.keys(mapping).map((category) => ({
        id: category,
        title: category,
        category,
        language: '中文',
      })) as any,
    })
    expect(Object.fromEntries(api.remoteWorkspace.news.map((x) => [x.id, x.category]))).toEqual(
      mapping,
    )
  })
})
