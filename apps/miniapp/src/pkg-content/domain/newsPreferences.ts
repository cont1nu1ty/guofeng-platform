import type { DemoStorage } from '../../domain/types'
export interface NewsPreferences {
  categories: string[]
  updates: boolean
  digest: 'instant' | 'daily' | 'weekly'
  quietHours: boolean
}
const key = 'jiafeng:news-preferences:v1'
export function createNewsPreferences(storage: DemoStorage, allowed: string[]) {
  let state: NewsPreferences = { categories: [], updates: true, digest: 'daily', quietHours: true }
  const raw = storage.getItem(key)
  if (raw) {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') throw Error('preferences-invalid')
    const v = value as NewsPreferences
    if (
      !Array.isArray(v.categories) ||
      v.categories.some((c) => typeof c !== 'string') ||
      typeof v.updates !== 'boolean' ||
      !['instant', 'daily', 'weekly'].includes(v.digest) ||
      typeof v.quietHours !== 'boolean'
    )
      throw Error('preferences-invalid')
    state = { ...v, categories: [...new Set(v.categories.filter((c) => allowed.includes(c)))] }
  }
  const read = () => ({ ...state, categories: [...state.categories] })
  function save(next: NewsPreferences) {
    if (
      next.categories.some((c) => !allowed.includes(c)) ||
      !['instant', 'daily', 'weekly'].includes(next.digest)
    )
      throw Error('preferences-invalid')
    const value = { ...next, categories: [...new Set(next.categories)] }
    storage.setItem(key, JSON.stringify(value))
    state = value
    return read()
  }
  return { read, save }
}
