import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SearchPage } from '../src/services/search'
const result = (id: string, nextCursor: string | null = null): SearchPage => ({
  items: [
    {
      id,
      kind: 'news',
      screen: 'news',
      contentId: id,
      title: { zh: id, en: '' },
      summary: { zh: '', en: '' },
      region: 'all',
    },
  ],
  total: 20,
  counts: { all: 20, news: 20 },
  nextCursor,
})
const input = { q: '家风', kind: 'all' as const, region: 'all', language: 'zh' as const }
beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  vi.stubGlobal('uni', { getStorageSync: () => '', request: vi.fn() })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
describe('remote search lifecycle', () => {
  it('debounces changes and never uses loaded workspace data as results', async () => {
    const { useRemoteSearch } = await import('../src/composables/useRemoteSearch')
    const fetchPage = vi.fn().mockResolvedValue(result('published'))
    const search = useRemoteSearch(fetchPage)
    search.search(input)
    search.search({ ...input, q: '家书' })
    expect(search.page.value.items).toEqual([])
    await vi.advanceTimersByTimeAsync(300)
    expect(fetchPage).toHaveBeenCalledTimes(1)
    expect(fetchPage.mock.calls[0]?.[0].q).toBe('家书')
    expect(search.page.value.items[0]?.id).toBe('published')
    search.dispose()
  })
  it('ignores late responses for earlier filters', async () => {
    const { useRemoteSearch } = await import('../src/composables/useRemoteSearch')
    let first: (page: SearchPage) => void = () => {}
    const fetchPage = vi
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => (first = resolve)))
      .mockResolvedValue(result('new'))
    const search = useRemoteSearch(fetchPage)
    search.search(input, 0)
    await vi.advanceTimersByTimeAsync(0)
    search.search({ ...input, region: 'beijing' }, 0)
    await vi.advanceTimersByTimeAsync(0)
    first(result('old'))
    await Promise.resolve()
    expect(search.page.value.items.map((x) => x.id)).toEqual(['new'])
    search.dispose()
  })
  it('restarts from page one when the catalogue changes during pagination', async () => {
    const { useRemoteSearch } = await import('../src/composables/useRemoteSearch')
    const { ApiError } = await import('../src/services/api')
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(result('old', 'cursor'))
      .mockRejectedValueOnce(new ApiError('SEARCH_CHANGED', '内容已更新', 409))
      .mockResolvedValueOnce(result('fresh'))
    const search = useRemoteSearch(fetchPage)
    search.search(input, 0)
    await vi.advanceTimersByTimeAsync(0)
    await search.more()
    expect(fetchPage.mock.calls[1]?.[0].cursor).toBe('cursor')
    expect(fetchPage.mock.calls[2]?.[0].cursor).toBeUndefined()
    expect(search.page.value.items.map((x) => x.id)).toEqual(['fresh'])
    expect(search.loading.value).toBe(false)
    search.dispose()
  })
  it('removes stale titles and counts while the index updates, then permits retry', async () => {
    const { useRemoteSearch } = await import('../src/composables/useRemoteSearch')
    const { ApiError } = await import('../src/services/api')
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(result('withdrawn', 'cursor'))
      .mockRejectedValueOnce(new ApiError('SEARCH_UPDATING', '搜索更新中', 503))
      .mockResolvedValueOnce(result('new'))
    const search = useRemoteSearch(fetchPage)
    search.search(input, 0)
    await vi.advanceTimersByTimeAsync(0)
    await search.more()
    expect(search.page.value.items).toEqual([])
    expect(search.page.value.counts).toEqual({})
    expect(search.errorCode.value).toBe('SEARCH_UPDATING')
    await search.retry()
    expect(search.page.value.items[0]?.id).toBe('new')
    search.dispose()
  })
  it('does not apply responses after disposal', async () => {
    const { useRemoteSearch } = await import('../src/composables/useRemoteSearch')
    let finish: (page: SearchPage) => void = () => {}
    const search = useRemoteSearch(() => new Promise((resolve) => (finish = resolve)))
    search.search(input, 0)
    await vi.advanceTimersByTimeAsync(0)
    search.dispose()
    finish(result('late'))
    await Promise.resolve()
    expect(search.page.value.items).toEqual([])
  })
})
