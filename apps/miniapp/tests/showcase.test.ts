import { beforeEach, describe, expect, it, vi } from 'vitest'
import { validateCommerceForm } from '../src/domain/showcaseCatalog'

const form = () => ({
  organization: '向阳社区（示例）',
  quantity: '20',
  purpose: '用于周末家风主题公益共读活动。',
  agreed: true,
})

describe('文创与短视频本机记录', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  it('申领数量必须是范围内的整数，且用途及确认不可省略', () => {
    expect(validateCommerceForm(form())).toBeNull()
    for (const quantity of ['0', '-1', '501', '1.5', '1e2', 'abc']) {
      expect(validateCommerceForm({ ...form(), quantity })).toBe('quantity')
    }
    expect(validateCommerceForm({ ...form(), quantity: '500' })).toBeNull()
    expect(validateCommerceForm({ ...form(), organization: ' ' })).toBe('organization')
    expect(validateCommerceForm({ ...form(), purpose: '共读' })).toBe('purpose')
    expect(validateCommerceForm({ ...form(), agreed: false })).toBe('agreement')
  })

  it('两类文创记录可保存、刷新恢复、取消，并阻止错误申领路径', async () => {
    const storage = new Map<string, string>()
    vi.stubGlobal('uni', {
      getStorageSync: (key: string) => storage.get(key),
      setStorageSync: (key: string, value: string) => storage.set(key, value),
    })
    const first = await import('../src/composables/useShowcase')
    const grant = first.createCommerceRequest('reading-kit', 'public', form())
    const custom = first.createCommerceRequest('family-book', 'custom', form())
    expect(grant.id).not.toBe(custom.id)
    expect(() => first.createCommerceRequest('reading-kit', 'custom', form())).toThrow(
      'invalid-product',
    )
    expect(() => first.createCommerceRequest('unknown', 'public', form())).toThrow(
      'invalid-product',
    )
    first.cancelCommerceRequest(grant.id)
    vi.resetModules()
    const restored = await import('../src/composables/useShowcase')
    expect(restored.commerceRequests.value).toHaveLength(2)
    expect(restored.commerceRequests.value.find((request) => request.id === grant.id)?.status).toBe(
      'cancelled',
    )
    expect(restored.commerceRequests.value.find((request) => request.id === custom.id)?.kind).toBe(
      'custom',
    )
  })

  it('视频点赞和收藏互相独立，刷新后保留，重复点击可以取消', async () => {
    const storage = new Map<string, string>()
    vi.stubGlobal('uni', {
      getStorageSync: (key: string) => storage.get(key),
      setStorageSync: (key: string, value: string) => storage.set(key, value),
    })
    const first = await import('../src/composables/useShowcase')
    first.toggleMediaFavorite('letter-01')
    first.toggleMediaLike('letter-01')
    first.toggleMediaLike('letter-01')
    first.toggleMediaFavorite('unknown')
    vi.resetModules()
    const restored = await import('../src/composables/useShowcase')
    expect(restored.mediaFavorites.value).toEqual(['letter-01'])
    expect(restored.mediaLikes.value).toEqual([])
    restored.toggleMediaFavorite('letter-01')
    expect(restored.mediaFavorites.value).toEqual([])
  })

  it('写入失败不呈现成功状态，不覆盖无法读取的旧数据', async () => {
    const write = vi.fn(() => {
      throw new Error('quota')
    })
    vi.stubGlobal('uni', { getStorageSync: () => null, setStorageSync: write })
    const full = await import('../src/composables/useShowcase')
    expect(() => full.createCommerceRequest('reading-kit', 'public', form())).toThrow(
      'showcase-storage',
    )
    expect(full.commerceRequests.value).toEqual([])
    expect(full.showcaseStorageError.value).toBe(true)
    vi.resetModules()
    const overwrite = vi.fn()
    vi.stubGlobal('uni', { getStorageSync: () => '{corrupted-json', setStorageSync: overwrite })
    const corrupted = await import('../src/composables/useShowcase')
    expect(() => corrupted.toggleMediaFavorite('letter-01')).toThrow('showcase-storage')
    expect(overwrite).not.toHaveBeenCalled()
  })
})
