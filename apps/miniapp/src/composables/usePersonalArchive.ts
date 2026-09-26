import { isHttpMode } from '../config/dataMode'
import { command, remoteWorkspace } from '../services/api'
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
const store = isHttpMode
  ? createPersonalArchive({
      getItem: () => null,
      setItem: () => {
        throw new Error('请使用云端存档接口')
      },
    })
  : init()
export const excerpts = computed(() => {
  version.value
  return isHttpMode ? remoteWorkspace.excerpts : store.listExcerpts()
})
export const aiArchives = computed(() => {
  version.value
  return isHttpMode ? remoteWorkspace.aiArchives : store.listAiArchives()
})
async function run<T>(action: () => T | Promise<T>): Promise<T | undefined> {
  try {
    const result = await action()
    version.value++
    return result
  } catch (error) {
    notify(error instanceof Error ? error.message : '存档未保存')
    return undefined
  }
}
export function saveExcerpt(value: Omit<Excerpt, 'id' | 'createdAt'>) {
  return run(() =>
    isHttpMode
      ? command<Excerpt>('archive.excerpt.save', undefined, value)
      : store.saveExcerpt(value),
  )
}
export function saveAiArchive(value: Omit<AiArchive, 'id' | 'createdAt'>) {
  return run(() =>
    isHttpMode
      ? command<AiArchive>('archive.ai.save', undefined, value)
      : store.saveAiArchive(value),
  )
}
export async function removeExcerpt(id: string): Promise<boolean> {
  return (
    (await run(async () => {
      if (isHttpMode) await command('archive.excerpt.remove', id)
      else store.removeExcerpt(id)
      return true
    })) === true
  )
}
export async function removeAiArchive(id: string): Promise<boolean> {
  return (
    (await run(async () => {
      if (isHttpMode) await command('archive.ai.remove', id)
      else store.removeAiArchive(id)
      return true
    })) === true
  )
}
