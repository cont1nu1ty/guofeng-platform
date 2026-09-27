import { ApiError, currentSessionEpoch, request } from './api'
import type { SearchEntry, SearchKind } from '../domain/searchCatalog'
export interface SearchPage {
  items: Omit<SearchEntry, 'text'>[]
  total: number
  counts: Partial<Record<SearchKind | 'all', number>>
  nextCursor: string | null
  generation?: number
}
export interface SearchQuery {
  q: string
  kind: SearchKind | 'all'
  region: string
  language: 'zh' | 'en'
  cursor?: string
  pageSize?: number
}
export async function searchRemote(input: SearchQuery): Promise<SearchPage> {
  const epoch = currentSessionEpoch()
  const query = Object.entries({ ...input, pageSize: input.pageSize ?? 12 })
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
  const { data } = await request<SearchPage>(`/search?${query}`)
  if (epoch !== currentSessionEpoch())
    throw new ApiError('SESSION_CHANGED', '账户已改变，请重新搜索。')
  return data
}
