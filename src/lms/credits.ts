import type { Artist } from './types'

export type CreditRole = 'composers' | 'guests'

// "Guests" covers anyone on someone else's album: featured artists and compilation tracks alike
export const CREDIT_ROLE_IDS: Record<CreditRole, string> = { composers: 'COMPOSER', guests: 'ARTIST,TRACKARTIST' }

// People credited only in a role, never as an album's artist. LMS can't exclude a role in one query,
// so the album artists are fetched too and removed here. `<?>` is LMS's placeholder for a blank tag.
export function creditedOnly(credited: Artist[], albumArtists: Artist[]): Artist[] {
  const main = new Set(albumArtists.map((a) => a.id))
  return credited.filter((a) => !main.has(a.id) && a.artist !== '<?>')
}

// Albums an artist appears on without being the album's artist, in the order LMS listed them
export function appearsOn<T extends { id: number }>(all: T[], own: T[]): T[] {
  const ids = new Set(own.map((a) => a.id))
  return all.filter((a) => !ids.has(a.id))
}
