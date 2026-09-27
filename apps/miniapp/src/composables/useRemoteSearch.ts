import { ref } from 'vue'
import { ApiError } from '../services/api'
import { searchRemote, type SearchPage, type SearchQuery } from '../services/search'

/** Request generation, rather than completion order, determines the visible result. */
export function useRemoteSearch(fetchPage = searchRemote) {
  const page = ref<SearchPage>({ items: [], total: 0, counts: {}, nextCursor: null })
  const loading = ref(false)
  const error = ref('')
  const errorCode = ref('')
  let generation = 0
  let disposed = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let query: SearchQuery | undefined
  let retryMore = false
  function clear() {
    generation++
    if (timer) clearTimeout(timer)
    page.value = { items: [], total: 0, counts: {}, nextCursor: null }
    error.value = ''
    errorCode.value = ''
    loading.value = false
  }
  async function load(more = false) {
    if (!query || disposed) return
    const requestGeneration = ++generation
    loading.value = true
    error.value = ''
    errorCode.value = ''
    retryMore = more
    try {
      const result = await fetchPage({
        ...query,
        cursor: more ? page.value.nextCursor || undefined : undefined,
      })
      if (disposed || generation !== requestGeneration) return
      page.value = {
        ...result,
        items: more ? [...page.value.items, ...result.items] : result.items,
      }
    } catch (failure) {
      if (disposed || generation !== requestGeneration) return
      if (failure instanceof ApiError && failure.code === 'SEARCH_CHANGED' && more) {
        page.value = { items: [], total: 0, counts: {}, nextCursor: null }
        await load(false)
        return
      }
      // A withdrawn title must not linger on screen when the catalogue has changed.
      if (
        failure instanceof ApiError &&
        ['SEARCH_CHANGED', 'SEARCH_UPDATING', 'SESSION_CHANGED'].includes(failure.code)
      )
        page.value = { items: [], total: 0, counts: {}, nextCursor: null }
      errorCode.value = failure instanceof ApiError ? failure.code : 'NETWORK_ERROR'
      error.value = failure instanceof Error ? failure.message : '搜索失败，请重试。'
    } finally {
      if (!disposed && generation === requestGeneration) loading.value = false
    }
  }
  function search(input: SearchQuery, delay = 300) {
    clear()
    query = input
    loading.value = true
    timer = setTimeout(() => {
      void load()
    }, delay)
  }
  function dispose() {
    clear()
    disposed = true
  }
  return {
    page,
    loading,
    error,
    errorCode,
    search,
    more: () => load(true),
    retry: () => load(retryMore),
    dispose,
  }
}
