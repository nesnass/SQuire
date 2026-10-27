<script setup lang="ts">
import { ref, shallowRef, watch } from 'vue'
import { fetchAlbums, fetchArtists, fetchTracks } from '@/lms/library'
import type { Album, Artist, LibraryTrack } from '@/lms/types'
import Icon from '../Icon.vue'
import AlbumTile from './AlbumTile.vue'
import ArtistRow from './ArtistRow.vue'
import TrackRow from './TrackRow.vue'
import { usePlayActions } from './playActions'

interface Results {
  artists: Artist[]
  albums: Album[]
  tracks: LibraryTrack[]
}

const DEBOUNCE_MS = 300
const MIN_CHARS = 2

const { play, openTrackActions } = usePlayActions()
const query = ref('')
const results = shallowRef<Results | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

let timer: ReturnType<typeof setTimeout> | undefined
// Typing fires overlapping searches; only the latest may write results
let latest = 0

async function search(term: string) {
  const id = ++latest
  loading.value = true
  try {
    const [artists, albums, tracks] = await Promise.all([
      fetchArtists(0, 5, { search: term }),
      fetchAlbums(0, 10, { search: term }),
      fetchTracks(0, 25, { search: term }),
    ])
    if (id !== latest) return
    results.value = { artists: artists.items, albums: albums.items, tracks: tracks.items }
    error.value = null
  } catch (e) {
    if (id === latest) error.value = e instanceof Error ? e.message : String(e)
  } finally {
    if (id === latest) loading.value = false
  }
}

watch(query, (q) => {
  clearTimeout(timer)
  const term = q.trim()
  if (term.length < MIN_CHARS) {
    latest++
    results.value = null
    loading.value = false
    return
  }
  timer = setTimeout(() => void search(term), DEBOUNCE_MS)
})
</script>

<template>
  <section class="pb-6" aria-labelledby="search-title">
    <header class="sticky top-0 z-10 bg-neutral-950/90 px-4 pt-4 pb-3 backdrop-blur">
      <h1 id="search-title" class="text-3xl font-bold">Search</h1>
      <div class="relative mt-3">
        <Icon name="search" class="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-neutral-500" />
        <input
          v-model="query"
          type="search"
          enterkeyhint="search"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          placeholder="Artists, albums, songs"
          aria-label="Search library"
          class="min-h-12 w-full rounded-xl bg-neutral-800 pr-12 pl-10 text-base outline-none placeholder:text-neutral-500 focus:ring-2 focus:ring-accent [&::-webkit-search-cancel-button]:hidden"
        />
        <button
          v-if="query"
          type="button"
          class="absolute top-0 right-0 flex size-12 items-center justify-center text-neutral-400"
          aria-label="Clear search"
          @click="query = ''"
        >
          <Icon name="close" class="size-5" />
        </button>
      </div>
    </header>

    <p v-if="error" role="alert" class="px-4 py-6 text-center text-neutral-400">Search failed: {{ error }}</p>
    <p v-else-if="!results" class="px-4 py-10 text-center text-neutral-500">
      {{ loading ? 'Searching…' : 'Find anything in your library' }}
    </p>
    <p
      v-else-if="!results.artists.length && !results.albums.length && !results.tracks.length"
      class="px-4 py-10 text-center text-neutral-400"
    >
      No matches for “{{ query.trim() }}”
    </p>
    <div v-else :aria-busy="loading">
      <section v-if="results.artists.length" aria-labelledby="sr-artists">
        <h2 id="sr-artists" class="px-4 pt-4 pb-1 text-lg font-semibold">Artists</h2>
        <ul>
          <li v-for="a in results.artists" :key="a.id"><ArtistRow :artist="a" /></li>
        </ul>
      </section>
      <section v-if="results.albums.length" aria-labelledby="sr-albums">
        <h2 id="sr-albums" class="px-4 pt-5 pb-3 text-lg font-semibold">Albums</h2>
        <ul class="flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 pb-2">
          <li v-for="a in results.albums" :key="a.id" class="w-36 shrink-0 snap-start">
            <AlbumTile :album="a" />
          </li>
        </ul>
      </section>
      <section v-if="results.tracks.length" aria-labelledby="sr-songs">
        <h2 id="sr-songs" class="px-4 pt-5 pb-1 text-lg font-semibold">Songs</h2>
        <ul>
          <li v-for="t in results.tracks" :key="t.id">
            <TrackRow :track="t" @play="play('load', { track_id: t.id })" @more="openTrackActions(t)" />
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>
