import { describe, expect, it } from 'vitest'
import {
  createDemoRepository,
  createEmptyDraft,
  DEMO_STORAGE_KEY,
  DemoStorageError,
  validateSubmission,
} from '../src/domain/repository'
import type { DemoStorage, ReviewInput, SubmissionDraft } from '../src/domain/types'
function memory(initial?: string) {
  let data = initial ?? null
  let failing = false
  return {
    storage: {
      getItem: () => data,
      setItem: (_: string, value: string) => {
        if (failing) throw new Error('quota')
        data = value
      },
    } satisfies DemoStorage,
    fail: (value: boolean) => {
      failing = value
    },
  }
}
const draft = (): SubmissionDraft => ({
  ...createEmptyDraft(),
  title: '家书里的好家风',
  content:
    '我们用这封演示家书记录一家人的日常，认真倾听彼此的想法，从小事开始实践守信、勤俭与相互关怀。',
  copyrightAccepted: true,
  themes: ['filial', 'neighbor'],
  attachments: [{ id: 'attachment-1', name: '家书.pdf', size: 1024, type: 'pdf' }],
})
const input = (action: ReviewInput['action']): ReviewInput => ({
  action,
  scores: { theme: 90, writing: 80, originality: 85 },
  comment: '模拟评审：主题清晰，表达完整，请结合日常细节继续完善。',
})

describe('模拟评审与重投闭环', () => {
  it('主题与附件元数据持久化，拒绝超量、重复主题和超限附件', () => {
    const data = memory()
    const repo = createDemoRepository(data.storage)
    const work = repo.submitWork(draft())
    expect(createDemoRepository(data.storage).getWork(work.id)).toMatchObject({
      themes: ['filial', 'neighbor'],
      attachments: draft().attachments,
    })
    expect(validateSubmission({ ...draft(), themes: ['filial', 'filial'] })).toHaveProperty(
      'themes',
    )
    expect(
      validateSubmission({ ...draft(), themes: ['filial', 'neighbor', 'integrity', 'heritage'] }),
    ).toHaveProperty('themes')
    expect(
      validateSubmission({
        ...draft(),
        attachments: [{ id: 'bad', name: '大文件.pdf', size: 11 * 1024 * 1024, type: 'pdf' }],
      }),
    ).toHaveProperty('attachments')
  })
  it('退回保留评语，原编号重投增加版本，并要求重新同意版权', () => {
    const data = memory()
    const repo = createDemoRepository(data.storage)
    const work = repo.submitWork(draft())
    repo.reviewWork(work.id, input('return'))
    const editing = repo.prepareRevision(work.id)
    expect(editing.editingWorkId).toBe(work.id)
    expect(editing.copyrightAccepted).toBe(false)
    expect(() => repo.submitWork(editing)).toThrow('请完善')
    const updated = repo.submitWork({ ...editing, title: '修改后的家书', copyrightAccepted: true })
    expect(updated).toMatchObject({
      id: work.id,
      status: 'pending_initial_review',
      revisionNumber: 2,
      progressIndex: 0,
    })
    expect(updated.reviews).toHaveLength(1)
    expect(updated.reviews![0].submissionRevision).toBe(1)
    expect(repo.listMyWorks()).toHaveLength(1)
    expect(repo.getDraft()).toBeNull()
    const reloaded = createDemoRepository(data.storage)
    expect(reloaded.getWork(work.id)?.revisionNumber).toBe(2)
    expect(reloaded.listNotifications()).toHaveLength(3)
  })
  it('逐级推进后入围、授奖、入藏，证书与通知在刷新后保留', () => {
    const data = memory()
    const repo = createDemoRepository(data.storage)
    const work = repo.submitWork(draft())
    expect(() => repo.reviewWork(work.id, input('award'))).toThrow('只有入围')
    expect(() => repo.reviewWork(work.id, input('shortlist'))).toThrow('前五级')
    for (let index = 1; index <= 5; index++)
      expect(repo.reviewWork(work.id, input('advance')).progressIndex).toBe(index)
    expect(repo.reviewWork(work.id, input('shortlist')).status).toBe('shortlisted')
    expect(repo.listPublicWorks('shortlisted').some((item) => item.id === work.id)).toBe(true)
    expect(repo.reviewWork(work.id, input('award')).status).toBe('awarded')
    const awardCertificate = repo.getCertificate(work.id)!
    expect(awardCertificate.isDemo).toBe(true)
    expect(repo.reviewWork(work.id, input('collect')).status).toBe('collected')
    expect(repo.getCertificate(work.id)!.id).toBe(awardCertificate.id)
    expect(repo.listCertificates()).toHaveLength(1)
    expect(repo.listPublicWorks('awarded').some((item) => item.id === work.id)).toBe(true)
    const reloaded = createDemoRepository(data.storage)
    expect(reloaded.getWork(work.id)?.reviews).toHaveLength(8)
    expect(reloaded.listCertificates()[0].awardLabel).toContain('典藏')
    expect(reloaded.listReviewTasks().some((item) => item.id === work.id)).toBe(false)
    expect(() => reloaded.reviewWork(work.id, input('collect'))).toThrow('不能继续')
  })
  it('评分与意见无效时不产生状态、评语和消息', () => {
    const data = memory()
    const repo = createDemoRepository(data.storage)
    const work = repo.submitWork(draft())
    expect(() =>
      repo.reviewWork(work.id, {
        ...input('advance'),
        scores: { theme: 101, writing: 80, originality: 85 },
      }),
    ).toThrow('0–100')
    expect(() => repo.reviewWork(work.id, { ...input('return'), comment: '短' })).toThrow('5–1000')
    expect(repo.getWork(work.id)?.reviews).toEqual([])
    expect(repo.getWork(work.id)?.status).toBe('pending_initial_review')
    expect(repo.listNotifications()).toHaveLength(1)
  })
  it('持久化失败不会更新评分、状态、通知、已读或编辑草稿', () => {
    const data = memory()
    const repo = createDemoRepository(data.storage)
    const work = repo.submitWork(draft())
    const notification = repo.listNotifications()[0]
    data.fail(true)
    expect(() => repo.reviewWork(work.id, input('return'))).toThrow(DemoStorageError)
    expect(repo.getWork(work.id)?.status).toBe('pending_initial_review')
    expect(() => repo.markNotificationRead(notification.id)).toThrow(DemoStorageError)
    expect(repo.listNotifications()[0].read).toBe(false)
    data.fail(false)
    repo.reviewWork(work.id, input('return'))
    repo.saveDraft({ ...createEmptyDraft(), title: '原草稿' })
    data.fail(true)
    expect(() => repo.prepareRevision(work.id)).toThrow(DemoStorageError)
    expect(repo.getDraft()?.title).toBe('原草稿')
  })
  it('保留 v1 旧作品与草稿，缺失扩展字段使用安全默认值', () => {
    const data = memory()
    const repo = createDemoRepository(data.storage)
    const work = repo.submitWork(draft())
    const { themes, attachments, reviews, revisionNumber, ...legacyWork } = work
    const { themes: oldThemes, attachments: oldAttachments, ...legacyDraft } = draft()
    const oldData = memory(
      JSON.stringify({
        version: 1,
        sequence: 1,
        draft: legacyDraft,
        submissions: [legacyWork],
        favoriteIds: [work.id],
        registrations: [],
      }),
    )
    const migrated = createDemoRepository(oldData.storage)
    expect(migrated.getWork(work.id)).toMatchObject({
      themes: [],
      attachments: [],
      reviews: [],
      revisionNumber: 1,
    })
    expect(migrated.getDraft()).toMatchObject({
      title: legacyDraft.title,
      themes: [],
      attachments: [],
    })
    expect(migrated.isFavorite(work.id)).toBe(true)
    expect(migrated.listNotifications()).toEqual([])
    expect(migrated.reviewWork(work.id, input('return')).status).toBe('returned')
  })
  it('评审预置样例不混入本人作品，禁止编辑非本人或未退回稿件', () => {
    const repo = createDemoRepository(memory().storage)
    repo.reviewWork('DEMO-WORK-004', input('return'))
    expect(repo.getWork('DEMO-WORK-004')?.status).toBe('returned')
    expect(repo.listMyWorks()).toEqual([])
    expect(() => repo.prepareRevision('DEMO-WORK-004')).toThrow('仅本人')
    const work = repo.submitWork(draft())
    expect(() => repo.resubmitWork(work.id, draft())).toThrow('仅本人')
    const message = repo.listNotifications()[0]
    repo.markNotificationRead(message.id)
    expect(repo.listNotifications()[0].read).toBe(true)
  })
})

