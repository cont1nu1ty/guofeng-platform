import { computed, inject, type Ref, type InjectionKey } from 'vue'
export type Screen =
  | 'home'
  | 'submit'
  | 'library'
  | 'learning'
  | 'review'
  | 'profile'
  | 'assistant'
  | 'admin'
  | 'news'
  | 'classroom'
  | 'venues'
  | 'media'
  | 'hall'
  | 'shop'
export const screens: Screen[] = [
  'home',
  'submit',
  'library',
  'learning',
  'review',
  'profile',
  'assistant',
  'admin',
  'news',
  'classroom',
  'venues',
  'media',
  'hall',
  'shop',
]
export const routeKey: InjectionKey<Ref<Record<string, string>>> = Symbol('jiafeng-route')
export function useRouteParams(): Ref<Record<string, string>> {
  return inject(
    routeKey,
    computed(() => ({})),
  )
}
export function navigate(target: Screen, params: Record<string, string> = {}) {
  const query = Object.entries({ screen: target, ...params })
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
  const url = target === 'home' ? '/pages/index/index' : `/pages/explore/index?${query}`
  if (Object.keys(params).length && getCurrentPages().length < 9) uni.navigateTo({ url })
  else uni.reLaunch({ url })
}
export function goBack() {
  if (getCurrentPages().length > 1) uni.navigateBack()
  else navigate('home')
}
