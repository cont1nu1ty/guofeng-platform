import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  aiMode,
  boundedAiHistory,
  citationTarget,
  validateManuscript,
  waitForAiTask,
  type AiTask,
} from '../src/domain/aiTasks'
import { createAssistantDraft } from '../src/domain/assistantExamples'
const queued: AiTask = {
  id: 'task-1',
  mode: 'letter',
  status: 'queued',
  createdAt: '2026-10-13T00:00:00Z',
}

describe('AI task lifecycle', () => {
  it('creates a model-result draft without sample labels or automatic copyright confirmation', () => {
    const draft = createAssistantDraft('ocr', '经过人工校对的祖父手稿', 'beijing', 'zh', 'model')
    expect(draft.title).toBe('家训手记')
    expect(draft.copyrightAccepted).toBe(false)
    expect(draft.editingWorkId).toBeUndefined()
    expect(createAssistantDraft('ocr', '演示手稿', 'beijing').title).toContain('示例')
  })
  it('bounds multi-turn history by server limits while retaining the latest context', () => {
    const messages = Array.from({ length: 18 }, (_, i) => ({
      role: (i % 2 ? 'assistant' : 'user') as 'user' | 'assistant',
      text: String(i) + '正文'.repeat(5000),
    }))
    const history = boundedAiHistory(messages)
    expect(history.length).toBeLessThanOrEqual(12)
    expect(history.reduce((sum, item) => sum + item.content.length, 0)).toBeLessThanOrEqual(16000)
    expect(history.every((item) => item.content.length <= 6000)).toBe(true)
    expect(history.at(-1)?.content.startsWith('17')).toBe(true)
  })
  it('opens only allowlisted public source routes, never model-generated external URLs', () => {
    expect(citationTarget('/#/pkg-content/pages/index?screen=library&id=classic-1')).toEqual({
      screen: 'library',
      id: 'classic-1',
    })
    for (const url of [
      'https://external.example/?screen=library&id=classic-1',
      'javascript:alert(1)',
      '/#/pkg-content/pages/index?screen=admin&id=private',
      '/#/pkg-content/pages/index?screen=library&id=%',
    ])
      expect(citationTarget(url)).toBeUndefined()
  })
  it('polls queued/running tasks and returns only the confirmed result', async () => {
    const states: string[] = []
    const read = vi
      .fn()
      .mockResolvedValueOnce({ ...queued, status: 'running' })
      .mockResolvedValueOnce({ ...queued, status: 'succeeded', result: '一封真实生成的家书' })
    const result = await waitForAiTask(queued, {
      read,
      active: () => true,
      delay: async () => {},
      onTask: (task) => states.push(task.status),
    })
    expect(states).toEqual(['queued', 'running', 'succeeded'])
    expect(result.result).toBe('一封真实生成的家书')
  })
  it('propagates a model failure without generating fallback success', async () => {
    await expect(
      waitForAiTask(
        {
          ...queued,
          status: 'failed',
          error: { code: 'PROVIDER_UNAVAILABLE', message: '模型不可达，输入保留' },
        },
        { read: vi.fn(), active: () => true },
      ),
    ).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE', message: '模型不可达，输入保留' })
  })
  it('discards a late result after cancel or account change', async () => {
    let active = true
    const observed: string[] = []
    await expect(
      waitForAiTask(queued, {
        active: () => active,
        delay: async () => {},
        read: async () => {
          active = false
          return { ...queued, status: 'succeeded', result: '旧账号私有内容' }
        },
        onTask: (task) => observed.push(task.status),
      }),
    ).rejects.toMatchObject({ code: 'CANCELLED' })
    expect(observed).toEqual(['queued'])
  })
  it('stops polling before another request when cancelled during the interval', async () => {
    let active = true
    const read = vi.fn()
    await expect(
      waitForAiTask(queued, {
        read,
        active: () => active,
        delay: async () => {
          active = false
        },
      }),
    ).rejects.toMatchObject({ code: 'CANCELLED' })
    expect(read).not.toHaveBeenCalled()
  })
  it('bounds waiting while allowing later history recovery', async () => {
    let now = 0
    await expect(
      waitForAiTask(queued, {
        read: async () => queued,
        active: () => true,
        now: () => now,
        timeoutMs: 1200,
        delay: async () => {
          now += 1200
        },
      }),
    ).rejects.toMatchObject({ code: 'AI_TIMEOUT' })
  })
  it('maps supported assistant tools and keeps video generation unavailable', () => {
    expect(aiMode('rules')).toBe('family')
    expect(aiMode('help')).toBe('support')
    expect(aiMode('compliance')).toBe('review')
    expect(aiMode('storyboard')).toBeUndefined()
  })
  it('accepts Chinese manuscript filenames and rejects oversize, empty and unsupported files', () => {
    expect(() => validateManuscript('祖父的家书.PNG', 10 * 1024 * 1024)).not.toThrow()
    expect(() => validateManuscript('扫描件.pdf', 1200)).not.toThrow()
    for (const [name, size] of [
      ['手稿.pdf', 0],
      ['手稿.jpg', 10485761],
      ['伪装.png.exe', 1200],
      ['手稿.docx', 1200],
    ] as [string, number][])
      expect(() => validateManuscript(name, size)).toThrow()
  })
})

