import { describe, expect, it, vi } from 'vitest'
import {
  createDemoRepository,
  createEmptyDraft,
  DEMO_STORAGE_KEY,
  DemoStorageError,
  seedActivities,
  seedClassics,
  seedWorks,
  SubmissionValidationError,
  validateSubmission,
} from '../src/domain/repository'
import type { DemoStorage, SubmissionDraft } from '../src/domain/types'

function memoryStorage(initial?: string): DemoStorage {
  const values = new Map<string, string>(initial === undefined ? [] : [[DEMO_STORAGE_KEY, initial]])
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
  }
}
const validDraft = (): SubmissionDraft => ({
  ...createEmptyDraft(),
  title: '给家人的一封信',
  content: '这是用于演示投稿流程的原创测试正文，记录家人之间互相理解和认真倾听的故事。',
  copyrightAccepted: true,
  region: 'zhejiang',
})

describe('本地演示仓库', () => {
  it('恢复未完成草稿，并隔离调用者对返回对象的修改', () => {
    const storage = memoryStorage()
    const repo = createDemoRepository(storage)
    const draft = { ...createEmptyDraft(), title: '未完成的家书' }
    repo.saveDraft(draft)
    draft.title = '外部修改'
    const restored = createDemoRepository(storage)
    expect(restored.getDraft()?.title).toBe('未完成的家书')
    const read = restored.getDraft()!
    read.title = '读取后的修改'
    expect(restored.getDraft()?.title).toBe('未完成的家书')
    restored.clearDraft()
    expect(createDemoRepository(storage).getDraft()).toBeNull()
  })

  it('校验标题字数、正文长度和版权同意，并阻止不完整投稿', () => {
    expect(validateSubmission(createEmptyDraft())).toMatchObject({
      title: expect.any(String),
      content: expect.any(String),
      copyrightAccepted: expect.any(String),
    })
    expect(validateSubmission({ ...validDraft(), title: '一' })).toHaveProperty('title')
    expect(validateSubmission({ ...validDraft(), title: '字'.repeat(51) })).toHaveProperty('title')
    expect(validateSubmission({ ...validDraft(), content: ' '.repeat(30) })).toHaveProperty(
      'content',
    )
    expect(
      validateSubmission({ ...validDraft(), title: '字'.repeat(50), content: '字'.repeat(20) }),
    ).toEqual({})
    const repo = createDemoRepository(memoryStorage())
    expect(() => repo.submitWork(createEmptyDraft())).toThrow(SubmissionValidationError)
    expect(repo.listMyWorks()).toEqual([])
  })

  it('生成唯一编号、进入待初审，并在成功提交后清空草稿', () => {
    const storage = memoryStorage()
    const repo = createDemoRepository(storage)
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1800000000000)
    try {
      repo.saveDraft(validDraft())
      const first = repo.submitWork(validDraft())
      const second = repo.submitWork(validDraft())
      const reloaded = createDemoRepository(storage)
      const third = reloaded.submitWork(validDraft())
      expect(new Set([first.id, second.id, third.id]).size).toBe(3)
      expect(first.id).toMatch(/^DEMO-/)
      expect(first).toMatchObject({
        status: 'pending_initial_review',
        progressIndex: 0,
        isMine: true,
        isDemo: true,
      })
      expect(reloaded.listMyWorks()).toHaveLength(3)
      expect(reloaded.getDraft()).toBeNull()
      expect(reloaded.listWorks()).toHaveLength(seedWorks.length + 3)
    } finally {
      clock.mockRestore()
    }
  })

  it('按地区、体裁与通道组合过滤，全国包含所有地区', () => {
    const repo = createDemoRepository(memoryStorage())
    expect(repo.listWorks({ region: 'all' })).toHaveLength(seedWorks.length)
    expect(repo.listWorks({ region: 'beijing' }).every((work) => work.region === 'beijing')).toBe(
      true,
    )
    expect(
      repo
        .listWorks({ region: 'beijing', genre: 'essay', channel: 'school' })
        .map((work) => work.id),
    ).toEqual(['DEMO-WORK-002'])
    expect(repo.listWorks({ region: 'sichuan', genre: 'letter' })).toEqual([])
    expect(repo.listActivities({ region: 'zhejiang' })).toHaveLength(1)
  })

  it('作品和典籍收藏可持久化、切换，并拒绝未知内容', () => {
    const storage = memoryStorage()
    const repo = createDemoRepository(storage)
    expect(repo.toggleFavorite(seedWorks[0].id)).toBe(true)
    expect(repo.toggleFavorite(seedClassics[0].id)).toBe(true)
    const reloaded = createDemoRepository(storage)
    expect(reloaded.listFavorites()).toHaveLength(2)
    expect(reloaded.isFavorite(seedWorks[0].id)).toBe(true)
    expect(reloaded.toggleFavorite(seedWorks[0].id)).toBe(false)
    expect(createDemoRepository(storage).listFavorites()).toHaveLength(1)
    expect(() => reloaded.toggleFavorite('unknown')).toThrow('未找到')
  })

  it('活动报名幂等、持久化，取消后可重新报名且人数正确', () => {
    const storage = memoryStorage()
    const repo = createDemoRepository(storage)
    const activity = seedActivities[0]
    const first = repo.registerActivity(activity.id)
    expect(repo.registerActivity(activity.id)).toEqual(first)
    expect(repo.listRegistrations()).toHaveLength(1)
    expect(repo.listActivities().find((item) => item.id === activity.id)?.registeredCount).toBe(
      activity.registeredCount + 1,
    )
    const reloaded = createDemoRepository(storage)
    expect(reloaded.isRegistered(activity.id)).toBe(true)
    expect(reloaded.cancelRegistration(activity.id)).toBe(true)
    expect(reloaded.cancelRegistration(activity.id)).toBe(false)
    expect(reloaded.listActivities().find((item) => item.id === activity.id)?.registeredCount).toBe(
      activity.registeredCount,
    )
    expect(createDemoRepository(storage).listRegistrations()).toEqual([])
    reloaded.registerActivity(activity.id)
    expect(reloaded.listRegistrations()).toHaveLength(1)
    expect(() => reloaded.registerActivity('unknown')).toThrow('未找到')
  })

  it.each([
    '{broken json',
    'null',
    '[]',
    '{"version":2}',
    '{"version":1,"draft":[],"submissions":[null],"favoriteIds":[9],"registrations":[null]}',
  ])('损坏缓存可容错：%s', (raw) => {
    const repo = createDemoRepository(memoryStorage(raw))
    expect(repo.getDraft()).toBeNull()
    expect(repo.listMyWorks()).toEqual([])
    expect(repo.listFavorites()).toEqual([])
    expect(repo.listRegistrations()).toEqual([])
    expect(repo.listWorks()).toHaveLength(seedWorks.length)
  })

  it('保存失败明确报错，不清空草稿也不产生虚假提交成功状态', () => {
    const base = memoryStorage()
    let fail = false
    const storage: DemoStorage = {
      getItem: base.getItem,
      setItem: (key, value) => {
        if (fail) throw new Error('quota')
        base.setItem(key, value)
      },
    }
    const repo = createDemoRepository(storage)
    repo.saveDraft(validDraft())
    fail = true
    expect(() => repo.submitWork(validDraft())).toThrow(DemoStorageError)
    expect(repo.listMyWorks()).toEqual([])
    expect(repo.getDraft()).toEqual(validDraft())
    expect(() => repo.toggleFavorite(seedWorks[0].id)).toThrow('数据尚未保存')
    expect(repo.listFavorites()).toEqual([])
    expect(() => repo.registerActivity(seedActivities[0].id)).toThrow(DemoStorageError)
    expect(repo.listRegistrations()).toEqual([])
    fail = false
    expect(repo.submitWork(validDraft()).status).toBe('pending_initial_review')
  })

  it('读取存储失败可被 UI 捕获', () => {
    expect(() =>
      createDemoRepository({
        getItem: () => {
          throw new Error('denied')
        },
        setItem: () => {},
      }),
    ).toThrow('无法读取本地演示数据')
  })
})
