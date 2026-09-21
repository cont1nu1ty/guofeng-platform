import { describe, it, expect } from 'vitest'
import { createSearchIndex, findEntries } from '../src/domain/searchCatalog'
import { seedWorks, seedClassics, seedActivities } from '../src/domain/fixtures'
import { createNewsPreferences } from '../src/domain/newsPreferences'
import { provinceCatalog, regionalOptions } from '../src/domain/regionCatalog'
describe('platform search', () => {
  const index = createSearchIndex(seedWorks, seedClassics, seedActivities)
  it('returns all nine content types, bilingual matches and regional/shared content', () => {
    expect(new Set(index.map((e) => e.kind)).size).toBe(9)
    expect(findEntries(index, 'integrity').length).toBeGreaterThan(0)
    expect(findEntries(index, '诸葛亮', 'hall')[0]?.contentId).toBe('zhuge-liang')
    expect(
      findEntries(index, '', 'venue', 'zhejiang').every(
        (e) => e.region === 'zhejiang' || e.region === 'all',
      ),
    ).toBe(true)
    expect(findEntries(index, 'no-such-original-sample-xyz')).toEqual([])
  })
  it('includes every matching entry without the old three-item cap', () => {
    expect(findEntries(index, '', 'news').length).toBeGreaterThan(3)
  })
  it('has 34 unique provincial choices plus national and overseas', () => {
    expect(provinceCatalog).toHaveLength(34)
    expect(new Set(regionalOptions.map((r) => r.id)).size).toBe(36)
  })
})
describe('local subscriptions', () => {
  it('restores subscriptions and preferences without duplicate categories', () => {
    let saved: string | null = null
    const store = {
      getItem: () => saved,
      setItem: (_: string, v: string) => {
        saved = v
      },
    }
    const repo = createNewsPreferences(store, ['policy', 'activity'])
    repo.save({
      categories: ['policy', 'policy'],
      updates: false,
      digest: 'weekly',
      quietHours: true,
    })
    expect(createNewsPreferences(store, ['policy', 'activity']).read()).toEqual({
      categories: ['policy'],
      updates: false,
      digest: 'weekly',
      quietHours: true,
    })
  })
  it('keeps prior in-memory preferences if saving fails', () => {
    const repo = createNewsPreferences(
      {
        getItem: () => null,
        setItem: () => {
          throw Error('quota')
        },
      },
      ['policy'],
    )
    expect(() => repo.save({ ...repo.read(), categories: ['policy'] })).toThrow()
    expect(repo.read().categories).toEqual([])
  })
  it('does not overwrite malformed stored preferences', () => {
    let writes = 0
    expect(() =>
      createNewsPreferences(
        {
          getItem: () => '{bad',
          setItem: () => {
            writes++
          },
        },
        ['policy'],
      ),
    ).toThrow()
    expect(writes).toBe(0)
  })
})
