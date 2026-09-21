import { describe, expect, it } from 'vitest'
import { checkPoem, cleanWritingDelta, writingHtml, writingText } from '../src/domain/writingTools'
import {
  createDemoRepository,
  createEmptyDraft,
  validateSubmission,
} from '../src/domain/repository'
import { createPersonalArchive } from '../src/domain/personalArchive'
import { createAssistantDraft, getAssistantExample } from '../src/domain/assistantExamples'
import type { DemoStorage } from '../src/domain/types'
function memory(): DemoStorage {
  const items = new Map<string, string>()
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value)
    },
  }
}
describe('安全富文本与前端创作工具', () => {
  it('仅保留文本和允许格式，剔除嵌入、链接、脚本样式等字段', () => {
    const delta = cleanWritingDelta({
      ops: [
        {
          insert: '<img src=x onerror=alert(1)>',
          attributes: { bold: true, link: 'javascript:alert(1)', color: 'red' },
        },
        { insert: { image: 'https://example.com/x' } },
        { insert: '\n', attributes: { header: 2 } },
      ],
    })
    expect(delta.ops).toEqual([
      { insert: '<img src=x onerror=alert(1)>', attributes: { bold: true } },
      { insert: '\n', attributes: { header: 2 } },
    ])
    const html = writingHtml(delta)
    expect(html).toContain('&lt;img')
    expect(html).toContain('<h2><strong>')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('javascript:')
  })
  it('纯文本稿件可迁移为Delta，反向纯文本保持一致', () => {
    const content = '旧稿第一段。\n\n第二段保留空行。'
    expect(writingText(cleanWritingDelta(undefined, content))).toBe(content)
  })
  it('富文本随草稿、提交、退回重投持久化且使用同一编号', () => {
    const storage = memory(),
      repo = createDemoRepository(storage)
    const content = '我家的故事从一盏晚归时仍然亮着的厨房灯开始。'
    const contentDelta = cleanWritingDelta({
      ops: [
        { insert: content, attributes: { bold: true } },
        { insert: '\n', attributes: { header: 2 } },
      ],
    })
    repo.saveDraft({
      ...createEmptyDraft(),
      title: '一盏灯',
      content,
      contentDelta,
      copyrightAccepted: true,
    })
    const restored = createDemoRepository(storage)
    expect(restored.getDraft()?.contentDelta).toEqual(contentDelta)
    const work = restored.submitWork(restored.getDraft()!)
    restored.reviewWork(work.id, {
      action: 'return',
      scores: { theme: 80, writing: 80, originality: 80 },
      comment: '请补充更多细节。',
    })
    const draft = restored.prepareRevision(work.id)
    expect(draft.contentDelta).toEqual(contentDelta)
    const next = restored.submitWork({ ...draft, copyrightAccepted: true })
    expect(next.id).toBe(work.id)
    expect(next.revisionNumber).toBe(2)
    expect(next.contentDelta).toEqual(contentDelta)
  })
  it('拒绝格式内容与正文不一致，避免提交预览和作品两套文字', () => {
    expect(
      validateSubmission({
        ...createEmptyDraft(),
        content: '完整正文至少二十字，需要保持和格式中的正文完全一致。',
        contentDelta: cleanWritingDelta(undefined, '另一篇稿件'),
      }),
    ).toHaveProperty('content')
  })
  it('海外国家城市为必填并保存；国内旧稿不需要新增字段', () => {
    const draft = {
      ...createEmptyDraft(),
      title: '海外家书',
      content: '一家人虽然远隔千里，仍然通过书信分享每日的生活与感受。',
      region: 'overseas' as const,
      copyrightAccepted: true,
    }
    expect(validateSubmission(draft)).toHaveProperty('overseasLocation')
    expect(validateSubmission({ ...draft, overseasLocation: '新加坡 · 新加坡' })).toEqual({})
    const repo = createDemoRepository(memory()),
      work = repo.submitWork({ ...draft, overseasLocation: '新加坡 · 新加坡' })
    expect(repo.getWork(work.id)?.overseasLocation).toBe('新加坡 · 新加坡')
    expect(validateSubmission({ ...draft, region: 'beijing' })).toEqual({})
  })
  it('按标点与换行统计五言四句；不把杂句或英文判断为格律诗', () => {
    expect(checkPoem('家中灯火暖，窗外雨声轻。\n一诺随身记，清风伴我行。')).toMatchObject({
      counts: [5, 5, 5, 5],
      pattern: '5×4',
      chinese: true,
    })
    expect(checkPoem('长短句都可以，写下自己的故事。').pattern).toBeNull()
    expect(checkPoem('hello, world').chinese).toBe(false)
    expect(checkPoem('')).toMatchObject({ lines: [], pattern: null })
  })
  it('新增助手模式与旧存档共同恢复；知识及审核不能作为作品转稿', () => {
    const storage = memory(),
      archive = createPersonalArchive(storage)
    for (const mode of ['letter', 'knowledge', 'compliance', 'storyboard'] as const)
      archive.saveAiArchive({
        mode,
        prompt: getAssistantExample(mode).input.zh,
        result: getAssistantExample(mode).result.zh,
      })
    expect(createPersonalArchive(storage).listAiArchives()).toHaveLength(4)
    for (const mode of ['knowledge', 'compliance'] as const)
      expect(() =>
        createAssistantDraft(mode, '这是一份知识或审核报告，不作为家风文学作品进行投稿。', 'all'),
      ).toThrow()
    expect(
      createAssistantDraft('storyboard', getAssistantExample('storyboard').result.zh, 'all').title,
    ).toContain('分镜')
  })
})
