<script setup lang="ts">
import { ref, watch } from 'vue'
import { fetchPlaylists } from '@/lms/library'
import useFavoritesStore from '@/store/useFavoritesStore'
import Icon from '../Icon.vue'
import { playlistsVersion } from '../overlays'
import FavoriteRow from './FavoriteRow.vue'
import LoadMore from './LoadMore.vue'
import MusicView from './MusicView.vue'
import PlaylistTile from './PlaylistTile.vue'
import PodcastShelf from './PodcastShelf.vue'
import { useNav } from './nav'
import { usePaged } from './usePaged'

// Grouped by what relates: the local collection, then playlists, then podcasts and radio, which can't go on a playlist
type Section = 'music' | 'playlists' | 'podcasts' | 'radio'

const sections: { id: Section; label: string }[] = [
  { id: 'music', label: 'Music' },
  { id: 'playlists', label: 'Playlists' },
  { id: 'podcasts', label: 'Podcasts' },
  { id: 'radio', label: 'Radio' },
]

const nav = useNav()
const favorites = useFavoritesStore()
const section = ref<Section>('music')
const playlists = usePaged((start, n) => fetchPlaylists(start, n), 200)

// A playlist created elsewhere appears here; unloaded lists stay unloaded
watch(playlistsVersion, () => {
  if (playlists.count.value !== null) playlists.reset()
})
watch(section, (s) => {
  if (s === 'playlists' && playlists.count.value === null) playlists.reset()
})
</script>

<template>
  <section class="pb-6" aria-labelledby="browse-title">
    <header class="px-4 pt-4">
      <h1 id="browse-title" class="text-3xl font-bold">Library</h1>
      <div class="mt-4 flex rounded-full bg-neutral-900 p-1 md:max-w-md" role="group" aria-label="Show">
        <button
          v-for="s in sections"
          :key="s.id"
          type="button"
          class="min-h-10 flex-1 rounded-full px-1 text-sm font-medium"
          :class="section === s.id ? 'bg-neutral-700 text-neutral-50' : 'text-neutral-400'"
          :aria-pressed="section === s.id"
          @click="section = s.id"
        >
          {{ s.label }}
        </button>
      </div>
    </header>

    <MusicView v-if="section === 'music'" />

    <template v-else-if="section === 'podcasts'">
      <div class="pt-4"><PodcastShelf /></div>
    </template>

    <template v-else-if="section === 'radio'">
      <!-- Same cells as Podcasts, with the way to add more as the last one -->
      <ul class="grid grid-cols-2 gap-x-4 gap-y-5 px-4 @md:grid-cols-3 @2xl:grid-cols-4 @4xl:grid-cols-5 @6xl:grid-cols-6 pt-4">
        <li v-for="f in favorites.getters.stations.value" :key="f.id"><FavoriteRow :favorite="f" tile /></li>
        <li>
          <button type="button" class="group w-full text-left" @click="nav.push({ kind: 'radioSources' })">
            <span
              class="flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-neutral-700 text-neutral-400 group-active:bg-neutral-900"
            >
              <Icon name="search" class="size-10" />
            </span>
            <span class="mt-2 block text-sm font-medium text-accent">Find stations</span>
          </button>
        </li>
      </ul>
      <p v-if="!favorites.getters.stations.value.length" class="px-4 pt-2 text-sm text-neutral-400">
        Stations you add from Find stations appear here.
      </p>
    </template>

    <template v-else-if="section === 'playlists'">
      <ul class="grid grid-cols-2 gap-x-4 gap-y-5 px-4 @md:grid-cols-3 @2xl:grid-cols-4 @4xl:grid-cols-5 @6xl:grid-cols-6 pt-4">
        <li v-for="p in playlists.items.value" :key="p.id">
          <PlaylistTile :playlist="p" />
        </li>
      </ul>
      <p v-if="playlists.done.value && !playlists.items.value.length" class="px-4 py-10 text-center text-neutral-400">
        No playlists yet
      </p>
      <LoadMore
        :loading="playlists.loading.value"
        :error="playlists.error.value"
        :done="playlists.done.value"
        @more="playlists.more"
      />
    </template>

  </section>
</template>
