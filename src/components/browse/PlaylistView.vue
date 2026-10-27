<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { coverUrl, totalLength } from '@/lms/format'
import {
  deletePlaylist,
  fetchPlaylists,
  fetchPlaylistTracks,
  movePlaylistTrack,
  removeFromPlaylist,
  renamePlaylist,
} from '@/lms/library'
import type { LibraryTrack, Playlist } from '@/lms/types'
import useFavoritesStore from '@/store/useFavoritesStore'
import Icon from '../Icon.vue'
import { confirmSheet, namePrompt, playlistsVersion, showToast, type SheetAction } from '../overlays'
import BackHeader from './BackHeader.vue'
import EditableTrackList from './EditableTrackList.vue'
import LoadMore from './LoadMore.vue'
import PlayBar from './PlayBar.vue'
import TrackRow from './TrackRow.vue'
import { useNav } from './nav'
import { usePaged } from './usePaged'
import { playlistFavorite, usePlayActions } from './playActions'

const props = defineProps<{ playlist: Playlist }>()
const nav = useNav()
const favorites = useFavoritesStore()
const { play, openActions, openTrackActions } = usePlayActions()
const heading = ref<HTMLElement | null>(null)
// Rename changes the name and file url, so the route's copy is only the starting point
const info = ref<Playlist>(props.playlist)
const editing = ref(false)

const tracks = usePaged((start, n) => fetchPlaylistTracks(start, n, props.playlist.id), 200)
const target = computed(() => ({ playlist_id: props.playlist.id }))
const favorite = computed(() => playlistFavorite(info.value))
const seconds = computed(() => tracks.items.value.reduce((sum, t) => sum + (t.duration ?? 0), 0))

// Playlists have no artwork of their own; the first four distinct covers stand in
const mosaic = computed(() => {
  const ids = [...new Set(tracks.items.value.map((t) => t.artwork_track_id).filter(Boolean))] as string[]
  return ids.length >= 4 ? ids.slice(0, 4) : ids.slice(0, 1)
})

// Edits here bump the shared version too; this page already shows them, so it skips its own bump
let ownVersion = -1
watch(playlistsVersion, (v) => {
  if (v !== ownVersion) tracks.reset()
})
function notifyChanged() {
  ownVersion = ++playlistsVersion.value
}

// Edits run one at a time so LMS applies them in the order they were made
let pending = Promise.resolve()
function edit(change: (items: LibraryTrack[]) => LibraryTrack[], command: () => Promise<void>) {
  tracks.items.value = change([...tracks.items.value])
  pending = pending
    .then(command)
    .then(notifyChanged)
    .catch(() => {
      showToast("Couldn't update the playlist")
      tracks.reset()
    })
}

function remove(index: number) {
  edit(
    (items) => {
      items.splice(index, 1)
      if (tracks.count.value !== null) tracks.count.value--
      return items
    },
    () => removeFromPlaylist(props.playlist.id, index),
  )
}

function move(from: number, to: number) {
  edit(
    (items) => {
      items.splice(to, 0, ...items.splice(from, 1))
      return items
    },
    () => movePlaylistTrack(props.playlist.id, from, to),
  )
}

function trackActions(track: LibraryTrack, index: number) {
  const last = tracks.items.value.length - 1
  const extra: SheetAction[] = []
  if (index > 0) extra.push({ label: 'Move up', icon: 'arrowUp', run: () => move(index, index - 1) })
  if (index < last) extra.push({ label: 'Move down', icon: 'arrowDown', run: () => move(index, index + 1) })
  extra.push({ label: 'Remove from playlist', icon: 'remove', danger: true, run: () => remove(index) })
  openTrackActions(track, { extra })
}

function rename() {
  namePrompt.value = {
    title: 'Rename playlist',
    label: 'Name',
    initial: info.value.playlist,
    confirmLabel: 'Rename',
    submit: async (name) => {
      if (name === info.value.playlist) return null
      if (!(await renamePlaylist(props.playlist.id, name))) return 'A playlist with that name already exists'
      const fresh = (await fetchPlaylists(0, 500)).items.find((p) => p.id === props.playlist.id)
      info.value = fresh ?? { ...info.value, playlist: name }
      notifyChanged()
      showToast(`Renamed to ${name}`)
      return null
    },
  }
}

function confirmDelete() {
  const name = info.value.playlist
  confirmSheet.value = {
    title: `Delete “${name}”?`,
    message: 'The playlist file is removed from your server. The songs stay in your library.',
    confirmLabel: 'Delete playlist',
    run: async () => {
      const fav = favorite.value
      if (fav && favorites.getters.isFavorite(fav.url)) await favorites.actions.remove(fav.url)
      await deletePlaylist(props.playlist.id)
      notifyChanged()
      showToast(`Deleted ${name}`)
      nav.pop()
    },
  }
}

function playlistActions() {
  openActions(
    target.value,
    { title: info.value.playlist, subtitle: 'Playlist' },
    {
      favorite: favorite.value,
      extra: [
        { label: 'Edit songs', icon: 'edit', run: () => (editing.value = true) },
        { label: 'Rename playlist', icon: 'edit', run: rename },
        { label: 'Delete playlist', icon: 'delete', danger: true, run: confirmDelete },
      ],
    },
  )
}

onMounted(() => {
  tracks.reset()
  heading.value?.focus()
})
</script>

<template>
  <article class="pb-6">
    <BackHeader :title="info.playlist">
      <button
        v-if="tracks.items.value.length"
        type="button"
        class="min-h-11 shrink-0 rounded-full px-4 font-semibold active:bg-neutral-800"
        :class="editing ? 'text-accent' : 'text-neutral-300'"
        :aria-pressed="editing"
        @click="editing = !editing"
      >
        {{ editing ? 'Done' : 'Edit' }}
      </button>
    </BackHeader>
    <header class="px-6 pt-2 text-center">
      <div
        class="mx-auto grid aspect-square w-full max-w-[min(100%,32dvh)] overflow-hidden rounded-2xl bg-neutral-800 shadow-2xl"
        :class="mosaic.length === 4 ? 'grid-cols-2' : ''"
        aria-hidden="true"
      >
        <img v-for="id in mosaic" :key="id" :src="coverUrl(id, 300)" alt="" class="size-full object-cover" />
        <Icon v-if="!mosaic.length" name="queue" class="m-auto size-1/3 text-neutral-600" />
      </div>
      <h1 ref="heading" tabindex="-1" class="mt-5 text-2xl font-bold outline-none">{{ info.playlist }}</h1>
      <p v-if="tracks.count.value !== null" class="mt-1 text-sm text-neutral-400">
        Playlist · {{ tracks.count.value }} tracks<template v-if="seconds > 0"> · {{ totalLength(seconds) }}</template>
      </p>
    </header>

    <PlayBar
      v-if="!editing"
      :target="target"
      :favorite="favorite"
      more-label="More playlist options"
      @more="playlistActions"
    />
    <div v-else class="h-5" />

    <EditableTrackList v-if="editing" :tracks="tracks.items.value" @remove="remove" @move="move" />
    <ol v-else>
      <li v-for="(t, i) in tracks.items.value" :key="t.id">
        <TrackRow :track="t" @play="play('load', target, { playIndex: i })" @more="trackActions(t, i)" />
      </li>
    </ol>
    <p v-if="tracks.done.value && !tracks.items.value.length" class="px-4 py-10 text-center text-neutral-400">
      This playlist is empty. Add songs from any ⋯ menu.
    </p>
    <LoadMore :loading="tracks.loading.value" :error="tracks.error.value" :done="tracks.done.value" @more="tracks.more" />
  </article>
</template>
