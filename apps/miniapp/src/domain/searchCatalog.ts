import {
  newsArticles,
  courses,
  venues,
  activityTranslations,
  type BilingualText,
} from './contentCatalog'
import { mediaCatalog, hallPeople, culturalProducts } from './showcaseCatalog'
import { readingDocument } from './libraryCatalog'
import type { Work, Classic, Activity, RegionId } from './types'
export type SearchKind =
  | 'work'
  | 'news'
  | 'classic'
  | 'activity'
  | 'course'
  | 'video'
  | 'hall'
  | 'product'
  | 'venue'
export interface SearchEntry {
  id: string
  kind: SearchKind
  screen: string
  contentId: string
  title: BilingualText
  summary: BilingualText
  text: string
  region: RegionId
}
const bi = (zh: string, en = zh) => ({ zh, en })
export const searchKinds: { id: SearchKind; label: BilingualText }[] = [
  { id: 'work', label: bi('作品', 'Stories') },
  { id: 'news', label: bi('资讯', 'News') },
  { id: 'classic', label: bi('典籍', 'Books') },
  { id: 'activity', label: bi('活动', 'Events') },
  { id: 'course', label: bi('课堂', 'Courses') },
  { id: 'video', label: bi('媒体', 'Media') },
  { id: 'hall', label: bi('名人馆', 'Heritage halls') },
  { id: 'product', label: bi('文创', 'Gifts') },
  { id: 'venue', label: bi('阵地', 'Venues') },
]
export function createSearchIndex(
  works: Work[],
  classics: Classic[],
  activities: Activity[],
): SearchEntry[] {
  const entries: SearchEntry[] = []
  const add = (
    kind: SearchKind,
    screen: string,
    id: string,
    title: BilingualText,
    summary: BilingualText,
    text = '',
    region: RegionId = 'all',
  ) =>
    entries.push({
      id: kind + ':' + id,
      kind,
      screen,
      contentId: id,
      title,
      summary,
      text: [title.zh, title.en, summary.zh, summary.en, text].join(' ').toLowerCase(),
      region,
    })
  works.forEach((w) => {
    const en = readingDocument(w, 'en')
    add(
      'work',
      'library',
      w.id,
      bi(w.title, en.title),
      bi(w.excerpt, en.excerpt),
      w.content + ' ' + w.author,
      w.region,
    )
  })
  classics.forEach((w) => {
    const en = readingDocument(w, 'en')
    add(
      'classic',
      'library',
      w.id,
      bi(w.title, en.title),
      bi(w.excerpt, en.excerpt),
      w.content + ' ' + en.chapters.flatMap((c) => c.paragraphs).join(' '),
      w.region,
    )
  })
  activities.forEach((a) =>
    add(
      'activity',
      'learning',
      a.id,
      bi(a.title, activityTranslations[a.id]?.title),
      bi(a.excerpt, activityTranslations[a.id]?.excerpt),
      a.content,
      a.region,
    ),
  )
  newsArticles.forEach((a) =>
    add(
      'news',
      'news',
      a.id,
      a.title,
      a.excerpt,
      a.paragraphs.map((p) => p.zh + ' ' + p.en).join(' '),
      a.region || 'all',
    ),
  )
  courses.forEach((c) =>
    add(
      'course',
      'classroom',
      c.id,
      c.title,
      c.description,
      c.lessons.map((l) => l.body.zh + ' ' + l.body.en).join(' '),
    ),
  )
  mediaCatalog.forEach((m) =>
    add(
      'video',
      'media',
      m.id,
      m.title,
      m.excerpt,
      m.transcript.map((p) => p.zh + ' ' + p.en).join(' '),
      m.region || 'all',
    ),
  )
  hallPeople.forEach((h) =>
    add('hall', 'hall', h.id, h.name, h.introduction, h.quote.zh + ' ' + h.quote.en, h.region),
  )
  culturalProducts.forEach((p) => add('product', 'shop', p.id, p.name, p.description))
  venues.forEach((v) =>
    add(
      'venue',
      'venues',
      v.id,
      v.title,
      v.description,
      v.address.zh + ' ' + v.address.en,
      v.region as RegionId,
    ),
  )
  return entries
}
export function findEntries(
  entries: SearchEntry[],
  query: string,
  kind: SearchKind | 'all' = 'all',
  region: RegionId = 'all',
) {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return entries.filter(
    (e) =>
      (kind === 'all' || e.kind === kind) &&
      (region === 'all' || e.region === 'all' || e.region === region) &&
      tokens.every((q) => e.text.includes(q)),
  )
}
