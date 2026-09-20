/**
 * Source Han font subsets with no mandatory third-party request.
 * H5: actual local @font-face + FontFaceSet verification.
 * WeChat: read the packaged WOFF as a data URI and attempt global font registration.
 * The official WeChat contract guarantees HTTPS fonts; this offline path still
 * needs real-device verification. A failed registration leaves CSS fallbacks active.
 * See docs/09-fonts.md for coverage, licenses and the deployment alternative.
 */
export interface FontLoadResult {
  family: string
  loaded: boolean
  source: 'local-css' | 'local-data-uri' | 'unavailable'
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

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'errMsg' in error) return String(error.errMsg)
  return String(error)
}

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
        error: '字体加载超时，使用系统后备字体',
      })
    }, 8000)
    operation.then(
      (loaded) => {
        clearTimeout(timer)
        resolve({
          family: font.family,
          loaded,
          source,
          ...(loaded ? {} : { error: '未检测到字体' }),
        })
      },
      (error: unknown) => {
        clearTimeout(timer)
        resolve({ family: font.family, loaded: false, source, error: errorText(error) })
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
  operations = fonts.map((font) =>
    withDeadline(
      font,
      'local-data-uri',
      new Promise<boolean>((resolve, reject) => {
        const fs = uni.getFileSystemManager()
        fs.readFile({
          filePath: `static/fonts/${font.file}`,
          encoding: 'base64',
          success(result) {
            uni.loadFontFace({
              global: true,
              family: font.family,
              source: `url("data:font/woff;base64,${String(result.data)}")`,
              desc: { style: 'normal', weight: font.weight, variant: 'normal' },
              success: () => resolve(true),
              fail: reject,
            })
          },
          fail: reject,
        })
      }),
    ),
  )
  // #endif

  const results = await Promise.all(operations)
  return { platform, allLoaded: results.every((font) => font.loaded), fonts: results }
}

/** Call once from App.onLaunch; multiple calls reuse the same result. */
export function loadFonts(): Promise<FontsLoadResult> {
  loading ??= loadAll()
  return loading
}
