import type { BilingualText, Venue } from './contentCatalog'
import type { HallPerson, MediaItem } from './showcaseCatalog'
import { regionalOptions, regionTranslations } from './regionCatalog'
import type { RegionId } from './types'

export interface PublishedCatalog {
  id: string
  language: 'zh' | 'en'
  region: RegionId
  sortOrder?: number
  sample?: boolean
}
export interface HomeBanner extends PublishedCatalog {
  category: 'policy' | 'contribution' | 'celebration' | 'collection' | 'study' | 'integrity'
  title: string
  subtitle: string
  description: string
  actionLabel: string
  footnote: string
  cover?: string
  targetScreen:
    | 'news'
    | 'submit'
    | 'library'
    | 'learning'
    | 'classroom'
    | 'media'
    | 'hall'
    | 'venues'
    | 'review'
  targetId?: string
}
export const homeSectionIds = ['entries', 'topics', 'news', 'works', 'venues', 'stats'] as const
export type HomeSectionId = (typeof homeSectionIds)[number]
export interface HomeSection {
  id: HomeSectionId
  enabled: boolean
  order: number
}
export interface MediaSubmission extends MediaItem {
  language: 'zh' | 'en'
  region: RegionId
  sourceFileId: string
  posterFileId?: string
  status: string
  lockVersion: number
  reviewNote?: string
  createdAt?: string
}
export interface SupportTicket {
  id: string
  subject: string
  body: string
  category: string
  status: string
  reply?: string
  createdAt?: string
  updatedAt?: string
}
/** Language editions are independent publications, never translated or filled from a demo. */
export function editionText(value: unknown, language: string): BilingualText {
  if (value && typeof value === 'object' && 'zh' in value) return value as BilingualText
  return {
    zh: language === 'en' ? '' : String(value ?? ''),
    en: language === 'en' ? String(value ?? '') : '',
  }
}
const lines = (value: unknown, language: string) =>
  (Array.isArray(value)
    ? value
    : String(value ?? '')
        .split('\n')
        .filter(Boolean)
  ).map((x) => editionText(x, language))
export function normalizeMedia(v: Record<string, any>): MediaSubmission {
  const language = v.language === 'en' ? 'en' : 'zh'
  return {
    ...v,
    id: String(v.id),
    language,
    region: v.regionId || v.region || 'all',
    title: editionText(v.title, language),
    collection: editionText(v.collection, language),
    excerpt: editionText(v.excerpt, language),
    transcript: lines(v.transcript, language),
    duration: String(v.duration || ''),
    poster: String(v.poster || ''),
    source: String(v.source || ''),
    lockVersion: Number(v.lockVersion ?? v.version ?? 0),
  } as MediaSubmission
}
export function normalizeVenue(v: Record<string, any>, index: number): Venue {
  const lang = v.language === 'en' ? 'en' : 'zh'
  return {
    ...v,
    id: String(v.id),
    language: lang,
    region: v.regionId || v.region || 'all',
    mark: String(index + 1),
    title: editionText(v.title, lang),
    city: editionText(v.city, lang),
    address: editionText(v.address, lang),
    hours: editionText(v.hours, lang),
    description: editionText(v.description, lang),
    visitorNotice: editionText(v.visitorNotice, lang),
    highlights: lines(v.highlights, lang),
    stops: lines(v.stops, lang),
    x: 20 + (index % 3) * 28,
    y: 25 + (Math.floor(index / 3) % 3) * 25,
  } as Venue
}
export function normalizeHall(v: Record<string, any>): HallPerson {
  const lang = v.language === 'en' ? 'en' : 'zh'
  return {
    ...v,
    id: String(v.id),
    language: lang,
    region: v.regionId || v.region || 'all',
    name: editionText(v.title || v.name, lang),
    era: editionText(v.era, lang),
    regionName: v.regionName
      ? editionText(v.regionName, lang)
      : {
          zh:
            regionalOptions.find((r) => r.id === (v.regionId || v.region))?.label || v.region || '',
          en:
            regionTranslations[
              regionalOptions.find((r) => r.id === (v.regionId || v.region))?.label || ''
            ] ||
            v.regionId ||
            v.region ||
            '',
        },
    theme: editionText(v.theme, lang),
    book: editionText(v.book, lang),
    quote: editionText(v.quote, lang),
    introduction: editionText(v.introduction, lang),
    notes: lines(v.notes, lang),
    sourceTitle: String(v.sourceTitle || ''),
    sourceUrl: String(v.sourceUrl || ''),
  } as HallPerson
}
export function visibleEdition<
  T extends { language?: string; region?: string; sortOrder?: number },
>(items: T[], language: string, region = 'all') {
  return items
    .filter(
      (x) =>
        (x.language || 'zh') === language &&
        (region === 'all' || x.region === 'all' || x.region === region),
    )
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
}
export function orderedHomeSections(value?: { sections?: HomeSection[] }): HomeSection[] {
  if (!value?.sections) return homeSectionIds.map((id, order) => ({ id, order, enabled: true }))
  return value.sections
    .filter((x) => homeSectionIds.includes(x.id) && x.enabled)
    .sort((a, b) => a.order - b.order)
}
export function canNavigateVenue(venue: Pick<Venue, 'sample' | 'latitude' | 'longitude'>) {
  return (
    venue.sample === false &&
    typeof venue.latitude === 'number' &&
    typeof venue.longitude === 'number' &&
    Number.isFinite(venue.latitude) &&
    Number.isFinite(venue.longitude) &&
    Math.abs(venue.latitude) <= 90 &&
    Math.abs(venue.longitude) <= 180
  )
}
export function validateMediaFile(name: string, size: number) {
  if (!/\.(mp4|mp3|wav)$/i.test(name)) return '请选择 MP4、MP3 或 WAV 文件。'
  if (!Number.isFinite(size) || size <= 0 || size > 50 * 1024 * 1024)
    return '媒体文件须大于 0 且不超过 50 MiB。'
  return ''
}
