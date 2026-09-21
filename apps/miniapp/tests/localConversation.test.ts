import { describe, expect, it } from 'vitest'
import { assistantTools } from '../src/domain/assistantExamples'
import {
  conversationSuggestions,
  replyToConversation,
  type ConversationMessage,
  type ConversationReply,
} from '../src/domain/localConversation'
const history = (reply: ConversationReply): ConversationMessage[] => [
  { id: 'q', role: 'user', text: reply.prompt },
  { id: 'a', role: 'assistant', text: reply.text, reply },
]
describe('本地连续对话适配', () => {
  it('八类模式的中英快捷问题保留原预设和来源，OCR包含对应样卡', () => {
    for (const tool of assistantTools)
      for (const language of ['zh', 'en'] as const)
        for (const example of tool.examples) {
          const reply = replyToConversation({
            mode: tool.id,
            input: example.input[language],
            exampleId: example.id,
            language,
            history: [],
          })
          expect(reply.content).toBe(example.result[language])
          expect(reply.exampleId).toBe(example.id)
          expect(reply.source).toBe('preset')
          if (tool.id === 'ocr') expect(reply.text).toContain(example.source![language])
        }
  })
  it('自由输入匹配收信人和主题，继续追问沿用上轮上下文', () => {
    const first = replyToConversation({
      mode: 'letter',
      input: '想给爸爸写封关于守信的家书',
      language: 'zh',
      history: [],
    })
    expect(first.content).toContain('亲爱的爸爸')
    expect(first.content).toContain('守信')
    expect(first.source).toBe('rules')
    const next = replyToConversation({
      mode: 'letter',
      input: '接下来怎么展开？',
      language: 'zh',
      history: history(first),
    })
    expect(next.content).toContain('写给爸爸')
    expect(next.content).toContain('守信')
    expect(next.content).toContain('[时间、地点')
    expect(first.context).toMatchObject({ recipient: 'father', theme: 'trust' })
  })
  it('简短追问从上轮内容节选；没有上下文时给出具体引导', () => {
    const first = replyToConversation({
      mode: 'letter',
      input: 'Write a letter to Grandma about care',
      language: 'en',
      history: [],
    })
    const short = replyToConversation({
      mode: 'letter',
      input: 'make it shorter',
      language: 'en',
      history: history(first),
    })
    expect(short.content!.length).toBeLessThan(first.content!.length)
    expect(first.content).toContain(short.content!)
    expect(short.content).toContain('Grandma')
    expect(
      replyToConversation({ mode: 'letter', input: '简短一点', language: 'zh', history: [] })
        .content,
    ).toBeUndefined()
  })
  it('新人物与主题更新上下文，未知问题不虚构回答并允许回到上轮', () => {
    const first = replyToConversation({
      mode: 'letter',
      input: '给爸爸写守信家书',
      language: 'zh',
      history: [],
    })
    const next = replyToConversation({
      mode: 'letter',
      input: '给妈妈写共同阅读的信',
      language: 'zh',
      history: history(first),
    })
    expect(next.content).toContain('妈妈')
    expect(next.context.theme).toBe('reading')
    const unknown = replyToConversation({
      mode: 'letter',
      input: '请推导量子引力方程',
      language: 'zh',
      history: history(next),
    })
    expect(unknown.source).toBe('guidance')
    expect(unknown.content).toBeUndefined()
    expect(unknown.text).toContain('暂未提供演示回答')
    expect(
      replyToConversation({
        mode: 'letter',
        input: '接下来怎么写',
        language: 'zh',
        history: history(unknown),
      }).content,
    ).toContain('妈妈')
  })
  it('不同模式不串用上下文，参考模式的后续步骤保留该类型', () => {
    const letter = replyToConversation({
      mode: 'letter',
      input: '给爸爸写一封信',
      language: 'zh',
      history: [],
    })
    expect(
      replyToConversation({
        mode: 'knowledge',
        input: '简短一点',
        language: 'zh',
        history: history(letter),
      }).content,
    ).toBeUndefined()
    const review = replyToConversation({
      mode: 'compliance',
      input: '素材照片涉及隐私',
      language: 'zh',
      history: [],
    })
    expect(
      replyToConversation({
        mode: 'compliance',
        input: '下一步呢',
        language: 'zh',
        history: history(review),
      }).content,
    ).toContain('人工复核')
  })
  it('当前稿件参考只在明确请求时使用，空稿给引导', () => {
    expect(
      replyToConversation({
        mode: 'letter',
        input: '参考我的当前稿件',
        language: 'zh',
        history: [],
      }).content,
    ).toBeUndefined()
    const reply = replyToConversation({
      mode: 'letter',
      input: '结合我的当前稿件给点灵感',
      language: 'zh',
      history: [],
      draftTitle: '写给妈妈',
      draftText: '我们一起读书，分享每一天的见闻。',
    })
    expect(reply.text).toContain('写给妈妈')
    expect(reply.content).toContain('共同阅读')
  })
  it('空输入和超长输入不形成回复，重复快捷追问可轮换样例', () => {
    expect(() =>
      replyToConversation({ mode: 'letter', input: '  ', language: 'zh', history: [] }),
    ).toThrow('chat-empty')
    expect(() =>
      replyToConversation({
        mode: 'letter',
        input: '文'.repeat(2001),
        language: 'zh',
        history: [],
      }),
    ).toThrow('chat-too-long')
    const first = replyToConversation({
      mode: 'letter',
      input: '示例',
      exampleId: 'letter-child',
      language: 'zh',
      history: [],
    })
    const second = replyToConversation({
      mode: 'letter',
      input: '换个例子',
      language: 'zh',
      history: history(first),
    })
    expect(second.exampleId).toBe('letter-elder')
    expect(
      conversationSuggestions('letter', 'zh', true).some((item) => item.prompt.includes('上一段')),
    ).toBe(true)
  })
})
