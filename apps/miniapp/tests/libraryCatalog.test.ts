import { describe, expect, it } from 'vitest'
import { readingDocument } from '../src/domain/libraryCatalog'
import { seedWorks, seedClassics } from '../src/domain/fixtures'
import { cleanWritingDelta } from '../src/domain/writingTools'
import type { Work } from '../src/domain/types'
function work(content: string, richText = false): Work {
  return {
    ...seedWorks[0]!,
    id: 'DEMO-READER-NEW',
    content,
    ...(richText ? { contentDelta: cleanWritingDelta(undefined, content) } : {}),
  }
}
describe('阅读分段与富文本兼容', () => {
  it('富文本 editor 的单换行两段可分别选择摘抄，中英文界面保持用户原文', () => {
    const first = '第一段从一盏厨房的灯写起。'
    const second = '第二段讲家人怎样用行动彼此照顾。'
    for (const language of ['zh', 'en'] as const)
      expect(
        readingDocument(work(`${first}\n${second}`, true), language).chapters[0]!.paragraphs,
      ).toEqual([first, second])
  })
  it('富文本长稿按真实段落拆分，不把小于摘抄上限的段落并成超长整篇', () => {
    const paragraphs = ['甲'.repeat(1200), '乙'.repeat(1200), '丙'.repeat(1200)]
    const actual = readingDocument(work(paragraphs.join('\n\n'), true), 'zh').chapters[0]!
      .paragraphs
    expect(actual).toEqual(paragraphs)
    expect(actual.every((part) => part.length <= 2000)).toBe(true)
  })
  it('旧纯文本单换行仍是段内换行，空行分段及典籍解析保持原有规则', () => {
    expect(
      readingDocument(work('旧稿第一行\n旧稿第二行\n\n旧稿下一段'), 'zh').chapters[0]!.paragraphs,
    ).toEqual(['旧稿第一行\n旧稿第二行', '旧稿下一段'])
    const book = readingDocument(seedClassics[0]!, 'zh')
    expect(book.chapters.length).toBeGreaterThan(1)
    expect(book.chapters.every((chapter) => chapter.paragraphs.length > 0)).toBe(true)
  })
  it('uses the server chapter order and titles for a published collection', () => {
    const book = readingDocument(
      {
        ...seedClassics[0]!,
        id: 'published-collection',
        isDemo: false,
        chapters: [
          { id: 'b', title: '先读第二章', body: '云端第一段\n\n云端第二段' },
          { id: 'a', title: '再读第一章', body: '云端第三段' },
        ],
      },
      'zh',
    )
    expect(book.chapters.map((chapter) => chapter.id)).toEqual(['b', 'a'])
    expect(book.chapters[0]).toMatchObject({
      title: '先读第二章',
      paragraphs: ['云端第一段', '云端第二段'],
    })
  })
})