interface Call {
  url: string
  data: any
  header: Record<string, string>
  success: (value: any) => void
  fail: () => void
}
let calls: Call[] = []
let handle: (value: Call) => void
const respond = (call: Call, data: unknown, statusCode = 200) =>
  call.success({ data, statusCode, header: {} })
beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_DATA_MODE', 'http')
  vi.stubEnv('VITE_API_BASE_URL', 'https://pilot.example/api/v1')
  calls = []
  handle = (call) => respond(call, {})
  vi.stubGlobal('uni', {
    getStorageSync: () => 'test-session',
    setStorageSync: vi.fn(),
    removeStorageSync: vi.fn(),
    request(call: Call) {
      calls.push(call)
      handle(call)
    },
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
describe('AI HTTP adapter reliability', () => {
  const input = { mode: 'letter' as const, prompt: '给父亲写一封家书', language: 'zh' as const }
  it('reuses idempotency keys after an ambiguous creation failure', async () => {
    const ai = await import('../src/services/ai')
    handle = (call) => call.fail()
    await expect(ai.runAiTask(input, ai.createAiOperation())).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    })
    handle = (call) => respond(call, { ...queued, status: 'succeeded', result: '已完成' })
    await expect(ai.runAiTask(input, ai.createAiOperation())).resolves.toMatchObject({
      result: '已完成',
    })
    expect(calls).toHaveLength(2)
    expect(calls[1]!.header['Idempotency-Key']).toBe(calls[0]!.header['Idempotency-Key'])
  })
  it('allows a fresh attempt after a terminal provider failure', async () => {
    const ai = await import('../src/services/ai')
    handle = (call) =>
      respond(call, {
        ...queued,
        status: 'failed',
        error: { code: 'PROVIDER_ERROR', message: '未生成' },
      })
    await expect(ai.runAiTask(input, ai.createAiOperation())).rejects.toMatchObject({
      code: 'PROVIDER_ERROR',
    })
    handle = (call) => respond(call, { ...queued, status: 'succeeded', result: '重试完成' })
    await ai.runAiTask(input, ai.createAiOperation())
    expect(calls[1]!.header['Idempotency-Key']).not.toBe(calls[0]!.header['Idempotency-Key'])
  })
  it('rejects a previous account task response after a new login', async () => {
    const ai = await import('../src/services/ai')
    const api = await import('../src/services/api')
    let delayed: Call | undefined
    handle = (call) => {
      if (call.url.endsWith('/ai/tasks')) delayed = call
      else if (call.url.endsWith('/auth/login'))
        respond(call, {
          token: 'second-session',
          user: { id: 'member-2', name: '第二用户', roles: ['member'], regionIds: [] },
        })
      else respond(call, {})
    }
    const pending = ai.runAiTask(input, ai.createAiOperation())
    await api.signInRemote('second', 'password')
    respond(delayed!, { ...queued, status: 'succeeded', result: '不应泄漏的原账户内容' })
    await expect(pending).rejects.toMatchObject({ code: 'CANCELLED' })
  })
  it('lists and reads the current user task without workspace fallback', async () => {
    const ai = await import('../src/services/ai')
    handle = (call) =>
      respond(
        call,
        call.url.endsWith('/ai/tasks')
          ? { items: [queued] }
          : { ...queued, status: 'succeeded', result: '我的记录' },
      )
    expect(await ai.listAiTasks()).toEqual([queued])
    expect(await ai.readAiTask(queued.id)).toMatchObject({ result: '我的记录' })
    expect(calls.map((call) => call.url)).toEqual([
      'https://pilot.example/api/v1/ai/tasks',
      'https://pilot.example/api/v1/ai/tasks/task-1',
    ])
  })
})
