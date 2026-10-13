import type { AssistantMode } from './personalArchive'

export type AiMode =
  | 'family'
  | 'letter'
  | 'polish'
  | 'knowledge'
  | 'support'
  | 'ocr'
  | 'review'
  | 'summary'
export interface AiCitation {
  id: string
  title: string
  excerpt: string
  url?: string
}
export interface AiTask {
  id: string
  mode: AiMode
  status: 'queued' | 'running' | 'succeeded' | 'failed'
  prompt?: string
  result?: string
  citations?: AiCitation[]
  issues?: { severity: string; quote: string; reason: string }[]
  similarities?: { id: string; title: string; excerpt: string; score: number }[]
  model?: string
  error?: { code: string; message: string }
  createdAt: string
  completedAt?: string
  submissionId?: string
  sourceVersion?: number
  fileId?: string
}
export interface AiTaskInput {
  mode: AiMode
  prompt: string
  text?: string
  language: 'zh' | 'en'
  history?: { role: 'user' | 'assistant'; content: string }[]
  fileId?: string
  submissionId?: string
  version?: number
}
export interface AiStatus {
  enabled: boolean
  provider: string
  model: string
  ocrEnabled: boolean
  external: boolean
  knowledgeCount: number
}
export function aiMode(mode: AssistantMode): AiMode | undefined {
  return (
    {
      rules: 'family',
      letter: 'letter',
      polish: 'polish',
      knowledge: 'knowledge',
      help: 'support',
      ocr: 'ocr',
      compliance: 'review',
    } as Partial<Record<AssistantMode, AiMode>>
  )[mode]
}
export function assistantMode(mode: AiMode): AssistantMode {
  return mode === 'family'
    ? 'rules'
    : mode === 'support'
      ? 'help'
      : mode === 'review' || mode === 'summary'
        ? 'compliance'
        : mode
}
export class AiTaskError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'AiTaskError'
  }
}
/** Polling is transport-independent so native and H5 use the same cancellation/session rules. */
export async function waitForAiTask(
  initial: AiTask,
  options: {
    read: (id: string) => Promise<AiTask>
    active: () => boolean
    delay?: (ms: number) => Promise<void>
    now?: () => number
    timeoutMs?: number
    onTask?: (task: AiTask) => void
  },
): Promise<AiTask> {
  const now = options.now ?? Date.now
  const deadline = now() + (options.timeoutMs ?? 180000)
  const delay =
    options.delay ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  let task = initial
  for (;;) {
    if (!options.active())
      throw new AiTaskError('CANCELLED', '已停止等待，任务可在本人历史中查看。')
    options.onTask?.(task)
    if (task.status === 'failed')
      throw new AiTaskError(
        task.error?.code ?? 'AI_FAILED',
        task.error?.message ?? '处理失败，请重试。输入已保留。',
      )
    if (task.status === 'succeeded') return task
    if (now() >= deadline)
      throw new AiTaskError('AI_TIMEOUT', '任务仍在处理中，请稍后从本人历史继续查看。输入已保留。')
    await delay(1200)
    if (!options.active())
      throw new AiTaskError('CANCELLED', '已停止等待，任务可在本人历史中查看。')
    task = await options.read(task.id)
  }
}
export function validateManuscript(name: string, size: number) {
  if (!Number.isFinite(size) || size <= 0 || size > 10 * 1024 * 1024)
    throw new AiTaskError('FILE_SIZE', '请选择非空且不超过 10 MiB 的文件。')
  if (!/\.(png|jpe?g|pdf)$/i.test(name))
    throw new AiTaskError('FILE_TYPE', '手稿识别支持 JPG、PNG 图片和 PDF。')
}

export type AiCitationScreen =
  | 'library'
  | 'news'
  | 'learning'
  | 'classroom'
  | 'media'
  | 'hall'
  | 'shop'
  | 'venues'
/** Only server-owned public content routes can become navigation actions. */
export function citationTarget(url?: string): { screen: AiCitationScreen; id: string } | undefined {
  if (!url || !/^\/#\/(?:pages\/explore\/index|pkg-content\/pages\/index)\?/.test(url)) return
  try {
    const fields = Object.fromEntries(
      url
        .slice(url.indexOf('?') + 1)
        .split('&')
        .map((part) => {
          const [key, ...value] = part.split('=')
          return [decodeURIComponent(key || ''), decodeURIComponent(value.join('='))]
        }),
    )
    const allowed = ['library', 'news', 'learning', 'classroom', 'media', 'hall', 'shop', 'venues']
    if (allowed.includes(fields.screen || '') && fields.id && /^[\w-]{1,120}$/.test(fields.id))
      return { screen: fields.screen as AiCitationScreen, id: fields.id }
  } catch {
    /* Malformed source URLs remain non-clickable source text. */
  }
}

export function boundedAiHistory(
  messages: { role: 'user' | 'assistant'; text: string }[],
): NonNullable<AiTaskInput['history']> {
  const history: NonNullable<AiTaskInput['history']> = []
  let remaining = 16000
  for (const message of messages.slice(-12).reverse()) {
    if (remaining <= 0) break
    let content = message.text.slice(0, Math.min(6000, remaining))
    if (/[\uD800-\uDBFF]$/.test(content)) content = content.slice(0, -1)
    if (!content.trim()) continue
    history.unshift({ role: message.role, content })
    remaining -= content.length
  }
  return history
}
