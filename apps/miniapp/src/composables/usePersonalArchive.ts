import { computed, ref } from 'vue'
import { createPersonalArchive, type Excerpt, type AiArchive } from '../domain/personalArchive'
import { notify } from './useDemo'
const version = ref(0)
export const archiveError = ref(false)
function init() {
  try {
    return createPersonalArchive({
      getItem: (key) => uni.getStorageSync(key) || null,
      setItem: (key, value) => uni.setStorageSync(key, value),
    })
  } catch {
    archiveError.value = true
    return createPersonalArchive({
      getItem: () => null,
      setItem: () => {
        throw new Error('本机存档不可用，原有数据未被覆盖')
      },
    })
  }
}
const store = init()
export const excerpts = computed(() => {
  version.value
  return store.listExcerpts()
})
export const aiArchives = computed(() => {
  version.value
  return store.listAiArchives()
})
function run<T>(action: () => T): T | undefined {
  try {
    const result = action()
    version.value++
    return result
  } catch (error) {
    notify(error instanceof Error ? error.message : '存档未保存')
    return undefined
  }
}
export function saveExcerpt(value: Omit<Excerpt, 'id' | 'createdAt'>) {
  return run(() => store.saveExcerpt(value))
}
export function saveAiArchive(value: Omit<AiArchive, 'id' | 'createdAt'>) {
  return run(() => store.saveAiArchive(value))
}
export function removeExcerpt(id: string): boolean {
  return (
    run(() => {
      store.removeExcerpt(id)
      return true
    }) === true
  )
}
export function removeAiArchive(id: string): boolean {
  return (
    run(() => {
      store.removeAiArchive(id)
      return true
    }) === true
  )
}
