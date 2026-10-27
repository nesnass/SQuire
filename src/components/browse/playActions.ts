import { inject } from 'vue'
import { coverUrl, favoriteKind } from '@/lms/format'
import { fetchTracks } from '@/lms/library'
import type { Album, LibraryTrack, Playlist, PlayTarget } from '@/lms/types'
import useFavoritesStore, { type FavoriteInput } from '@/store/useFavoritesStore'
import usePlayerStore from '@/store/usePlayerStore'
import {
  actionSheet,
  playlistPicker,
  showToast,
  type ActionSheetContent,
  type PlaylistPickerContent,
  type SheetAction,
} from '../overlays'
import { NAV } from './nav'

type Mode = 'load' | 'insert' | 'add'

const DONE: Record<Mode, string> = {
  load: 'Playing on',
  insert: 'Playing next on',
  add: 'Added to queue on',
}

export function usePlayActions() {
  const { getters, actions } = usePlayerStore()
  const favorites = useFavoritesStore()
  const nav = inject(NAV, null)

  async function play(mode: Mode, target: PlayTarget, opts?: { playIndex?: number; shuffle?: boolean }) {
    const ok = await actions.playItems(mode, target, opts).catch(() => {
      showToast("Couldn't reach the server")
      return null
    })
    if (ok === false) showToast('Pick a room in Rooms first')
    else if (ok) showToast(`${DONE[mode]} ${getters.activeLabel.value}`)
  }

  async function toggleFavorite(fav: FavoriteInput) {
    const adding = !favorites.getters.isFavorite(fav.url)
    try {
      await (adding ? favorites.actions.add(fav) : favorites.actions.remove(fav.url))
      const place = isStation(fav) ? 'Library' : 'favourites'
      showToast(adding ? `Added to ${place}` : `Removed from ${place}`)
    } catch {
      showToast("Couldn't reach the server")
      void favorites.actions.refresh()
    }
  }

  // Stations are saved as LMS favourites too, but they're presented as part of the Library
  function favoriteAction(fav: FavoriteInput): SheetAction {
    const place = isStation(fav) ? 'Library' : 'favourites'
    return favorites.getters.isFavorite(fav.url)
      ? { label: `Remove from ${place}`, icon: 'heart', run: () => void toggleFavorite(fav) }
      : { label: `Add to ${place}`, icon: 'heartOutline', run: () => void toggleFavorite(fav) }
  }

  function openActions(
    target: PlayTarget,
    sheet: Omit<ActionSheetContent, 'actions'>,
    opts: { favorite?: FavoriteInput; extra?: SheetAction[] } = {},
  ) {
    actionSheet.value = {
      ...sheet,
      actions: [
        { label: 'Play now', icon: 'play', run: () => void play('load', target) },
        { label: 'Play next', icon: 'playNext', run: () => void play('insert', target) },
        { label: 'Add to queue', icon: 'addToQueue', run: () => void play('add', target) },
        ...(opts.favorite ? [favoriteAction(opts.favorite)] : []),
        ...(opts.extra ?? []),
      ],
    }
  }

  function openTrackActions(track: LibraryTrack, opts: { withAlbum?: boolean; extra?: SheetAction[] } = {}) {
    const albumId = Number(track.album_id)
    const art = coverUrl(track.artwork_track_id, 96)
    const extra: SheetAction[] = []
    if (track.url) {
      const url = track.url
      extra.push(addToPlaylistAction({ title: track.title, subtitle: track.artist, art, urls: async () => [url] }))
    }
    if (nav && albumId && opts.withAlbum !== false) {
      extra.push({
        label: 'Go to album',
        icon: 'album',
        run: () =>
          nav.push({ kind: 'album', album: { id: albumId, album: track.album ?? '', artwork_track_id: track.artwork_track_id } }),
      })
    }
    openActions(
      { track_id: track.id },
      { title: track.title, subtitle: track.artist, art },
      { favorite: trackFavorite(track), extra: [...extra, ...(opts.extra ?? [])] },
    )
  }

  return { play, openActions, openTrackActions, toggleFavorite, favoriteAction }
}

// LMS stores an icon with each favourite; local covers use this path form
function coverIcon(artworkTrackId: string | undefined) {
  return artworkTrackId ? `music/${artworkTrackId}/cover.png` : undefined
}

export function albumFavorite(album: Album): FavoriteInput | undefined {
  return album.favorites_url
    ? { url: album.favorites_url, title: album.album, icon: coverIcon(album.artwork_track_id) }
    : undefined
}

export function trackFavorite(track: LibraryTrack): FavoriteInput | undefined {
  return track.url ? { url: track.url, title: track.title, icon: coverIcon(track.artwork_track_id) } : undefined
}

// Same form as the favorites_url LMS returns for artists
export function artistFavorite(name: string): FavoriteInput {
  return { url: `db:contributor.name=${encodeURIComponent(name)}`, title: name }
}

export function playlistFavorite(playlist: Playlist): FavoriteInput | undefined {
  return playlist.url ? { url: playlist.url, title: playlist.playlist } : undefined
}

export function addToPlaylistAction(content: PlaylistPickerContent): SheetAction {
  return { label: 'Add to playlist…', icon: 'playlistAdd', run: () => (playlistPicker.value = content) }
}

export async function trackUrls(opts: { albumId?: number; artistId?: number }): Promise<string[]> {
  const { items } = await fetchTracks(0, 2000, opts)
  return items.flatMap((t) => (t.url ? [t.url] : []))
}

function isStation(fav: FavoriteInput): boolean {
  return favoriteKind({ id: '', name: fav.title, url: fav.url }) === 'radio'
}
