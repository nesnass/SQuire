import { describe, expect, it } from 'vitest'
import { groupBySection, letterSections } from './sections'

describe('letterSections', () => {
  it('folds digits and symbols into # and keeps offsets', () => {
    expect(letterSections([['!', 1], ['1', 2], ['A', 3], ['B', 1]])).toEqual([
      { letter: '#', start: 0, count: 3 },
      { letter: 'A', start: 3, count: 3 },
      { letter: 'B', start: 6, count: 1 },
    ])
  })
  it('keeps accented letters as their own section', () => {
    expect(letterSections([['Z', 1], ['Ö', 2]]).map((s) => s.letter)).toEqual(['Z', 'Ö'])
  })
  it('is empty without an index', () => {
    expect(letterSections(undefined)).toEqual([])
  })
})

describe('groupBySection', () => {
  const sections = letterSections([['1', 2], ['A', 2], ['B', 2]])
  it('groups only what has loaded', () => {
    expect(groupBySection(['1a', '1b', 'Aa'], sections).map((g) => [g.section?.letter, g.items])).toEqual([
      ['#', ['1a', '1b']],
      ['A', ['Aa']],
    ])
  })
  it('returns one unlabelled group without sections', () => {
    expect(groupBySection(['x'], [])).toEqual([{ section: null, items: ['x'] }])
  })
})
