import { describe, expect, it } from 'vitest'
import {
  assistantTools,
  createAssistantDraft,
  getAssistantExample,
  transferAssistantDraft,
} from '../src/domain/assistantExamples'
import {
  createDemoRepository,
  createEmptyDraft,
  DemoStorageError,
  validateSubmission,
} from '../src/domain/repository'
import type { DemoStorage } from '../src/domain/types'
function memory() {
  let value: string | null = null
  let fails = false
  let writes = 0
  return {
    storage: {
      getItem: () => value,
      setItem: (_: string, next: string) => {
        if (fails) throw new Error('quota')
        value = next
        writes++
      },
    } satisfies DemoStorage,
    fail: () => {
      fails = true
    },
    count: () => writes,
  }
}
const candidate = () =>
  createAssistantDraft('letter', getAssistantExample('letter').result.zh, 'zhejiang')
describe('助手预设与草稿交接', () => {
  it('所有创作预设在中英文下都能形成可编辑的新稿，版权必须另行确认', () => {
    for (const tool of assistantTools.filter((item) => item.id !== 'help'))
      for (const example of tool.examples)
        for (const language of ['zh', 'en'] as const) {
          const draft = createAssistantDraft(tool.id, example.result[language], 'sichuan', language)
          expect(draft.editingWorkId).toBeUndefined()
          expect(draft.attachments).toEqual([])
          expect(draft.region).toBe('sichuan')
          expect(draft.copyrightAccepted).toBe(false)
          expect(validateSubmission(draft)).toEqual({ copyrightAccepted: expect.any(String) })
        }
  })
  it('帮助回答不转换为作品，空结果也不能创建草稿', () => {
    expect(() => createAssistantDraft('help', '帮助内容', 'all')).toThrow('帮助回答')
    expect(() => createAssistantDraft('letter', '  ', 'all')).toThrow('先查看')
  })
  it('无现有草稿时保存新稿，恢复后不带作品编号或附件', () => {
    const data = memory()
    const repo = createDemoRepository(data.storage)
    const result = transferAssistantDraft(repo, candidate())
    expect(result.status).toBe('saved')
    expect(createDemoRepository(data.storage).getDraft()).toMatchObject({
      genre: 'letter',
      region: 'zhejiang',
      copyrightAccepted: false,
      attachments: [],
    })
    expect(repo.getDraft()?.editingWorkId).toBeUndefined()
  })
  it('普通现有草稿默认保留，冲突预览不写入存储', () => {
    const data = memory()
    const repo = createDemoRepository(data.storage)
    const original = {
      ...createEmptyDraft(),
      title: '我的未完成家书',
      content: '还没有写完的原创内容',
    }
    repo.saveDraft(original)
    const before = data.count()
    const result = transferAssistantDraft(repo, candidate())
    expect(result.status).toBe('conflict')
    expect(data.count()).toBe(before)
    expect(repo.getDraft()).toEqual(original)
  })
  it('明确替换普通草稿才写新稿，不继承旧版权和附件', () => {
    const data = memory()
    const repo = createDemoRepository(data.storage)
    repo.saveDraft({
      ...createEmptyDraft(),
      title: '旧草稿',
      copyrightAccepted: true,
      attachments: [{ id: 'old', name: '旧材料.pdf', type: 'pdf', size: 42 }],
    })
    expect(transferAssistantDraft(repo, candidate(), true).status).toBe('saved')
    expect(repo.getDraft()).toEqual(candidate())
    expect(repo.getDraft()?.copyrightAccepted).toBe(false)
  })
  it('退回修改草稿即便传入替换意图也不覆盖，原编号和修改正文保留', () => {
    const data = memory()
    const repo = createDemoRepository(data.storage)
    const work = repo.submitWork({ ...candidate(), copyrightAccepted: true })
    repo.reviewWork(work.id, {
      action: 'return',
      scores: { theme: 80, writing: 80, originality: 80 },
      comment: '模拟意见：请补充一个具体生活事例。',
    })
    const draft = repo.prepareRevision(work.id)
    repo.saveDraft({ ...draft, content: '修改进行中，需要保留原作品编号和正在编辑的内容。' })
    const before = repo.getDraft()
    const writes = data.count()
    expect(transferAssistantDraft(repo, candidate(), true).status).toBe('revision-protected')
    expect(repo.getDraft()).toEqual(before)
    expect(data.count()).toBe(writes)
  })
  it('替换保存失败时保留原草稿；禁止给候选新稿带入editingWorkId', () => {
    const data = memory()
    const repo = createDemoRepository(data.storage)
    const original = { ...createEmptyDraft(), title: '保留这份草稿' }
    repo.saveDraft(original)
    data.fail()
    expect(() => transferAssistantDraft(repo, candidate(), true)).toThrow(DemoStorageError)
    expect(repo.getDraft()).toEqual(original)
    expect(() =>
      transferAssistantDraft(repo, { ...candidate(), editingWorkId: 'DEMO-EXISTING' }, true),
    ).toThrow('不能携带')
  })
})
