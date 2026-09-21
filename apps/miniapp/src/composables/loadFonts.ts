/**
 * Source Han font subsets with no mandatory third-party request.
 * H5: actual local @font-face + FontFaceSet verification.
 * WeChat: register build-time bundled WOFF data URIs globally (SDK 3.7.9+).
 * A failed registration leaves CSS fallbacks active; device rendering still needs validation.
 * See docs/engineering/fonts.md for coverage, licenses and the deployment alternative.
 */
// #ifdef MP-WEIXIN
import bundledWechatFonts from 'virtual:jiafeng-wechat-fonts'
import { registerWechatFonts } from './registerWechatFonts'
// #endif

export type FontLoadFailure =
  | 'unsupported-sdk'
  | 'unavailable'
  | 'timeout'
  | 'invalid-font'
  | 'permission-denied'
  | 'load-failed'
  | 'not-detected'

export interface FontLoadResult {
  family: string
  loaded: boolean
  source: 'local-css' | 'bundled-data-uri' | 'unavailable'
  errorCode?: FontLoadFailure
  error?: string
}

export interface FontsLoadResult {
  platform: 'h5' | 'mp-weixin' | 'other'
  allLoaded: boolean
  fonts: FontLoadResult[]
}

const fonts = [
  { family: 'JiafengSans', weight: '400', file: 'JiafengSans-Regular.woff' },
  { family: 'JiafengSerif', weight: '600', file: 'JiafengSerif-SemiBold.woff' },
] as const

let loading: Promise<FontsLoadResult> | undefined

// This timeout reports a fallback status; it does not block app startup or navigation.
function withDeadline(
  font: (typeof fonts)[number],
  source: FontLoadResult['source'],
  operation: Promise<boolean>,
): Promise<FontLoadResult> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({
        family: font.family,
        loaded: false,
        source,
        errorCode: 'timeout',
        error: '字体加载超时，状态暂未确认',
      })
    }, 8000)
    operation.then(
      (loaded) => {
        clearTimeout(timer)
        resolve({
          family: font.family,
          loaded,
          source,
          ...(loaded ? {} : { errorCode: 'not-detected' as const, error: '未检测到字体' }),
        })
      },
      () => {
        clearTimeout(timer)
        resolve({
          family: font.family,
          loaded: false,
          source,
          errorCode: 'load-failed',
          error: '字体加载失败，使用系统后备字体',
        })
      },
    )
  })
}

async function loadAll(): Promise<FontsLoadResult> {
  let platform: FontsLoadResult['platform'] = 'other'
  let operations: Promise<FontLoadResult>[] = fonts.map((font) =>
    Promise.resolve({ family: font.family, loaded: false, source: 'unavailable' }),
  )

  // #ifdef H5
  platform = 'h5'
  operations = fonts.map((font) =>
    withDeadline(
      font,
      'local-css',
      typeof document !== 'undefined' && document.fonts
        ? document.fonts
            .load(`${font.weight} 16px "${font.family}"`, '家风中华行')
            .then((faces) => faces.some((face) => face.status === 'loaded'))
        : Promise.resolve(false),
    ),
  )
  // #endif

  // #ifdef MP-WEIXIN
  platform = 'mp-weixin'
  return registerWechatFonts(bundledWechatFonts, uni).then((results) => ({
    platform: 'mp-weixin',
    allLoaded: results.length > 0 && results.every((font) => font.loaded),
    fonts: results,
  }))
  // #endif

  const results = await Promise.all(operations)
  return { platform, allLoaded: results.every((font) => font.loaded), fonts: results }
}

/** Call once from App.onLaunch; multiple calls reuse the same result. */
export function loadFonts(): Promise<FontsLoadResult> {
  loading ??= loadAll()
  return loading
}
