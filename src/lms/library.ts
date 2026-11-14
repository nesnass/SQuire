import { lmsCommand, lmsQuery } from './client'
import type {
  Album,
  AlbumsResponse,
  Artist,
  ArtistsResponse,
  Favorite,
  FavoritesResponse,
  Genre,
  GenresResponse,
  LetterIndex,
  LibraryTrack,
  Playlist,
  PlaylistsResponse,
  PlaylistTracksResponse,
  TitlesResponse,
  YearsResponse,
} from './types'

export interface Page<T> {
  items: T[]
  count: number
  index?: LetterIndex
}

// LMS's own sort names; 'artistalbum' is artist, then album title
export type AlbumSort = 'new' | 'album' | 'artistalbum'

const ALBUM_TAGS = 'tags:ljaSy'
const TRACK_TAGS = 'tags:tdaliJeu'

function filters(params: Record<string, string | number | undefined>): string[] {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}:${v}`)
}

// Contributor roles that can mean "this is their album": an album with no album-artist tag credits its performer
// as ARTIST. Track artists on compilations are ARTIST too, so pair this with `compilation: 0` for albums.
export const ALBUM_ARTIST_ROLES = 'ALBUMARTIST,ARTIST'

let albumArtistRole: Promise<string> | null = null

// Which role lists album artists. A tagged library has ALBUMARTIST, and ARTIST would add everyone on a
// compilation; a library without album-artist tags only has ARTIST to go on.
export function fetchAlbumArtistRole(): Promise<string> {
  albumArtistRole ??= lmsQuery<ArtistsResponse>('', ['artists', 0, 1, 'role_id:ALBUMARTIST'])
    .then((r) => (r.count > 0 ? 'ALBUMARTIST' : ALBUM_ARTIST_ROLES))
    .catch((e: unknown) => {
      albumArtistRole = null
      throw e
    })
  return albumArtistRole
}

export async function fetchArtists(
  start: number,
  n: number,
  opts: { search?: string; withIndex?: boolean; genreId?: number; roleId?: string } = {},
): Promise<Page<Artist>> {
  const res = await lmsQuery<ArtistsResponse>('', [
    'artists',
    start,
    n,
    ...(opts.withIndex ? ['tags:Z'] : []),
    ...filters({ search: opts.search, genre_id: opts.genreId, role_id: opts.roleId }),
  ])
  return { items: res.artists_loop ?? [], count: res.count, index: res.indexList }
}

export async function fetchAlbums(
  start: number,
  n: number,
  opts: {
    sort?: AlbumSort | 'yearalbum' | 'recentlyplayed'
    artistId?: number
    albumId?: number
    search?: string
    withIndex?: boolean
    genreId?: number
    year?: number
    roleId?: string
    compilation?: 0 | 1
  } = {},
): Promise<Page<Album>> {
  const res = await lmsQuery<AlbumsResponse>('', [
    'albums',
    start,
    n,
    opts.withIndex ? `${ALBUM_TAGS}Z` : ALBUM_TAGS,
    ...filters({
      sort: opts.sort,
      artist_id: opts.artistId,
      album_id: opts.albumId,
      search: opts.search,
      genre_id: opts.genreId,
      year: opts.year,
      role_id: opts.roleId,
      compilation: opts.compilation,
    }),
  ])
  return { items: res.albums_loop ?? [], count: res.count, index: res.indexList }
}

// LMS filters albums by one year only, so a decade is its years fetched whole and merged
const DECADE_YEAR_MAX = 2000

export async function fetchDecadeAlbums(
  decade: number,
  opts: { sort: AlbumSort; genreId?: number },
): Promise<Page<Album>> {
  const years = (await fetchYears()).filter((y) => y >= decade && y < decade + 10)
  const pages = await Promise.all(
    years.map((year) => fetchAlbums(0, DECADE_YEAR_MAX, { sort: opts.sort, genreId: opts.genreId, year })),
  )
  const items = sortAlbums(pages.flatMap((p) => p.items), opts.sort)
  return { items, count: items.length }
}

// "Recently added" has no timestamp to merge on, so the newest years come first instead
export function sortAlbums(albums: Album[], sort: AlbumSort): Album[] {
  const by = (a: string | undefined, b: string | undefined) => (a ?? '').localeCompare(b ?? '', undefined, { sensitivity: 'base' })
  return [...albums].sort((a, b) => {
    if (sort === 'album') return by(a.album, b.album)
    if (sort === 'artistalbum') return by(a.artist, b.artist) || by(a.album, b.album)
    return (b.year ?? 0) - (a.year ?? 0)
  })
}

export async function fetchTracks(
  start: number,
  n: number,
  opts: { albumId?: number; artistId?: number; search?: string; sort?: 'albumtrack' },
): Promise<Page<LibraryTrack>> {
  const res = await lmsQuery<TitlesResponse>('', [
    'titles',
    start,
    n,
    TRACK_TAGS,
    ...filters({
      album_id: opts.albumId,
      artist_id: opts.artistId,
      search: opts.search,
      sort: opts.albumId ? 'tracknum' : opts.sort,
    }),
  ])
  return { items: res.titles_loop ?? [], count: res.count }
}

// Small enough (a few hundred at most) to fetch whole and filter in the client
export async function fetchGenres(): Promise<Genre[]> {
  const res = await lmsQuery<GenresResponse>('', ['genres', 0, 1000])
  return res.genres_loop ?? []
}

export async function fetchYears(): Promise<number[]> {
  const res = await lmsQuery<YearsResponse>('', ['years', 0, 1000])
  return (res.years_loop ?? []).map((y) => y.year).filter((y) => y > 0)
}

// Every artist with the given roles, in one request; used where the server can't filter for us
export async function fetchAllArtists(roleId: string): Promise<Artist[]> {
  const res = await lmsQuery<ArtistsResponse>('', ['artists', 0, 20000, `role_id:${roleId}`])
  return res.artists_loop ?? []
}

export async function canRandomPlay(): Promise<boolean> {
  const res = await lmsQuery<{ _can?: number }>('', ['can', 'randomplay', '?'])
  return res._can === 1
}

export async function fetchPlaylists(start: number, n: number): Promise<Page<Playlist>> {
  const res = await lmsQuery<PlaylistsResponse>('', ['playlists', start, n, 'tags:u'])
  return { items: res.playlists_loop ?? [], count: res.count }
}

export async function fetchPlaylistTracks(start: number, n: number, playlistId: number): Promise<Page<LibraryTrack>> {
  const res = await lmsQuery<PlaylistTracksResponse>('', [
    'playlists',
    'tracks',
    start,
    n,
    `playlist_id:${playlistId}`,
    TRACK_TAGS,
  ])
  return { items: res.playlisttracks_loop ?? [], count: res.count }
}

// folderId lists a favourites folder; omitted lists the top level
export async function fetchFavorites(start: number, n: number, folderId?: string): Promise<Page<Favorite>> {
  const res = await lmsQuery<FavoritesResponse>('', [
    'favorites',
    'items',
    start,
    n,
    'want_url:1',
    ...filters({ item_id: folderId }),
  ])
  return { items: res.loop_loop ?? [], count: res.count }
}

export async function createPlaylist(name: string): Promise<number> {
  const res = await lmsQuery<{ playlist_id?: number; overwritten_playlist_id?: number }>('', [
    'playlists',
    'new',
    `name:${name}`,
  ])
  const id = res.playlist_id ?? res.overwritten_playlist_id
  if (id === undefined) throw new Error(`LMS didn't create playlist ${name}`)
  return id
}

