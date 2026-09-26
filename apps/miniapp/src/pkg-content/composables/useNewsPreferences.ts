import { ref, computed } from 'vue'
import { createNewsPreferences, type NewsPreferences } from '../domain/newsPreferences'
import { newsCategories } from '../../domain/contentCatalog'
import { t } from '../../composables/useLocale'
import { isHttpMode } from '../../config/dataMode'
import { command, remoteUser, remoteWorkspace } from '../../services/api'
const failed = ref(false)
export const newsPreferenceBusy = ref(false)
let repository: ReturnType<typeof createNewsPreferences> | undefined
if (!isHttpMode)
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
const local = ref<NewsPreferences>(
  repository?.read() ?? { categories: [], updates: true, digest: 'daily', quietHours: true },
)
export const newsPreferenceError = computed(() => failed.value)
export const newsPreferences = computed(() =>
  isHttpMode ? remoteWorkspace.newsPreferences : local.value,
)
export async function updateNewsPreferences(patch: Partial<NewsPreferences>) {
  if (newsPreferenceBusy.value) return false
  newsPreferenceBusy.value = true
  try {
    if (isHttpMode) {
      if (!remoteUser.value)
        throw new Error(t('请先登录后保存订阅设置', 'Sign in to save subscriptions.'))
      await command('news.preferences', undefined, { ...newsPreferences.value, ...patch })
    } else {
      if (!repository || failed.value)
        throw new Error(
          t(
            '订阅设置未能保存，请检查本机存储',
            'Could not save preferences. Check device storage.',
          ),
        )
      local.value = repository.save({ ...local.value, ...patch })
    }
    return true
  } catch (error) {
    uni.showToast({
      title:
        error instanceof Error
          ? error.message
          : t('保存失败，请重试', 'Save failed. Please retry.'),
      icon: 'none',
    })
    return false
  } finally {
    newsPreferenceBusy.value = false
  }
}
export function toggleNewsCategory(id: string) {
  const selected = newsPreferences.value.categories
  return updateNewsPreferences({
    categories: selected.includes(id) ? selected.filter((v) => v !== id) : [...selected, id],
  })
}
