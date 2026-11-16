import { lmsQuery } from './client'

// Lyrics, biographies, album reviews and artist photos come from the Music & Artist Information plugin,
// which looks them up online; servers without it get none of these
let available: Promise<boolean> | null = null
export function hasArtistInfo(): Promise<boolean> {
  available ??= lmsQuery<{ _can?: number }>('', ['can', 'musicartistinfo', 'lyrics', '?'])
    .then((res) => res._can === 1)
    .catch(() => {
      available = null
      return false
    })
  return available
}

interface InfoResponse {
  lyrics?: string
  biography?: string
  albumreview?: string
  item_loop?: { url: string }[]
  error?: string
}

async function query(params: (string | number)[]): Promise<InfoResponse | null> {
  if (!(await hasArtistInfo())) return null
  const res = await lmsQuery<InfoResponse>('', ['musicartistinfo', ...params])
  return res.error ? null : res
}

const lyricsCache = new Map<number, string | null>()

// Library tracks only: a stream's title is rarely the song's
export async function fetchLyrics(trackId: number): Promise<string | null> {
  const cached = lyricsCache.get(trackId)
  if (cached !== undefined) return cached
  const res = await query(['lyrics', `track_id:${trackId}`])
  const lyrics = res?.lyrics?.replace(/\r\n?/g, '\n').trim() || null
  lyricsCache.set(trackId, lyrics)
  return lyrics
}

export async function fetchBiography(artistId: number): Promise<string | null> {
  return (await query(['biography', `artist_id:${artistId}`]))?.biography?.trim() || null
}

export async function fetchArtistPhotos(artistId: number): Promise<string[]> {
  return ((await query(['artistphotos', `artist_id:${artistId}`]))?.item_loop ?? []).map((p) => p.url)
}

export async function fetchAlbumReview(albumId: number): Promise<string | null> {
  return (await query(['albumreview', `album_id:${albumId}`]))?.albumreview?.trim() || null
}

export interface Paragraph {
  text: string
  heading: boolean
}

// The plugin's text is plain text wrapped at a fixed width, with blank lines between paragraphs and
// headings underlined with dashes or equals signs; this joins each paragraph back into one line
export function paragraphs(text: string): Paragraph[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((block) => {
      const lines = block.split('\n').map((l) => l.trim())
      const heading = lines.some((l) => /^[-=]{3,}$/.test(l))
      return { text: lines.filter((l) => l && !/^[-=]{3,}$/.test(l)).join(' '), heading }
    })
    .filter((p) => p.text)
}