describe('恢复与回退边界', () => {
  it('重复进入同一退回稿件保留尚未重新提交的修改草稿', () => {
    const data = memory()
    const repo = createDemoRepository(data.storage)
    const work = repo.submitWork(draft())
    repo.reviewWork(work.id, input('return'))
    const editing = repo.prepareRevision(work.id)
    repo.saveDraft({ ...editing, title: '这次还没提交的修改' })
    const reloaded = createDemoRepository(data.storage)
    expect(reloaded.prepareRevision(work.id).title).toBe('这次还没提交的修改')
    expect(reloaded.getWork(work.id)?.title).toBe('家书里的好家风')
  })
  it('损坏的扩展缓存不会破坏旧草稿和作品读取', () => {
    const data = memory()
    const original = createDemoRepository(data.storage).submitWork(draft())
    const bad = memory(
      JSON.stringify({
        version: 1,
        sequence: 1,
        draft: { ...draft(), themes: { bad: true }, attachments: [null] },
        submissions: [
          {
            ...original,
            reviews: [null, { action: 'unknown' }],
            attachments: [null],
            themes: ['unknown', 'filial', 'filial'],
          },
        ],
        registrations: [],
        favoriteIds: [],
      }),
    )
    const repo = createDemoRepository(bad.storage)
    expect(repo.getDraft()?.themes).toEqual([])
    expect(repo.getDraft()?.attachments).toEqual([])
    expect(repo.getWork(original.id)).toMatchObject({
      reviews: [],
      attachments: [],
      themes: ['filial'],
    })
  })
  it('授奖保存失败不发证书或通知，恢复存储后可完成同一操作', () => {
    const data = memory()
    const repo = createDemoRepository(data.storage)
    const work = repo.submitWork(draft())
    for (let i = 0; i < 6; i++) repo.reviewWork(work.id, input('advance'))
    const before = repo.listNotifications().length
    data.fail(true)
    expect(() => repo.reviewWork(work.id, input('award'))).toThrow(DemoStorageError)
    expect(repo.getWork(work.id)?.status).toBe('shortlisted')
    expect(repo.getCertificate(work.id)).toBeUndefined()
    expect(repo.listNotifications()).toHaveLength(before)
    data.fail(false)
    repo.reviewWork(work.id, input('award'))
    expect(repo.listCertificates()).toHaveLength(1)
  })
})
