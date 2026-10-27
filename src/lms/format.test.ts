import { describe, expect, it } from 'vitest'
import { addedMessage, artworkUrl, favoriteKind, matchStation, formatTime, groupByDisc, imageUrl, initials, qualityLabel, totalLength } from './format'
import type { Track } from './types'

const base: Track = { id: 1, title: 't', 'playlist index': 0 }

describe('artworkUrl', () => {
  it('uses local cover id', () => {
    expect(artworkUrl({ ...base, coverid: 'aae68886' }, 300)).toBe('/music/aae68886/cover_300x300_f')
  })
  it('proxies remote artwork', () => {
    expect(artworkUrl({ ...base, artwork_url: 'https://x.com/a.jpg' }, 100)).toBe(
      '/imageproxy/https%3A%2F%2Fx.com%2Fa.jpg/image_100x100_f',
    )
  })
  it('roots relative artwork paths', () => {
    expect(artworkUrl({ ...base, artwork_url: 'plugins/x/icon.png' }, 100)).toBe('/plugins/x/icon.png')
  })
  it('returns undefined without artwork', () => {
    expect(artworkUrl(base, 100)).toBeUndefined()
  })
})

describe('formatTime', () => {
  it('formats minutes and hours', () => {
    expect(formatTime(218.6)).toBe('3:38')
    expect(formatTime(3725)).toBe('1:02:05')
    expect(formatTime(undefined)).toBe('0:00')
  })
})

describe('qualityLabel', () => {
  it('describes lossy tracks', () => {
    expect(qualityLabel({ ...base, type: 'mp3', samplerate: '44100', bitrate: '320kbps CBR' })).toBe(
      'MP3 · 44.1 kHz · 320kbps CBR',
    )
  })
  it('describes hi-res lossless tracks', () => {
    expect(qualityLabel({ ...base, type: 'flc', samplerate: 96000, samplesize: 24 })).toBe('FLAC · 24-bit / 96 kHz')
  })
  it('leaves out the unknown bitrate of a stream', () => {
    expect(qualityLabel({ ...base, type: 'AAC Radio', samplerate: '44100', bitrate: '0' })).toBe('AAC RADIO · 44.1 kHz')
  })
  it('is empty without a track', () => {
    expect(qualityLabel(undefined)).toBe('')
  })
})

describe('initials', () => {
  it('takes the first letter of up to two words', () => {
    expect(initials('Fleetwood Mac')).toBe('FM')
    expect(initials('!!!')).toBe('')
    expect(initials('10,000 Maniacs')).toBe('10')
    expect(initials('björk')).toBe('B')
  })
})

describe('groupByDisc', () => {
  it('splits tracks into consecutive discs', () => {
    const t = (id: number, disc?: number) => ({ id, title: String(id), disc })
    const discs = groupByDisc([t(1, 1), t(2, 1), t(3, 2), t(4)])
    expect(discs.map((d) => [d.disc, d.tracks.map((x) => x.id)])).toEqual([
      [1, [1, 2]],
      [2, [3]],
      [1, [4]],
    ])
  })
})

describe('imageUrl', () => {
  it('sizes local covers from favourites', () => {
    expect(imageUrl('music/036bc11a/cover.png', 96)).toBe('/music/036bc11a/cover_96x96_f')
  })
  it('leaves plugin icons as rooted paths', () => {
    expect(imageUrl('html/images/radio.png', 96)).toBe('/html/images/radio.png')
  })
})

describe('favoriteKind', () => {
  const fav = (url: string, hasitems = 0) => favoriteKind({ id: '1', name: 'x', url, hasitems })
  it('reads the kind from the url', () => {
    expect(fav('db:album.title=The%20Complete%20Works&contributor.name=Chopin')).toBe('album')
    expect(fav('db:contributor.name=Fleetwood%20Mac')).toBe('artist')
    expect(fav('file:///Volumes/Media/Playlists/80s%20Best.m3u')).toBe('playlist')
    expect(fav('file:///Volumes/Media/FLAC/1.%20Big%20Love.flac')).toBe('track')
    expect(fav('http://stream.example/radio')).toBe('radio')
    expect(fav('', 1)).toBe('folder')
  })
})

describe('totalLength', () => {
  it('switches to hours past an hour', () => {
    expect(totalLength(45 * 60)).toBe('45 min')
    expect(totalLength(1155 * 60)).toBe('19 h 15 min')
    expect(totalLength(120 * 60)).toBe('2 h')
  })
})

describe('addedMessage', () => {
  it('reports skipped duplicates', () => {
    expect(addedMessage(1, 1, 'Mix')).toBe('Added to Mix')
    expect(addedMessage(0, 1, 'Mix')).toBe('Already in Mix')
    expect(addedMessage(12, 12, 'Mix')).toBe('Added 12 songs to Mix')
    expect(addedMessage(10, 12, 'Mix')).toBe('Added 10 songs to Mix · 2 already there')
    expect(addedMessage(0, 12, 'Mix')).toBe('All already in Mix')
  })
})

describe('matchStation', () => {
  const stations = [
    { id: 'a.1', name: 'Triple R', url: 'http://opml.radiotime.com/Tune.ashx?id=s18517', image: '/imageproxy/rrr.png' },
    { id: 'a.2', name: 'PBS', url: 'http://opml.radiotime.com/Tune.ashx?id=s1', image: '/imageproxy/pbs.png' },
  ]
  const stream: Track = { ...base, remote: 1, url: 'https://realtime.rrr.org.au/p1h' }
  it('matches the station name LMS reports for the stream', () => {
    expect(matchStation({ ...stream, remote_title: 'PBS' }, stations)).toBe(1)
  })
  it('falls back to the station logo', () => {
    expect(matchStation({ ...stream, artwork_url: '/imageproxy/rrr.png' }, stations)).toBe(0)
  })
  it('returns -1 for an unsaved station', () => {
    expect(matchStation({ ...stream, remote_title: 'Other' }, stations)).toBe(-1)
  })
})
