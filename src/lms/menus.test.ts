import { describe, expect, it } from 'vitest'
import { splitItemId, splitJiveText } from './menus'
import { parsePodcastInput } from './podcastDirectory'

describe('parsePodcastInput', () => {
  it('reads the show id from Apple Podcasts links', () => {
    expect(
      parsePodcastInput('https://podcasts.apple.com/no/podcast/the-money-caf%C3%A9-with-alan-kohler/id1572748112'),
    ).toEqual({ kind: 'apple', id: '1572748112' })
    expect(parsePodcastInput('https://podcasts.apple.com/us/podcast/x/id42?i=1000')).toEqual({ kind: 'apple', id: '42' })
  })
  it('treats other links as feeds and text as a search', () => {
    expect(parsePodcastInput(' https://example.com/feed.rss ')).toEqual({ kind: 'feed', url: 'https://example.com/feed.rss' })
    expect(parsePodcastInput('money cafe')).toEqual({ kind: 'term', term: 'money cafe' })
    expect(parsePodcastInput('   ')).toBeNull()
  })
})

describe('splitJiveText', () => {
  it('separates the title from the detail line', () => {
    expect(splitJiveText('Bids, Boards and Bubbles\nWednesday, October 21, 2026 (44:43)')).toEqual({
      title: 'Bids, Boards and Bubbles',
      detail: 'Wednesday, October 21, 2026 (44:43)',
    })
    expect(splitJiveText('Just a title')).toEqual({ title: 'Just a title', detail: undefined })
  })
})

describe('splitItemId', () => {
  it('separates the parent folder from the position', () => {
    expect(splitItemId('66c82454.0.3')).toEqual({ parent: '66c82454.0', index: 3 })
    expect(splitItemId('7')).toEqual({ index: 7 })
  })
})
