// LMS JSON is loosely typed: numeric fields sometimes arrive as strings, so those are typed as unions

export type LmsCommand = (string | number)[]

export interface Player {
  playerid: string
  name: string
  model: string
  connected: number
  power: number
  isplaying: number
  canpoweroff?: number
  ip?: string
}

export interface PlayersResponse {
  count: number
  players_loop?: Player[]
}

export interface SyncGroupsResponse {
  syncgroups_loop?: { sync_members: string; sync_member_names: string }[]
}

export interface Track {
  id: number
  title: string
  artist?: string
  album?: string
  // Library ids as strings; `artist_id` can list several, comma-separated. Streams have neither.
  artist_id?: string
  album_id?: string
  duration?: number
  coverid?: string
  artwork_url?: string
  url?: string
  type?: string
  bitrate?: string
  samplerate?: string | number
  samplesize?: string | number
  remote?: number
  // For a stream, the station's name; `title` is then the show or song
  remote_title?: string
  'playlist index': number
}

export type PlayMode = 'play' | 'pause' | 'stop'

export interface StatusResponse {
  mode: PlayMode
  // Set while LMS is in play mode but the player hasn't started; commands like pause are ignored then
  waitingToPlay?: number
  player_name?: string
  power?: number
  time?: number
  duration?: number
  can_seek?: number
  // Negative while muted
  'mixer volume'?: number
  'playlist shuffle'?: number
  'playlist repeat'?: number
  playlist_cur_index?: string | number
  playlist_tracks?: number
  playlist_timestamp?: number
  playlist_loop?: Track[]
  // Seconds left on the sleep timer; absent when none is set
  will_sleep_in?: number
  // 1 while a random mix is running
  randomplay?: number
}

export interface Artist {
  id: number
  artist: string
  favorites_url?: string
  textkey?: string
}

export interface Album {
  id: number
  album: string
  artist?: string
  artist_id?: number
  year?: number
  artwork_track_id?: string
  favorites_url?: string
}

export interface LibraryTrack {
  id: number
  title: string
  artist?: string
  album?: string
  album_id?: string | number
  duration?: number
  tracknum?: string | number
  disc?: string | number
  artwork_track_id?: string
  url?: string
}

export interface Genre {
  id: number
  genre: string
}

export interface GenresResponse {
  count: number
  genres_loop?: Genre[]
  indexList?: LetterIndex
}

export interface YearsResponse {
  count: number
  years_loop?: { year: number }[]
}

// Leading character and how many items start with it, in list order (from `tags:Z`)
export type LetterIndex = [string, number][]

export interface ArtistsResponse {
  count: number
  artists_loop?: Artist[]
  indexList?: LetterIndex
}

export interface AlbumsResponse {
  count: number
  albums_loop?: Album[]
  indexList?: LetterIndex
}

export interface TitlesResponse {
  count: number
  titles_loop?: LibraryTrack[]
}

export interface Playlist {
  id: number
  playlist: string
  url?: string
}

export interface PlaylistsResponse {
  count: number
  playlists_loop?: Playlist[]
}

export interface PlaylistTracksResponse {
  count: number
  playlisttracks_loop?: LibraryTrack[]
}

export interface Favorite extends MenuItem {
  name: string
}

export interface FavoritesResponse {
  count: number
  loop_loop?: Favorite[]
}

// An entry in a plugin menu (favourites, podcasts, radio): a folder, a playable item, a search box or plain text
export interface MenuItem {
  id: string
  name?: string
  title?: string
  image?: string
  url?: string
  type?: string
  isaudio?: number
  hasitems?: number
}

export interface MenuItemsResponse {
  count: number
  title?: string
  loop_loop?: MenuItem[]
}

// The same menus in the Jive format LMS sends to touch controllers, which carries a second text line
export interface JiveItemsResponse {
  count: number
  item_loop?: {
    text: string
    icon?: string
    params?: { item_id?: string }
    // What LMS would store if this item were made a favourite
    presetParams?: { favorites_url?: string; favorites_title?: string; icon?: string }
  }[]
}

export interface RadiosResponse {
  count: number
  radioss_loop?: { cmd: string; name: string; icon?: string; type: string; weight?: number }[]
}

export type PlayTarget =
  | { album_id: number }
  | { artist_id: number }
  // A comma-separated list plays several tracks in order
  | { track_id: number | string }
  // Everything in some genres (a comma-separated list) and/or a year
  | { genre_id: number | string; year?: number }
  | { year: number }
  | { playlist_id: number }
  // Plugin menus (favourites, podcasts, radio) play through `<menu> playlist play item_id:…`
  | { menu: string; item_id: string }
