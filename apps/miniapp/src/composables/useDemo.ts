import { computed, ref } from 'vue'
import { createDemoRepository } from '../domain/repository'
import type { DemoRepository } from '../domain/repository'
import { regions } from '../domain/fixtures'
import type { RegionId, Work, Classic } from '../domain/types'

export { navigate, goBack } from './useNavigation'
export type { Screen } from './useNavigation'
export const region = ref<RegionId>('all')
export const largeText = ref(false)
export const revision = ref(0)
export const reader = ref<Work | Classic | null>(null)
export const verticalReading = ref(false)
export const storageError = ref<string | null>(null)
export const storageUnavailable = computed(() => storageError.value !== null)

function initializeRepository(): DemoRepository {
  try {
    return createDemoRepository({
      getItem(key) {
        const value = uni.getStorageSync(key)
        return typeof value === 'string' && value ? value : null
      },
      setItem(key, value) {
        uni.setStorageSync(key, value)
      },
    })
  } catch {
    storageError.value =
      '本机存储不可用，当前仅可浏览演示内容；草稿、投稿、收藏与预约无法保存。请检查设备存储权限后刷新。'
    const rejectWrite = (): never => {
      throw new Error(storageError.value ?? '本机存储不可用，请检查权限后刷新。')
    }
    const readonlyRepo = createDemoRepository({ getItem: () => null, setItem: rejectWrite })
    // 在仓库入口阻止修改，保留明确的不可用提示，且不覆盖无法读取的原有数据。
    return {
      ...readonlyRepo,
      saveDraft: rejectWrite,
      clearDraft: rejectWrite,
      submitWork: rejectWrite,
      toggleFavorite: rejectWrite,
      registerActivity: rejectWrite,
      cancelRegistration: rejectWrite,
    }
  }
}

export const repo = initializeRepository()
export const regionLabel = computed(
  () => regions.find((r) => r.id === region.value)?.label ?? '全国',
)
export const works = computed(() => {
  revision.value
  return repo.listWorks({ region: region.value })
})
export const myWorks = computed(() => {
  revision.value
  return repo.listMyWorks()
})
export const favorites = computed(() => {
  revision.value
  return repo.listFavorites()
})
export const registrations = computed(() => {
  revision.value
  return repo.listRegistrations()
})
export function notify(message: string) {
  uni.showToast({ title: message, icon: 'none', duration: 2400 })
}
export function safely<T>(action: () => T): T | undefined {
  try {
    const result = action()
    revision.value++
    return result
  } catch (error) {
    notify(error instanceof Error ? error.message : '操作未完成，请重试')
  }
}
export function openReader(item: Work | Classic) {
  reader.value = item
  verticalReading.value = false
}
export function favorite(id: string) {
  safely(() => repo.toggleFavorite(id))
}
export function isFavorite(id: string) {
  revision.value
  return repo.isFavorite(id)
}
export function isRegistered(id: string) {
  revision.value
  return repo.isRegistered(id)
}
export function register(id: string) {
  safely(() => {
    if (repo.isRegistered(id)) {
      repo.cancelRegistration(id)
      notify('已取消演示预约')
    } else {
      repo.registerActivity(id)
      notify('演示预约成功，可在个人中心查看')
    }
  })
}
