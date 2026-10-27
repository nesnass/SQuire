import type { Favorite, LibraryTrack, Track } from './types'

export function coverUrl(coverId: string | undefined, size: number): string | undefined {
  return coverId ? `/music/${coverId}/cover_${size}x${size}_f` : undefined
}

// Resolves the image paths LMS hands out (remote URLs, local covers, plugin icons) to a sized URL
export function imageUrl(path: string | undefined, size: number): string | undefined {
  if (!path) return undefined
  // Remote art is resized by LMS's image proxy so the browser doesn't fetch full-size originals
  if (/^https?:\/\//.test(path)) return `/imageproxy/${encodeURIComponent(path)}/image_${size}x${size}_f`
  const cover = path.match(/^\/?music\/([^/]+)\/cover/)
  if (cover) return coverUrl(cover[1], size)
  return path.startsWith('/') ? path : `/${path}`
}

export function artworkUrl(track: Track | undefined, size: number): string | undefined {
  if (!track) return undefined
  return imageUrl(track.artwork_url, size) ?? coverUrl(track.coverid, size)
}

export function formatTime(seconds: number | undefined): string {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

export function totalLength(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const rest = minutes % 60
  return rest ? `${Math.floor(minutes / 60)} h ${rest} min` : `${minutes / 60} h`
}

const FORMAT_NAMES: Record<string, string> = {
  flc: 'FLAC',
  alc: 'ALAC',
  aif: 'AIFF',
  dsf: 'DSD',
  dff: 'DSD',
}

function formatRate(rate: number): string {
  return `${Number((rate / 1000).toFixed(1))} kHz`
}

export function qualityLabel(track: Track | undefined): string {
  if (!track) return ''
  const parts: string[] = []
  if (track.type) parts.push(FORMAT_NAMES[track.type] ?? track.type.toUpperCase())
  const rate = Number(track.samplerate)
  const size = Number(track.samplesize)
  if (rate > 0) parts.push(size > 0 ? `${size}-bit / ${formatRate(rate)}` : formatRate(rate))
  // Streams report an unknown bitrate as "0"
  if (track.bitrate && track.bitrate !== '0') parts.push(track.bitrate)
  return parts.join(' · ')
}

export function initials(name: string): string {
  const words = name.match(/[\p{L}\p{N}]+/gu) ?? []
  return words
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

export interface Disc {
  disc: number
  tracks: LibraryTrack[]
}

export function groupByDisc(tracks: LibraryTrack[]): Disc[] {
  const discs: Disc[] = []
  for (const track of tracks) {
    const disc = Number(track.disc) || 1
    const last = discs[discs.length - 1]
    if (last?.disc === disc) last.tracks.push(track)
    else discs.push({ disc, tracks: [track] })
  }
  return discs
}

export type FavoriteKind = 'folder' | 'album' | 'artist' | 'playlist' | 'radio' | 'track' | 'other'

// LMS doesn't type favourites, so the kind is read from the URL scheme
export function favoriteKind(fav: Favorite): FavoriteKind {
  if (fav.hasitems) return 'folder'
  const url = fav.url ?? ''
  if (url.startsWith('db:album.')) return 'album'
  if (url.startsWith('db:contributor.')) return 'artist'
  if (/^file:.*\.(m3u8?|pls|cue)$/i.test(url)) return 'playlist'
  if (url.startsWith('file:')) return 'track'
  if (/^(https?|mms|rtsp):/.test(url)) return 'radio'
  return 'other'
}

// A saved station is a TuneIn/plugin link, but the queue holds the stream it resolved to, so the URL alone rarely matches
export function matchStation(track: Track, stations: Favorite[]): number {
  return stations.findIndex(
    (s) =>
      (s.url && s.url === track.url) ||
      (s.name && s.name === track.remote_title) ||
      (s.image && s.image === track.artwork_url),
  )
}

// LMS skips songs a playlist already has, so `added` can be less than `requested`
export function addedMessage(added: number, requested: number, playlist: string): string {
  if (added <= 0) return requested === 1 ? `Already in ${playlist}` : `All already in ${playlist}`
  const songs = added === 1 ? (requested === 1 ? '' : '1 song ') : `${added} songs `
  const skipped = requested - added
  return `Added ${songs}to ${playlist}${skipped > 0 ? ` · ${skipped} already there` : ''}`
}
