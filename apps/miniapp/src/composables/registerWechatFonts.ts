import type { FontLoadFailure, FontLoadResult } from './loadFonts'

export interface BundledWechatFont {
  family: string
  weight: string
  source: string
}

export interface WechatFontFaceOptions {
  global: true
  family: string
  source: string
  desc: { style: 'normal'; weight: string; variant: 'normal' }
  success: (result?: { status?: string }) => void
  fail: (error: unknown) => void
}

export interface WechatFontApi {
  getAppBaseInfo?: () => { SDKVersion?: string }
  getSystemInfoSync?: () => { SDKVersion?: string }
  loadFontFace?: (options: WechatFontFaceOptions) => unknown
}

const failureMessages: Record<FontLoadFailure, string> = {
  'unsupported-sdk': '请升级微信后使用离线字体，当前使用系统后备字体',
  unavailable: '当前环境不支持字体加载，使用系统后备字体',
  timeout: '字体加载超时，状态暂未确认',
  'invalid-font': '字体文件未能识别，使用系统后备字体',
  'permission-denied': '微信未允许加载字体，使用系统后备字体',
  'load-failed': '字体加载失败，使用系统后备字体',
  'not-detected': '未检测到字体加载成功，使用系统后备字体',
}

function failed(font: BundledWechatFont, errorCode: FontLoadFailure): FontLoadResult {
  return {
    family: font.family,
    loaded: false,
    source: 'bundled-data-uri',
    errorCode,
    error: failureMessages[errorCode],
  }
}

function versionParts(version: unknown): number[] | undefined {
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:\.\d+)*$/.test(version.trim()))
    return undefined
  const parts = version.trim().split('.').map(Number)
  return parts.every(Number.isSafeInteger) ? parts : undefined
}

function sdkVersion(api: WechatFontApi): number[] | undefined {
  try {
    const version = versionParts(api.getAppBaseInfo?.().SDKVersion)
    if (version) return version
  } catch {
    // Older environments may lack the narrower system API.
  }
  try {
    return versionParts(api.getSystemInfoSync?.().SDKVersion)
  } catch {
    return undefined
  }
}

function isOlderThanDataUriSupport(version: number[]): boolean {
  const minimum = [3, 7, 9]
  for (let index = 0; index < minimum.length; index++) {
    if (version[index] !== minimum[index]) return version[index]! < minimum[index]!
  }
  return false
}

function failureCode(error: unknown): FontLoadFailure {
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === 'object' && 'errMsg' in error
        ? String(error.errMsg)
        : typeof error === 'string'
          ? error
          : ''
  if (/permission|denied|not allowed|权限|拒绝/i.test(message)) return 'permission-denied'
  if (/invalid|parse|decode|format|格式|解析/i.test(message)) return 'invalid-font'
  return 'load-failed'
}

/** Offline registration only; success is reported after WeChat confirms status: loaded. */
export async function registerWechatFonts(
  fonts: readonly BundledWechatFont[],
  api: WechatFontApi,
): Promise<FontLoadResult[]> {
  const version = sdkVersion(api)
  if (version && isOlderThanDataUriSupport(version))
    return fonts.map((font) => failed(font, 'unsupported-sdk'))
  if (!api.loadFontFace) return fonts.map((font) => failed(font, 'unavailable'))

  return Promise.all(
    fonts.map(
      (font) =>
        new Promise<FontLoadResult>((resolve) => {
          let settled = false
          const finish = (result: FontLoadResult) => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            resolve(result)
          }
          const timer = setTimeout(() => finish(failed(font, 'timeout')), 8000)
          try {
            api.loadFontFace!({
              global: true,
              family: font.family,
              source: font.source,
              desc: { style: 'normal', weight: font.weight, variant: 'normal' },
              success: (result) => {
                finish(
                  result?.status === 'loaded'
                    ? { family: font.family, loaded: true, source: 'bundled-data-uri' }
                    : failed(font, 'not-detected'),
                )
              },
              fail: (error) => finish(failed(font, failureCode(error))),
            })
          } catch (error) {
            finish(failed(font, failureCode(error)))
          }
        }),
    ),
  )
}
