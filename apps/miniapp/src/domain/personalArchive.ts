import type { DemoStorage } from './types'
export type AssistantMode = 'letter' | 'rules' | 'polish' | 'ocr' | 'help'
export interface Excerpt {
  id: string
  sourceId: string
  sourceTitle: string
  text: string
  note: string
  createdAt: string
}
export interface AiArchive {
  id: string
  mode: AssistantMode
  prompt: string
  result: string
  createdAt: string
}
interface ArchiveState {
  excerpts: Excerpt[]
  aiArchives: AiArchive[]
}
const key = 'jiafeng:archives:v1'
export function createPersonalArchive(storage: DemoStorage) {
  const raw = storage.getItem(key)
  const state: ArchiveState = raw ? JSON.parse(raw) : { excerpts: [], aiArchives: [] }
  const strings = (item: unknown, fields: string[]) =>
    !!item &&
    typeof item === 'object' &&
    fields.every((field) => typeof (item as Record<string, unknown>)[field] === 'string')
  if (
    !state ||
    !Array.isArray(state.excerpts) ||
    !Array.isArray(state.aiArchives) ||
    !state.excerpts.every((item) =>
      strings(item, ['id', 'sourceId', 'sourceTitle', 'text', 'note', 'createdAt']),
    ) ||
    !state.aiArchives.every(
      (item) =>
        strings(item, ['id', 'mode', 'prompt', 'result', 'createdAt']) &&
        ['letter', 'rules', 'polish', 'ocr', 'help'].includes(item.mode),
    )
  )
    throw new Error('存档格式无法读取，请先备份本机数据')
  function write(next: ArchiveState) {
    storage.setItem(key, JSON.stringify(next))
    Object.assign(state, next)
  }
  const identity = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
  return {
    listExcerpts: () => state.excerpts.map((x) => ({ ...x })).reverse(),
    listAiArchives: () => state.aiArchives.map((x) => ({ ...x })).reverse(),
    saveExcerpt(value: Omit<Excerpt, 'id' | 'createdAt'>) {
      if (
        !value.sourceId ||
        !value.text.trim() ||
        value.text.length > 2000 ||
        value.note.length > 500
      )
        throw new Error('请填写 1–2000 字摘抄及最多 500 字感想')
      const existing = state.excerpts.find(
        (x) => x.sourceId === value.sourceId && x.text === value.text,
      )
      if (existing) return { ...existing }
      if (state.excerpts.length >= 100) throw new Error('摘抄最多保存 100 条，请先整理已有记录')
      const record = { ...value, id: identity(), createdAt: new Date().toISOString() }
      write({ ...state, excerpts: [...state.excerpts, record] })
      return { ...record }
    },
    saveAiArchive(value: Omit<AiArchive, 'id' | 'createdAt'>) {
      if (!value.result.trim() || value.result.length > 10000)
        throw new Error('当前没有可保存的示例')
      const existing = state.aiArchives.find(
        (x) => x.mode === value.mode && x.prompt === value.prompt && x.result === value.result,
      )
      if (existing) return { ...existing }
      if (state.aiArchives.length >= 50) throw new Error('AI 示例最多保存 50 条，请先整理已有记录')
      const record = { ...value, id: identity(), createdAt: new Date().toISOString() }
      write({ ...state, aiArchives: [...state.aiArchives, record] })
      return { ...record }
    },
    removeExcerpt(id: string) {
      write({ ...state, excerpts: state.excerpts.filter((x) => x.id !== id) })
    },
    removeAiArchive(id: string) {
      write({ ...state, aiArchives: state.aiArchives.filter((x) => x.id !== id) })
    },
  }
}
