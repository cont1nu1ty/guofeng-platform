import { describe, it, expect } from 'vitest'
import { createPersonalArchive } from '../src/domain/personalArchive'
describe('personal archives', () => {
  it('persists unique excerpts and assistant examples', () => {
    let data: string | null = null
    const storage = {
      getItem: () => data,
      setItem: (_key: string, value: string) => {
        data = value
      },
    }
    const store = createPersonalArchive(storage)
    const value = { sourceId: 'book', sourceTitle: '书', text: '守信', note: '从日常开始' }
    const first = store.saveExcerpt(value)
    expect(store.saveExcerpt(value).id).toBe(first.id)
    store.saveAiArchive({ mode: 'rules', prompt: '诚信', result: '答应的事认真完成。' })
    expect(createPersonalArchive(storage).listAiArchives()).toHaveLength(1)
    store.removeExcerpt(first.id)
    expect(createPersonalArchive(storage).listExcerpts()).toHaveLength(0)
  })
  it('does not expose unsaved changes when storage fails', () => {
    const store = createPersonalArchive({
      getItem: () => null,
      setItem: () => {
        throw new Error('quota')
      },
    })
    expect(() =>
      store.saveExcerpt({ sourceId: 'book', sourceTitle: '书', text: '守信', note: '' }),
    ).toThrow('quota')
    expect(store.listExcerpts()).toHaveLength(0)
  })
})
