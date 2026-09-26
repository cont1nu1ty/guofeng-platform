import { describe, expect, it } from 'vitest'
import {
  canNavigateVenue,
  editionText,
  normalizeHall,
  normalizeMedia,
  normalizeVenue,
  orderedHomeSections,
  validateMediaFile,
  visibleEdition,
} from '../src/domain/remoteCatalog'

describe('published catalogue boundaries', () => {
  it('keeps language editions separate and narrows regional lists without inventing translations', () => {
    const entries = [
      { id: 'zh-bj', language: 'zh', region: 'beijing', sortOrder: 3 },
      { id: 'zh-all', language: 'zh', region: 'all', sortOrder: 1 },
      { id: 'en-bj', language: 'en', region: 'beijing', sortOrder: 2 },
      { id: 'zh-sc', language: 'zh', region: 'sichuan', sortOrder: 0 },
    ]
    expect(visibleEdition(entries, 'zh', 'beijing').map((x) => x.id)).toEqual(['zh-all', 'zh-bj'])
    expect(visibleEdition(entries, 'en', 'sichuan')).toEqual([])
    expect(editionText('English publication', 'en')).toEqual({ zh: '', en: 'English publication' })
  })
  it('honours disabled sections, including an intentionally empty homepage, and configured ordering', () => {
    expect(orderedHomeSections().map((x) => x.id)).toEqual([
      'entries',
      'topics',
      'news',
      'works',
      'venues',
      'stats',
    ])
    expect(orderedHomeSections({ sections: [] })).toEqual([])
    expect(
      orderedHomeSections({
        sections: [
          { id: 'news', order: 2, enabled: true },
          { id: 'entries', order: 0, enabled: false },
          { id: 'stats', order: 1, enabled: true },
        ],
      }).map((x) => x.id),
    ).toEqual(['stats', 'news'])
  })
  it('normalizes flat published catalogues without sample media or historical profiles', () => {
    const media = normalizeMedia({
      id: 'm',
      language: 'en',
      title: 'A reading',
      source: '/api/v1/files/f/public',
      transcript: 'One\nTwo',
      status: '已退回',
      reviewNote: 'Replace the file',
      lockVersion: 4,
    })
    expect(media.title).toEqual({ zh: '', en: 'A reading' })
    expect(media.source).toBe('/api/v1/files/f/public')
    expect(media.transcript).toHaveLength(2)
    expect(media.lockVersion).toBe(4)
    expect(normalizeMedia({ id: 'private', region: '浙江', regionId: 'zhejiang' }).region).toBe(
      'zhejiang',
    )
    expect(normalizeHall({ id: 'h', title: '人物', region: 'guangdong' }).sourceUrl).toBe('')
    expect(normalizeVenue({ id: 'v', title: '场馆', stops: '入口\n阅览室' }, 1).stops).toHaveLength(
      2,
    )
  })
  it('opens real navigation only for explicitly non-sample venues with a valid coordinate pair', () => {
    expect(canNavigateVenue({ sample: false, latitude: 0, longitude: 0 })).toBe(true)
    for (const value of [
      { sample: true, latitude: 31, longitude: 120 },
      { latitude: 31, longitude: 120 },
      { sample: false, latitude: 31 },
      { sample: false, latitude: 91, longitude: 120 },
      { sample: false, latitude: NaN, longitude: 1 },
    ])
      expect(canNavigateVenue(value)).toBe(false)
  })
  it('rejects unsupported or oversized media before upload and accepts the exact 50 MiB limit', () => {
    expect(validateMediaFile('家风朗诵.WAV', 50 * 1024 * 1024)).toBe('')
    expect(validateMediaFile('演绎.mp4', 10)).toBe('')
    expect(validateMediaFile('声音.mp3', 10)).toBe('')
    expect(validateMediaFile('伪视频.mp4.exe', 10)).not.toBe('')
    expect(validateMediaFile('演绎.mp4', 50 * 1024 * 1024 + 1)).not.toBe('')
    expect(validateMediaFile('演绎.mp4', 0)).not.toBe('')
  })
})
