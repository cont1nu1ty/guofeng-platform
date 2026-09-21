import { computed, onBeforeUnmount, ref, watch, type ComputedRef } from 'vue'
import { assetUrl } from './useAssetUrl'
import { t } from '../../composables/useLocale'
interface Replay {
  id: string
  source: string
}
const cacheName = 'jiafeng-replays-v1'
const nativeDataPath = () =>
  (uni as unknown as { env: { USER_DATA_PATH: string } }).env.USER_DATA_PATH
export function useReplayCache(item: ComputedRef<Replay | undefined>) {
  const cached = ref(false)
  const busy = ref(false)
  const message = ref('')
  const cachedPath = ref('')
  const useCached = ref(false)
  let generation = 0
  // #ifdef H5
  let objectUrl = ''
  // #endif
  const source = computed(() =>
    useCached.value && cachedPath.value ? cachedPath.value : assetUrl(item.value?.source ?? ''),
  )
  async function refresh() {
    const token = ++generation
    cached.value = false
    cachedPath.value = ''
    useCached.value = false
    message.value = ''
    // #ifdef H5
    if (objectUrl) URL.revokeObjectURL(objectUrl)
    objectUrl = ''
    try {
      if (!item.value || !('caches' in window)) return
      const cache = await caches.open(cacheName)
      const response = await cache.match(assetUrl(item.value.source))
      if (!response) return
      const blob = await response.blob()
      if (token !== generation) return
      objectUrl = URL.createObjectURL(blob)
      cachedPath.value = objectUrl
      cached.value = true
    } catch {
      if (token === generation)
        message.value = t('无法读取回放缓存。', 'Replay cache could not be read.')
    }
    // #endif
    // #ifdef MP-WEIXIN
    try {
      if (!item.value) return
      const path = uni.getStorageSync(`${cacheName}:${item.value.id}`)
      if (typeof path === 'string' && path) {
        uni.getFileSystemManager().access({
          path,
          success() {
            if (token === generation) {
              cachedPath.value = path
              cached.value = true
            }
          },
        })
      }
    } catch {
      message.value = t('无法读取回放缓存。', 'Replay cache could not be read.')
    }
    // #endif
  }
  async function save() {
    if (!item.value || busy.value) return
    busy.value = true
    message.value = ''
    const current = item.value
    const token = generation
    // #ifdef H5
    try {
      if (!('caches' in window)) throw new Error('unsupported')
      const url = assetUrl(current.source)
      const response = await fetch(url)
      if (!response.ok) throw new Error('download')
      const cache = await caches.open(cacheName)
      await cache.put(url, response)
      if (token !== generation) return
      const expected = generation + 1
      await refresh()
      if (expected === generation)
        message.value = t(
          '回放文件已缓存。页面已打开时，可切换为缓存播放；不代表整个站点可离线启动。',
          'Replay file cached. Switch to cached playback while this page is open; the whole site is not available offline.',
        )
    } catch {
      if (token === generation)
        message.value = t(
          '缓存失败，可能是网络、容量或浏览器不支持。可继续在线播放。',
          'Caching failed: network, space or browser support. Online playback remains available.',
        )
    } finally {
      busy.value = false
    }
    return undefined
    // #endif
    // #ifdef MP-WEIXIN
    const fs = uni.getFileSystemManager()
    const destination = `${nativeDataPath()}/jiafeng-replay-${current.id}.mp4`
    fs.copyFile({
      srcPath: assetUrl(current.source),
      destPath: destination,
      success() {
        try {
          uni.setStorageSync(`${cacheName}:${current.id}`, destination)
          if (token === generation) {
            cached.value = true
            cachedPath.value = destination
            message.value = t('回放文件已保存到本机。', 'Replay file saved on this device.')
          }
        } catch {
          fs.unlink({ filePath: destination })
          if (token === generation)
            message.value = t('缓存记录保存失败。', 'Could not save cache metadata.')
        }
      },
      fail() {
        if (token === generation)
          message.value = t(
            '本端未能保存回放，仍可播放随包样片。',
            'Replay could not be saved. The packaged sample is still available.',
          )
      },
      complete() {
        busy.value = false
      },
    })
    return undefined
    // #endif
    busy.value = false
  }
  async function remove() {
    if (!item.value || busy.value) return
    busy.value = true
    message.value = ''
    const current = item.value
    const path = cachedPath.value
    const token = generation
    // #ifdef H5
    try {
      const cache = await caches.open(cacheName)
      await cache.delete(assetUrl(current.source))
      if (token !== generation) return
      const expected = generation + 1
      await refresh()
      if (expected === generation) message.value = t('已删除回放缓存。', 'Replay cache deleted.')
    } catch {
      if (token === generation)
        message.value = t('删除缓存失败，请重试。', 'Cache could not be deleted. Retry.')
    } finally {
      busy.value = false
    }
    return undefined
    // #endif
    // #ifdef MP-WEIXIN
    if (!path.startsWith(`${nativeDataPath()}/jiafeng-replay-`)) {
      busy.value = false
      return
    }
    uni.getFileSystemManager().unlink({
      filePath: path,
      success() {
        try {
          uni.removeStorageSync(`${cacheName}:${current.id}`)
        } catch {
          /* A stale entry is ignored by the next access check. */
        }
        if (token === generation) {
          cached.value = false
          cachedPath.value = ''
          useCached.value = false
          message.value = t('已删除回放缓存。', 'Replay cache deleted.')
        }
      },
      fail() {
        if (token === generation)
          message.value = t('删除缓存失败，请重试。', 'Cache could not be deleted. Retry.')
      },
      complete() {
        busy.value = false
      },
    })
    return undefined
    // #endif
    busy.value = false
  }
  watch(() => item.value?.id, refresh, { immediate: true })
  onBeforeUnmount(() => {
    generation++
    // #ifdef H5
    if (objectUrl) URL.revokeObjectURL(objectUrl)
    // #endif
  })
  return { cached, busy, message, source, useCached, save, remove }
}
