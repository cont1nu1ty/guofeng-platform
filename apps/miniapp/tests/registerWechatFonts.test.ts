import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  registerWechatFonts,
  type WechatFontApi,
  type WechatFontFaceOptions,
} from '../src/composables/registerWechatFonts'

const fonts = [
  { family: 'JiafengSans', weight: '400', source: 'url("data:font/woff;base64,c2Fucw==")' },
  { family: 'JiafengSerif', weight: '600', source: 'url("data:font/woff;base64,c2VyaWY=")' },
]
afterEach(() => vi.useRealTimers())

describe('微信离线字体注册', () => {
  it('直接全局注册编译期字体，保留字重与Data URL，并优先使用App基础信息', async () => {
    const loadFontFace = vi.fn((options: WechatFontFaceOptions) =>
      options.success({ status: 'loaded' }),
    )
    const getSystemInfoSync = vi.fn(() => ({ SDKVersion: '2.10.0' }))
    const result = await registerWechatFonts(fonts, {
      getAppBaseInfo: () => ({ SDKVersion: '3.17.2' }),
      getSystemInfoSync,
      loadFontFace,
    })
    expect(getSystemInfoSync).not.toHaveBeenCalled()
    for (const [index, font] of fonts.entries()) {
      expect(loadFontFace.mock.calls[index]![0]).toMatchObject({
        global: true,
        family: font.family,
        source: font.source,
        desc: { style: 'normal', weight: font.weight, variant: 'normal' },
      })
      expect(result[index]).toEqual({
        family: font.family,
        loaded: true,
        source: 'bundled-data-uri',
      })
    }
  })

  it('SDK按数字比较，3.7.9边界及3.17.2等新版本可以加载', async () => {
    for (const SDKVersion of ['3.7.9', '3.7.10', '3.17.2', '4.0.0', '3.7.9.1']) {
      const results = await registerWechatFonts(fonts, {
        getAppBaseInfo: () => ({ SDKVersion }),
        loadFontFace: (options) => options.success({ status: 'loaded' }),
      })
      expect(results.every((font) => font.loaded)).toBe(true)
    }
  })

  it('旧SDK不调用离线字体API，明确返回升级微信与系统字体回退', async () => {
    for (const SDKVersion of ['2.10.0', '3.6.99', '3.7.8']) {
      const loadFontFace = vi.fn()
      const results = await registerWechatFonts(fonts, {
        getAppBaseInfo: () => ({ SDKVersion }),
        loadFontFace,
      })
      expect(loadFontFace).not.toHaveBeenCalled()
      expect(results).toHaveLength(2)
      for (const result of results) {
        expect(result.loaded).toBe(false)
        expect(result.errorCode).toBe('unsupported-sdk')
        expect(result.error).toContain('升级微信')
      }
    }
  })

  it('基础信息API缺失或异常时兼容旧系统信息API', async () => {
    for (const getAppBaseInfo of [
      undefined,
      () => ({}),
      () => {
        throw new Error('unsupported')
      },
    ]) {
      const legacy = vi.fn(() => ({ SDKVersion: '3.7.8' }))
      const loadFontFace = vi.fn()
      const result = await registerWechatFonts(fonts, {
        getAppBaseInfo,
        getSystemInfoSync: legacy,
        loadFontFace,
      })
      expect(legacy).toHaveBeenCalledOnce()
      expect(loadFontFace).not.toHaveBeenCalled()
      expect(result[0]?.errorCode).toBe('unsupported-sdk')
    }
  })

  it('未知SDK仍实际尝试，只有loaded状态才成功，不将空回调或unloaded当成功', async () => {
    const calls: WechatFontFaceOptions[] = []
    let settled = false
    const promise = registerWechatFonts(fonts, {
      getAppBaseInfo: () => ({ SDKVersion: 'unknown' }),
      getSystemInfoSync: () => {
        throw new Error('unavailable')
      },
      loadFontFace: (options) => calls.push(options),
    }).then((results) => {
      settled = true
      return results
    })
    await Promise.resolve()
    expect(calls).toHaveLength(2)
    expect(settled).toBe(false)
    calls[0]!.success()
    calls[1]!.success({ status: 'unloaded' })
    const results = await promise
    expect(results.every((font) => !font.loaded && font.errorCode === 'not-detected')).toBe(true)
    const successful = await registerWechatFonts(fonts, {
      loadFontFace: (options) => options.success({ status: 'loaded' }),
    })
    expect(successful.every((font) => font.loaded)).toBe(true)
  })

  it('分别报告单份字体成功或失败，失败原因简短且不暴露原始技术对象', async () => {
    const results = await registerWechatFonts(fonts, {
      getAppBaseInfo: () => ({ SDKVersion: '3.17.2' }),
      loadFontFace: (options) => {
        if (options.family === 'JiafengSans') options.success({ status: 'loaded' })
        else
          options.fail({
            errMsg: 'loadFontFace:fail invalid font format',
            debugSource: fonts[1]!.source,
          })
      },
    })
    expect(results[0]?.loaded).toBe(true)
    expect(results[1]).toMatchObject({ loaded: false, errorCode: 'invalid-font' })
    expect(JSON.stringify(results)).not.toContain('base64')
    expect(results[1]!.error!.length).toBeLessThan(60)
  })

  it('缺失API、同步异常和拒绝回调都返回真实失败', async () => {
    const scenarios: [WechatFontApi, string][] = [
      [{}, 'unavailable'],
      [
        {
          loadFontFace: () => {
            throw new Error('loadFontFace failed')
          },
        },
        'load-failed',
      ],
      [
        { loadFontFace: (options) => options.fail({ errMsg: 'permission denied' }) },
        'permission-denied',
      ],
    ]
    for (const [api, code] of scenarios) {
      const results = await registerWechatFonts(fonts, api)
      expect(results.every((font) => !font.loaded && font.errorCode === code)).toBe(true)
    }
  })

  it('8秒无回应回退，保留另一字体成功状态，迟到回调不能改写已发布结果', async () => {
    vi.useFakeTimers()
    let late: WechatFontFaceOptions | undefined
    let settled = false
    const promise = registerWechatFonts(fonts, {
      loadFontFace: (options) => {
        if (options.family === 'JiafengSans') options.success({ status: 'loaded' })
        else late = options
      },
    }).then((results) => {
      settled = true
      return results
    })
    await vi.advanceTimersByTimeAsync(7999)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    const results = await promise
    expect(results[0]?.loaded).toBe(true)
    expect(results[1]).toMatchObject({ loaded: false, errorCode: 'timeout' })
    late!.success({ status: 'loaded' })
    expect(results[1]?.loaded).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })
})
