import { getAssistantExample, getAssistantTool } from './assistantExamples'
import type { AiCitation, AiTask } from './aiTasks'
import type { AssistantMode } from './personalArchive'
export type ChatLanguage = 'zh' | 'en'
export interface ConversationContext {
  recipient?: 'child' | 'grandmother' | 'father' | 'mother' | 'family'
  theme?: 'trust' | 'care' | 'thrift' | 'neighbor' | 'reading' | 'integrity' | 'patriotism'
  exampleId?: string
  content?: string
  source?: 'preset' | 'rules'
}
export interface ConversationReply {
  text: string
  content?: string
  source: 'preset' | 'rules' | 'guidance' | 'model'
  exampleId?: string
  mode: AssistantMode
  prompt: string
  language: ChatLanguage
  context: ConversationContext
  citations?: AiCitation[]
  model?: string
  taskId?: string
  issues?: AiTask['issues']
  similarities?: AiTask['similarities']
}
export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  reply?: ConversationReply
}
export const MAX_CONVERSATION_TURNS = 20
export const MAX_CHAT_INPUT = 2000
const choose = (language: ChatLanguage, zh: string, en: string) => (language === 'zh' ? zh : en)
const recipients = {
  child: { zh: '孩子', en: 'child' },
  grandmother: { zh: '奶奶', en: 'Grandma' },
  father: { zh: '爸爸', en: 'Dad' },
  mother: { zh: '妈妈', en: 'Mum' },
  family: { zh: '家人', en: 'family' },
}
const topics = {
  integrity: { zh: '清廉自守', en: 'integrity' },
  patriotism: { zh: '爱国奉献', en: 'public responsibility' },
  trust: { zh: '守信', en: 'keeping promises' },
  care: { zh: '彼此照顾', en: 'caring for one another' },
  thrift: { zh: '珍惜物品', en: 'caring for belongings' },
  neighbor: { zh: '邻里互助', en: 'helping neighbours' },
  reading: { zh: '共同阅读', en: 'reading together' },
}
function recipient(input: string) {
  if (/奶奶|外婆|祖母|grandma|grandmother/i.test(input)) return 'grandmother' as const
  if (/爸爸|父亲|父亲节|dad|father/i.test(input)) return 'father' as const
  if (/妈妈|母亲|mother|mum|mom/i.test(input)) return 'mother' as const
  if (/孩子|儿子|女儿|求学|child|daughter|son\b|school/i.test(input)) return 'child' as const
  if (/家人|全家|family/i.test(input)) return 'family' as const
}
function theme(input: string) {
  if (/清廉|廉洁|公私|廉政|integrity|public supplies/i.test(input)) return 'integrity' as const
  if (/爱国|奉献|patriot|public responsibility/i.test(input)) return 'patriotism' as const
  if (/诚信|守信|承诺|诚实|promise|trust|honest/i.test(input)) return 'trust' as const
  if (/节约|惜物|浪费|thrift|waste|belonging/i.test(input)) return 'thrift' as const
  if (/邻居|邻里|neighbou?r/i.test(input)) return 'neighbor' as const
  if (/共读|读书|阅读|reading|read together|book/i.test(input)) return 'reading' as const
  if (/照顾|关爱|感谢|感恩|温暖|孝老|爱亲|孝敬|care|thank|warm/i.test(input)) return 'care' as const
}
function previousContext(history: ConversationMessage[], mode: AssistantMode): ConversationContext {
  return (
    [...history]
      .reverse()
      .find((message) => message.role === 'assistant' && message.reply?.mode === mode)?.reply
      ?.context ?? {}
  )
}
export function conversationSuggestions(
  mode: AssistantMode,
  language: ChatLanguage,
  hasPrevious = false,
) {
  const examples = getAssistantTool(mode).examples.map((example) => ({
    label: example.label[language],
    prompt: example.input[language],
    exampleId: example.id,
  }))
  return hasPrevious
    ? [
        {
          label: choose(language, '简短一点', 'Make it shorter'),
          prompt: choose(
            language,
            '请把上一段简短一点',
            'Please make the previous passage shorter',
          ),
          exampleId: undefined,
        },
        {
          label: choose(language, '接下来怎么写', 'What comes next?'),
          prompt: choose(
            language,
            '沿着刚才的话题，接下来怎么写？',
            'Keeping the previous topic, what should I write next?',
          ),
          exampleId: undefined,
        },
        {
          label: choose(language, '换个例子', 'Another example'),
          prompt: choose(language, '换一个相关的例子看看', 'Show another related example'),
          exampleId: undefined,
        },
        ...examples,
      ]
    : examples
}
/** Deterministic local adapter. No networking, inference, fact checking or invented user facts. */
export function replyToConversation(options: {
  mode: AssistantMode
  input: string
  language: ChatLanguage
  history: ConversationMessage[]
  exampleId?: string
  draftTitle?: string
  draftText?: string
}): ConversationReply {
  const { mode, language } = options
  const input = options.input.trim()
  if (!input) throw new Error('chat-empty')
  if ([...input].length > MAX_CHAT_INPUT) throw new Error('chat-too-long')
  const previous = previousContext(options.history, mode)
  const context: ConversationContext = { ...previous }
  const say = (zh: string, en: string) => choose(language, zh, en)
  const result = (
    text: string,
    source: ConversationReply['source'] = 'guidance',
    content?: string,
    exampleId?: string,
  ): ConversationReply => ({
    text,
    source,
    content,
    exampleId,
    mode,
    prompt: input,
    language,
    context: {
      ...context,
      ...(content ? { content, source: source === 'preset' ? 'preset' : 'rules' } : {}),
      ...(exampleId ? { exampleId } : {}),
    },
  })
  const preset = (id?: string) => {
    const example = getAssistantExample(mode, id)
    const content = example.result[language]
    const shown =
      mode === 'ocr' && example.source
        ? `${say('对照样卡', 'Source card')}:\n${example.source[language]}\n\n${say('待校文字', 'Text to proofread')}:\n${content}`
        : content
    return result(
      say(
        `找到一份可参考的本地样例：「${example.label.zh}」。下面是预先编写的内容，你可以继续追问“简短一点”或“接下来怎么写”。\n\n${shown}`,
        `Here is the prepared local example “${example.label.en}”. You can follow up with “make it shorter” or “what comes next?”.\n\n${shown}`,
      ),
      'preset',
      content,
      example.id,
    )
  }
  if (options.exampleId) {
    const example = getAssistantExample(mode, options.exampleId)
    context.recipient = recipient(example.input[language]) ?? context.recipient
    context.theme = theme(example.input[language]) ?? context.theme
    return preset(example.id)
  }
  if (/^(你好|您好|hi|hello|hey)[！!。.\s]*$/i.test(input))
    return result(
      say(
        `你好，我们可以从“${getAssistantTool(mode).examples[0]!.label.zh}”聊起。也可以写下收信人、主题或具体问题。`,
        `Hello. We can start with “${getAssistantTool(mode).examples[0]!.label.en}”, or you can describe a recipient, topic or specific question.`,
      ),
    )
  if (/简短|短一点|缩短|精简|shorter|shorten|concise/i.test(input)) {
    if (!previous.content)
      return result(
        say(
          '还没有可以精简的上轮内容。先说说想写给谁、写什么，或选择一个快捷问题。',
          'There is no earlier passage to shorten yet. Tell me the recipient or topic, or choose a quick question.',
        ),
      )
    const paragraphs = previous.content.split(/\n\s*\n/).filter(Boolean)
    let content = paragraphs.slice(0, Math.min(2, paragraphs.length)).join('\n\n')
    if (content.length >= previous.content.length)
      content = (previous.content.match(/[^。！？.!?]+[。！？.!?]?/g) ?? [])
        .filter(Boolean)
        .slice(0, 2)
        .join(' ')
    if (content.length >= previous.content.length && [...content].length > 180)
      content = [...content].slice(0, 180).join('') + say('（节选）', ' (excerpt)')
    return result(
      say(
        `这是上一段的简短节选，保留了开头的要点。\n\n${content}`,
        `Here is a shorter excerpt from the previous passage, keeping its opening points.\n\n${content}`,
      ),
      'rules',
      content,
      previous.exampleId,
    )
  }
  if (/换.{0,3}(例|种|个)|另.{0,3}(例|种|个)|another|different example/i.test(input)) {
    const examples = getAssistantTool(mode).examples
    const index = examples.findIndex((example) => example.id === previous.exampleId)
    return preset(examples[(index + 1) % examples.length]!.id)
  }
  if (
    /接下来|下一步|继续|具体一点|多一点细节|怎么展开|提纲|next|continue|detail|outline/i.test(input)
  ) {
    if (!previous.content && !previous.theme && !previous.recipient)
      return result(
        say(
          '先告诉我故事想写给谁，或围绕哪件小事展开；有了主题后，我可以给出三步写作提纲。',
          'First tell me who the story is for or which everyday moment it concerns. Then I can offer a three-step writing outline.',
        ),
      )
    if (['help', 'knowledge', 'compliance', 'ocr'].includes(mode)) {
      const title = getAssistantExample(mode, previous.exampleId).label[language]
      const steps = {
        help: say(
          '先打开对应功能，完成第一步，再核对页面反馈。若遇到困难，可以告诉我是草稿保存、存档恢复，还是投稿进度问题。',
          'Open the relevant feature, complete its first step, and check the on-screen feedback. Tell me whether the difficulty concerns saving drafts, restoring samples, or tracking a submission.',
        ),
        knowledge: say(
          '可以一起讨论：哪句话让你想起家里的一件事？你愿意做哪一个小行动？先听完彼此的看法，再形成共同约定。',
          'Discuss which sentence recalls a moment at home and which small action each person wants to try. Hear one another out before agreeing on a shared commitment.',
        ),
        compliance: say(
          '先找出稿件中相关的位置，再补充来源或素材授权说明；不能核实的部分先标记待确认，交由人工复核。这里不会作出真实审核结论。',
          'Locate the relevant passage, add a source or permission note, and mark anything unverifiable for human review. This does not issue a real review decision.',
        ),
        ocr: say(
          '逐行对照样卡，先圈出不确定的字，再核对前后语意和标点。无法确认的字保留待校标记，不自行补成事实。',
          'Compare the sample card line by line, mark uncertain characters, and check context and punctuation. Keep unresolved words marked rather than inventing a reading.',
        ),
      }
      const content =
        say(`接着「${title}」，可以这样继续：\n\n`, `Continuing “${title}”, try this next:\n\n`) +
        steps[mode as keyof typeof steps]
      return result(content, 'rules', content, previous.exampleId)
    }
    const topic = topics[previous.theme ?? 'care'][language]
    const who = recipients[previous.recipient ?? 'family'][language]
    const content = say(
      `围绕“${topic}”，写给${who}的三步提纲：\n\n一、写一个真实场景：[时间、地点，以及你记得的一句话]。\n二、写一个具体行动：[谁做了什么，怎样回应对方的需要]。\n三、写一个可以做到的约定：[下次我愿意怎么做]。\n\n方括号是待你补充的内容，不是已发生的事实。`,
      `A three-step outline about ${topic}, for ${who}:\n\n1. A real moment: [time, place and a sentence you remember].\n2. A concrete action: [who did what, and how it met someone’s need].\n3. A practical promise: [what I would like to do next time].\n\nBrackets are for you to fill in; they are not claims about events that happened.`,
    )
    return result(
      say(
        `接着刚才的话题，可以这样展开：\n\n${content}`,
        `Continuing the previous topic, try this outline:\n\n${content}`,
      ),
      'rules',
      content,
    )
  }
  const useDraft = /当前稿|这篇稿|我的正文|这篇正文|current draft|my draft/i.test(input)
  if (useDraft && !options.draftText?.trim() && !options.draftTitle?.trim())
    return result(
      say(
        '当前稿件还是空的。先写一句主题，或告诉我想写给哪位家人；我会按这些关键词给出写作框架。',
        'Your draft is empty. Add a topic or tell me which family member it is for, and I can suggest a keyword-based writing frame.',
      ),
    )
  const clues = useDraft ? `${options.draftTitle ?? ''} ${options.draftText ?? ''}` : input
  const foundRecipient = recipient(clues),
    foundTheme = theme(clues)
  context.recipient = foundRecipient ?? context.recipient
  context.theme = foundTheme ?? context.theme
  const knownWriting =
    /家书|写信|写一封|写.{0,8}(爸爸|妈妈|孩子|奶奶|父亲|母亲)|家训|约定|家风|letter|write|principle|family value/i.test(
      input,
    )
  if (
    (mode === 'letter' || mode === 'rules') &&
    (foundRecipient || foundTheme || knownWriting || useDraft)
  ) {
    const who = recipients[context.recipient ?? 'family'][language]
    const topic = topics[context.theme ?? 'care'][language]
    const title = options.draftTitle?.trim().slice(0, 60)
    const content =
      mode === 'letter'
        ? say(
            `亲爱的${who}：\n\n我想和你聊聊“${topic}”。每次想起家里的小事，都有一些话值得认真说出来。\n\n[请补上一件你们真实经历的小事：当时发生了什么，对方做了什么，你有什么感受。]\n\n接下来，我愿意从一件能做到的小事开始：[写下你的具体行动]。也想听听你的想法。\n\n愿我们彼此关心，把日子过得踏实。`,
            `Dear ${who},\n\nI would like to talk about ${topic}. Everyday moments at home can give us something worth saying with care.\n\n[Add a real shared moment: what happened, what the other person did, and how you felt.]\n\nNext, I would like to begin with one practical action: [write your next step]. I would also like to hear your thoughts.\n\nLet us care for each other in ordinary days.`,
          )
        : say(
            `我们的家庭约定 · ${topic}\n\n一、每周留一段时间，听彼此说说近况。\n二、围绕“${topic}”，共同商量一件本周能做到的小事。\n三、做不到时及时说明，不用责备代替沟通。\n四、周末一起回顾，保留有帮助的做法。\n\n本周的具体行动：[由家人一起填写]。`,
            `Our family commitments · ${topic}\n\n1. Set aside time each week to hear how everyone is doing.\n2. Agree on one practical action this week related to ${topic}.\n3. Explain difficulties promptly, without replacing conversation with blame.\n4. Review the week together and keep the habits that help.\n\nOur action for this week: [complete this together].`,
          )
    return result(
      say(
        `${useDraft && title ? `围绕当前标题「${title}」，` : '根据这次提到的关键词，'}整理了一份可填写的写作框架。可以继续说“简短一点”或“接下来怎么写”。\n\n${content}`,
        `${useDraft && title ? `For your current title “${title}”, ` : 'Using the keywords in this turn, '}here is a fill-in writing frame. You can ask for a shorter version or the next step.\n\n${content}`,
      ),
      'rules',
      content,
    )
  }
  const matching: Partial<Record<AssistantMode, [RegExp, string][]>> = {
    polish: [
      [/邻|neighbou?r/i, 'polish-neighbor'],
      [/润色|辛苦|妈妈|母亲|polish|mum|mother|meal/i, 'polish-meal'],
    ],
    ocr: [
      [/读书|阅读|reading|read/i, 'ocr-reading'],
      [/手稿|识别|校对|信住|ocr|manuscript|proofread/i, 'ocr-trust'],
    ],
    help: [
      [/草稿|存档|保存|draft|archiv|sav/i, 'help-draft'],
      [/投稿|退回|评审|submit|review|revis/i, 'help-submit'],
    ],
    knowledge: [
      [/共读|读书|阅读|read/i, 'knowledge-talk'],
      [/家风|家训|区别|family value|principle|difference/i, 'knowledge-difference'],
    ],
    compliance: [
      [/引用|出处|名言|quote|source|attribution/i, 'review-source'],
      [/隐私|照片|个人信息|电话|privacy|photo|phone|permission/i, 'review-privacy'],
    ],
    storyboard: [
      [/还书|借书|book|borrow/i, 'story-promise'],
      [/留饭|晚归|奶奶|餐|meal|grandma|home late/i, 'story-meal'],
    ],
  }
  const match = matching[mode]?.find(([pattern]) => pattern.test(input))
  if (match) return preset(match[1])
  const examples = getAssistantTool(mode).examples
  return result(
    say(
      `这类问题暂未提供演示回答。你可以试着问：“${examples[0]!.input.zh}”或“${examples[1]!.input.zh}”。${previous.content ? '如果想接着上轮内容聊，可以说“简短一点”或“接下来怎么写”。' : ''}`,
      `A demo answer is not available for this question yet. Try “${examples[0]!.input.en}” or “${examples[1]!.input.en}”.${previous.content ? ' To continue the earlier passage, ask for a shorter version or the next step.' : ''}`,
    ),
  )
}
