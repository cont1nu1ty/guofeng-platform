import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isMediaRecord, validateMediaFile } from '../src/domain/localMedia'
beforeEach(() => {
  vi.resetModules()
  vi.unstubAllGlobals()
})
describe('local media demonstration records', () => {
  it('rejects non-media, empty and oversized files before a record is created', () => {
    expect(validateMediaFile({ name: 'notes.pdf', path: 'local', size: 20 }, 'recitation')).toBe(
      'format',
    )
    expect(validateMediaFile({ name: 'read.mp3', path: 'local', size: 0 }, 'recitation')).toBe(
      'size',
    )
    expect(
      validateMediaFile({ name: 'video.mp4', path: 'local', size: 51 * 1024 * 1024 }, 'video'),
    ).toBe('size')
    expect(
      validateMediaFile({ name: 'video.mp4', path: 'local', size: 100, duration: 601 }, 'video'),
    ).toBe('duration')
    expect(
      isMediaRecord({
        id: 'x',
        kind: 'video',
        title: 'A',
        category: 'ai',
        fileName: 'a.mp4',
        size: Infinity,
        duration: 1,
        createdAt: 'today',
      }),
    ).toBe(false)
  })
  it('persists metadata and restores it without pretending that a session file survived reload', async () => {
    const data = new Map<string, string>()
    vi.stubGlobal('uni', {
      getStorageSync: (key: string) => data.get(key),
      setStorageSync: (key: string, value: string) => data.set(key, value),
    })
    let module = await import('../src/composables/useLocalMedia')
    const record = module.saveLocalMedia(
      {
        kind: 'recitation',
        title: 'Original reading',
        category: 'reading',
        fileName: 'read.mp3',
        size: 100,
        duration: 12,
      },
      'blob:session-only',
    )
    expect(module.localMediaPath(record.id)).toBe('blob:session-only')
    expect([...data.values()].join('')).not.toContain('blob:')
    vi.resetModules()
    module = await import('../src/composables/useLocalMedia')
    expect(module.recitationRecords.value[0]?.id).toBe(record.id)
    expect(module.localMediaPath(record.id)).toBe('')
    module.removeLocalMedia(record.id)
    expect(module.recitationRecords.value).toHaveLength(0)
  })
  it('does not advance in-memory state when local storage fails', async () => {
    vi.stubGlobal('uni', {
      getStorageSync: () => '',
      setStorageSync: () => {
        throw new Error('quota')
      },
    })
    const module = await import('../src/composables/useLocalMedia')
    expect(() =>
      module.saveLocalMedia(
        {
          kind: 'video',
          title: 'Original film',
          category: 'acting',
          fileName: 'film.mp4',
          size: 100,
          duration: 12,
        },
        'temp',
      ),
    ).toThrow('quota')
    expect(module.videoSubmissionRecords.value).toHaveLength(0)
  })
  it('preserves unreadable existing records instead of overwriting them', async () => {
    const write = vi.fn()
    vi.stubGlobal('uni', { getStorageSync: () => '{corrupt', setStorageSync: write })
    const module = await import('../src/composables/useLocalMedia')
    expect(module.localMediaError.value).toBe(true)
    expect(() => module.removeLocalMedia('unknown')).toThrow('unavailable')
    expect(write).not.toHaveBeenCalled()
  })
})