async function playlistCount(playlistId: number): Promise<number> {
  return (await fetchPlaylistTracks(0, 0, playlistId)).count
}

// One command per song, in order, so the playlist keeps the order they were given in.
// LMS skips songs already in the playlist, so the count is compared to report what was added
export async function addToPlaylist(playlistId: number, urls: string[]): Promise<number> {
  const before = await playlistCount(playlistId)
  for (const url of urls) {
    await lmsCommand('', ['playlists', 'edit', `playlist_id:${playlistId}`, 'cmd:add', `url:${url}`])
  }
  return (await playlistCount(playlistId)) - before
}

export function removeFromPlaylist(playlistId: number, index: number): Promise<void> {
  return lmsCommand('', ['playlists', 'edit', `playlist_id:${playlistId}`, 'cmd:delete', `index:${index}`])
}

export function movePlaylistTrack(playlistId: number, from: number, to: number): Promise<void> {
  return lmsCommand('', ['playlists', 'edit', `playlist_id:${playlistId}`, 'cmd:move', `index:${from}`, `toindex:${to}`])
}

export function deletePlaylist(playlistId: number): Promise<void> {
  return lmsCommand('', ['playlists', 'delete', `playlist_id:${playlistId}`])
}

// LMS renames over an existing playlist of that name, so a dry run checks first. Returns false if the name is taken
export async function renamePlaylist(playlistId: number, name: string): Promise<boolean> {
  const check = await lmsQuery<{ overwritten_playlist_id?: number }>('', [
    'playlists',
    'rename',
    `playlist_id:${playlistId}`,
    `newname:${name}`,
    'dry_run:1',
  ])
  if (check.overwritten_playlist_id !== undefined && check.overwritten_playlist_id !== playlistId) return false
  await lmsCommand('', ['playlists', 'rename', `playlist_id:${playlistId}`, `newname:${name}`])
  return true
}

export async function saveQueueAsPlaylist(playerId: string, name: string): Promise<number | undefined> {
  const res = await lmsQuery<{ __playlist_id?: number }>(playerId, ['playlist', 'save', name, 'silent:1'])
  return res.__playlist_id
}
