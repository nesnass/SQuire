<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { fetchAlbums } from '@/lms/library'
import useFavoritesStore from '@/store/useFavoritesStore'
import Icon from '../Icon.vue'
import AlbumTile from './AlbumTile.vue'
import FavoriteRow from './FavoriteRow.vue'
import PodcastEpisodeLists from './PodcastEpisodeLists.vue'
import { useNav } from './nav'
import { usePaged } from './usePaged'

type Recent = 'added' | 'played'

const RECENT = 20
// Home should fit in about two screens; the rest are one tap away
const FAVORITES_SHOWN = 8
const RECENT_KEY = 'squire.homeRecent'
const recentOptions: { id: Recent; label: string }[] = [
  { id: 'added', label: 'Recently added' },
  { id: 'played', label: 'Recently played' },
]

function readSavedRecent(): Recent {
  try {
    return localStorage.getItem(RECENT_KEY) === 'played' ? 'played' : 'added'
  } catch {
    return 'added'
  }
}

const nav = useNav()
const favorites = useFavoritesStore()
const shownFavorites = computed(() => favorites.getters.items.value.slice(0, FAVORITES_SHOWN))
// One list per choice, so switching back shows the other straight away
const recentLists = {
  added: usePaged((start, n) => fetchAlbums(start, n, { sort: 'new' }), RECENT),
  played: usePaged((start, n) => fetchAlbums(start, n, { sort: 'recentlyplayed' }), RECENT),
}
const recentChoice = ref<Recent>(readSavedRecent())
const recent = () => recentLists[recentChoice.value]

// Play history moves on while listening, so it's fetched again each time it's chosen
watch(recentChoice, (choice) => {
  try {
    localStorage.setItem(RECENT_KEY, choice)
  } catch {
    // Not remembered in private browsing; the choice still applies now
  }
  if (choice === 'played' || recentLists.added.count.value === null) recentLists[choice].reset()
})

onMounted(() => {
  void favorites.actions.refresh()
  recent().reset()
})
</script>

<template>
  <section class="pb-6" aria-labelledby="home-title">
    <h1 id="home-title" class="px-4 pt-4 text-3xl font-bold">Home</h1>

    <section aria-labelledby="home-favorites" class="pt-5">
      <div class="flex items-center justify-between pr-2 pb-2 pl-4">
        <h2 id="home-favorites" class="text-lg font-semibold">Favourites</h2>
        <button
          v-if="favorites.getters.items.value.length > FAVORITES_SHOWN"
          type="button"
          class="min-h-11 rounded-full px-3 text-sm font-medium text-accent active:bg-neutral-900"
          @click="nav.push({ kind: 'favorites', id: '', name: 'Favourites' })"
        >
          Show all <span class="sr-only">favourites</span>
        </button>
      </div>
      <ul v-if="shownFavorites.length" class="grid grid-cols-2 gap-2 px-4 @2xl:grid-cols-3 @4xl:grid-cols-4">
        <li v-for="f in shownFavorites" :key="f.id"><FavoriteRow :favorite="f" tile /></li>
      </ul>
      <p v-else-if="favorites.getters.loaded.value" class="mx-4 mt-2 flex items-center gap-3 rounded-2xl bg-neutral-900 p-4 text-sm text-neutral-400">
        <Icon name="heartOutline" class="size-6 shrink-0" />
        Tap the heart on an album, artist or playlist to keep it here.
      </p>
    </section>

    <PodcastEpisodeLists />

    <section aria-labelledby="home-recent" class="pt-6">
      <h2 id="home-recent" class="px-4 pb-2 text-lg font-semibold">Albums</h2>
      <div class="flex gap-2 px-4 pb-3" role="group" aria-label="Show albums">
        <button
          v-for="o in recentOptions"
          :key="o.id"
          type="button"
          class="min-h-9 rounded-full border px-3 text-sm font-medium"
          :class="recentChoice === o.id ? 'border-accent text-accent' : 'border-neutral-700 text-neutral-300'"
          :aria-pressed="recentChoice === o.id"
          @click="recentChoice = o.id"
        >
          {{ o.label }}
        </button>
      </div>
      <!-- Keyed so each choice gets its own row; a shared one would keep the other list's sideways scroll -->
      <ul v-if="recent().items.value.length" :key="recentChoice" class="flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 pb-2">
        <li v-for="a in recent().items.value" :key="a.id" class="w-36 shrink-0 snap-start">
          <AlbumTile :album="a" />
        </li>
      </ul>
      <p v-else-if="recent().done.value" class="px-4 text-sm text-neutral-400">
        {{ recentChoice === 'played' ? 'Albums you play will show up here.' : 'No albums yet.' }}
      </p>
    </section>
  </section>
</template>
