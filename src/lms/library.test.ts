import { describe, expect, it } from 'vitest'
import { sortAlbums } from './library'

const albums = [
  { id: 1, album: 'beta', artist: 'Zed', year: 1971 },
  { id: 2, album: 'Alpha', artist: 'zed', year: 1979 },
  { id: 3, album: 'Gamma', artist: 'Abba', year: 1975 },
]

describe('sortAlbums', () => {
  it('sorts by title ignoring case', () => {
    expect(sortAlbums(albums, 'album').map((a) => a.id)).toEqual([2, 1, 3])
  })
  it('sorts by artist then title', () => {
    expect(sortAlbums(albums, 'artistalbum').map((a) => a.id)).toEqual([3, 2, 1])
  })
  it('puts the newest years first for recently added', () => {
    expect(sortAlbums(albums, 'new').map((a) => a.id)).toEqual([2, 3, 1])
  })
  it('keeps the given order for play history sorts', () => {
    expect(sortAlbums(albums, 'popular').map((a) => a.id)).toEqual([1, 2, 3])
    expect(sortAlbums(albums, 'recentlyplayed').map((a) => a.id)).toEqual([1, 2, 3])
  })
})
