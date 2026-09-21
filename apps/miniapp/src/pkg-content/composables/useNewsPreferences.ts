import { ref, computed } from 'vue'
import { createNewsPreferences, type NewsPreferences } from '../domain/newsPreferences'
import { newsCategories } from '../../domain/contentCatalog'
import { t } from '../../composables/useLocale'
const failed = ref(false)
let repository: ReturnType<typeof createNewsPreferences> | undefined
try {
  repository = createNewsPreferences(
    {
      getItem: (key) => {
        const raw = uni.getStorageSync(key)
        return typeof raw === 'string' && raw ? raw : null
      },
      setItem: (key, value) => uni.setStorageSync(key, value),
    },
    newsCategories.filter((c) => c.id !== 'all').map((c) => c.id),
  )
} catch {
  failed.value = true
}
export const newsPreferenceError = computed(() => failed.value)
export const newsPreferences = ref<NewsPreferences>(
  repository?.read() ?? { categories: [], updates: true, digest: 'daily', quietHours: true },
)
export function updateNewsPreferences(patch: Partial<NewsPreferences>) {
  try {
    if (!repository || failed.value) throw Error()
    const next = repository.save({ ...newsPreferences.value, ...patch })
    newsPreferences.value = next
    return true
  } catch {
    uni.showToast({
      title: t(
        '订阅设置未能保存，请检查本机存储',
        'Could not save preferences. Check device storage.',
      ),
      icon: 'none',
    })
    return false
  }
}
export function toggleNewsCategory(id: string) {
  const selected = newsPreferences.value.categories
  return updateNewsPreferences({
    categories: selected.includes(id) ? selected.filter((v) => v !== id) : [...selected, id],
  })
}
