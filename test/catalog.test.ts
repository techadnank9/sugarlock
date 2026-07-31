import { describe, it, expect } from 'vitest'
import { searchCatalog } from '../lib/catalog'

describe('searchCatalog', () => {
  it('matches by tag or name, case-insensitively', () => {
    const results = searchCatalog('headphones', null)
    expect(results.length).toBeGreaterThan(0)
    expect(
      results.every((item) => item.tags.includes('headphones') || item.name.toLowerCase().includes('headphones')),
    ).toBe(true)
  })

  it('filters by budget', () => {
    const results = searchCatalog('', 20)
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((item) => item.price <= 20)).toBe(true)
  })

  it('falls back to closest-priced items when a query has no direct match but a budget is set', () => {
    const results = searchCatalog('nonexistentwidget', 15)
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((item) => item.price <= 15)).toBe(true)
  })

  it('returns nothing when query and budget both match nothing', () => {
    const results = searchCatalog('nonexistentwidget', 0)
    expect(results).toEqual([])
  })
})
