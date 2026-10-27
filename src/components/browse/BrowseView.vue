<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { fetchAlbums, fetchArtists, fetchPlaylists, type AlbumSort } from '@/lms/library'
import { groupBySection, letterSections, type LetterSection } from '@/lms/sections'
import useFavoritesStore from '@/store/useFavoritesStore'
import Icon from '../Icon.vue'
import { playlistsVersion } from '../overlays'
import AlbumTile from './AlbumTile.vue'
import ArtistRow from './ArtistRow.vue'
import FavoriteRow from './FavoriteRow.vue'
import LetterRail from './LetterRail.vue'
import LoadMore from './LoadMore.vue'
import PlaylistRow from './PlaylistRow.vue'
import PodcastShelf from './PodcastShelf.vue'
import { useNav } from './nav'
import { usePaged } from './usePaged'

type Section = 'albums' | 'artists' | 'playlists' | 'podcasts' | 'radio'

// `short` is shown on phone widths, where five full labels don't fit comfortably
const sections: { id: Section; label: string; short?: string }[] = [
  { id: 'albums', label: 'Albums' },
  { id: 'artists', label: 'Artists' },
  { id: 'playlists', label: 'Playlists' },
  { id: 'podcasts', label: 'Podcasts', short: 'Pods' },
  { id: 'radio', label: 'Radio' },
]
const sorts: { id: AlbumSort; label: string }[] = [
  { id: 'new', label: 'Recently added' },
  { id: 'album', label: 'Title' },
  { id: 'artistalbum', label: 'Artist' },
]

const nav = useNav()
const favorites = useFavoritesStore()
const section = ref<Section>('albums')
const sort = ref<AlbumSort>('new')

// The letter index comes with the first page; "Recently added" has no alphabetical order to index
const albums = usePaged((start, n) =>
  fetchAlbums(start, n, { sort: sort.value, withIndex: start === 0 && sort.value !== 'new' }),
)
const artists = usePaged((start, n) => fetchArtists(start, n, { withIndex: start === 0 }), 200)

const albumSections = computed(() => letterSections(albums.index.value))
const albumGroups = computed(() => groupBySection(albums.items.value, albumSections.value))
const artistSections = computed(() => letterSections(artists.index.value))
const artistGroups = computed(() => groupBySection(artists.items.value, artistSections.value))

// Sliding along the rail fires several jumps; only the latest may scroll once its page arrives
let jumpToken = 0
async function jump(list: typeof albums | typeof artists, prefix: string, section: LetterSection) {
  const token = ++jumpToken
  await list.loadTo(section.start + 1)
  await nextTick()
  if (token === jumpToken) document.getElementById(`${prefix}-${section.start}`)?.scrollIntoView({ block: 'start' })
}
const playlists = usePaged((start, n) => fetchPlaylists(start, n), 200)

onMounted(albums.reset)
watch(sort, albums.reset)
// A playlist created elsewhere appears here; unloaded lists stay unloaded
watch(playlistsVersion, () => {
  if (playlists.count.value !== null) playlists.reset()
})
watch(section, (s) => {
  if (s === 'artists' && artists.count.value === null) artists.reset()
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
          <template v-if="s.short">
            <span class="sm:hidden" aria-hidden="true">{{ s.short }}</span>
            <span class="sr-only sm:not-sr-only">{{ s.label }}</span>
          </template>
          <template v-else>{{ s.label }}</template>
        </button>
      </div>
    </header>

    <template v-if="section === 'albums'">
      <div class="flex gap-2 overflow-x-auto px-4 py-4" role="group" aria-label="Sort albums by">
        <button
          v-for="s in sorts"
          :key="s.id"
          type="button"
          class="min-h-9 shrink-0 rounded-full border px-3 text-sm"
          :class="sort === s.id ? 'border-accent text-accent' : 'border-neutral-700 text-neutral-300'"
          :aria-pressed="sort === s.id"
          @click="sort = s.id"
        >
          {{ s.label }}
        </button>
      </div>
      <section
        v-for="g in albumGroups"
        :key="g.section?.start ?? 'all'"
        :aria-labelledby="g.section ? `albums-${g.section.start}` : undefined"
      >
        <h3
          v-if="g.section"
          :id="`albums-${g.section.start}`"
          class="sticky top-0 z-5 bg-neutral-950/95 px-4 py-1.5 text-sm font-semibold text-accent backdrop-blur"
        >
          {{ g.section.letter }}
        </h3>
        <ul class="grid grid-cols-2 gap-x-4 gap-y-5 pb-5 pl-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" :class="g.section ? 'pr-10' : 'pr-4'">
          <li v-for="a in g.items" :key="a.id">
            <AlbumTile :album="a" />
          </li>
        </ul>
      </section>
      <LoadMore :loading="albums.loading.value" :error="albums.error.value" :done="albums.done.value" @more="albums.more" />
      <LetterRail v-if="albumSections.length > 1" :sections="albumSections" @jump="jump(albums, 'albums', $event)" />
    </template>

    <template v-else-if="section === 'podcasts'">
      <div class="pt-4"><PodcastShelf /></div>
    </template>

    <template v-else-if="section === 'radio'">
      <ul class="pt-3">
        <li v-for="f in favorites.getters.stations.value" :key="f.id"><FavoriteRow :favorite="f" /></li>
        <li>
          <button
            type="button"
            class="flex min-h-14 w-full items-center gap-3 px-4 py-1.5 text-left text-accent active:bg-neutral-900"
            @click="nav.push({ kind: 'radioSources' })"
          >
            <span class="flex size-12 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-neutral-700">
              <Icon name="search" class="size-6" />
            </span>
            <span class="flex-1">Find stations</span>
            <Icon name="back" class="size-5 rotate-180 text-neutral-600" />
          </button>
        </li>
      </ul>
      <p v-if="!favorites.getters.stations.value.length" class="px-4 pt-2 text-sm text-neutral-500">
        Stations you add from Find stations appear here.
      </p>
    </template>

    <template v-else-if="section === 'playlists'">
      <ul class="pt-3">
        <li v-for="p in playlists.items.value" :key="p.id">
          <PlaylistRow :playlist="p" />
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

    <template v-else>
      <p v-if="artists.count.value !== null" class="px-4 pt-4 pb-2 text-sm text-neutral-400">
        {{ artists.count.value }} artists
      </p>
      <section
        v-for="g in artistGroups"
        :key="g.section?.start ?? 'all'"
        :aria-labelledby="g.section ? `artists-${g.section.start}` : undefined"
      >
        <h3
          v-if="g.section"
          :id="`artists-${g.section.start}`"
          class="sticky top-0 z-5 bg-neutral-950/95 px-4 py-1.5 text-sm font-semibold text-accent backdrop-blur"
        >
          {{ g.section.letter }}
        </h3>
        <ul :class="{ 'pr-6': g.section }">
          <li v-for="a in g.items" :key="a.id">
            <ArtistRow :artist="a" />
          </li>
        </ul>
      </section>
      <LoadMore
        :loading="artists.loading.value"
        :error="artists.error.value"
        :done="artists.done.value"
        @more="artists.more"
      />
      <LetterRail v-if="artistSections.length > 1" :sections="artistSections" @jump="jump(artists, 'artists', $event)" />
    </template>
  </section>
</template>
