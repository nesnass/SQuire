<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { appearsOn } from '@/lms/credits'
import { imageUrl } from '@/lms/format'
import { fetchArtistPhotos, fetchBiography } from '@/lms/info'
import { ALBUM_ARTIST_ROLES, fetchAlbums } from '@/lms/library'
import type { Album } from '@/lms/types'
import AboutSection from './AboutSection.vue'
import AlbumTile from './AlbumTile.vue'
import BackHeader from './BackHeader.vue'
import PlayBar from './PlayBar.vue'
import { addToPlaylistAction, artistFavorite, trackUrls, usePlayActions } from './playActions'

// More than any one artist has in practice; both lists are needed whole to tell them apart
const MAX_ALBUMS = 500

const props = defineProps<{ id: number; name: string }>()
const { openActions } = usePlayActions()
const heading = ref<HTMLElement | null>(null)

const own = ref<Album[] | null>(null)
const others = ref<Album[]>([])
const error = ref(false)

const target = computed(() => ({ artist_id: props.id }))
const favorite = computed(() => artistFavorite(props.name))
const addToPlaylist = addToPlaylistAction({ title: props.name, urls: () => trackUrls({ artistId: props.id }) })

// "Albums" is where they're the album's artist; "Appears on" is every other album with any credit for them,
// compilations included
async function load() {
  error.value = false
  try {
    const [mine, all] = await Promise.all([
      fetchAlbums(0, MAX_ALBUMS, { artistId: props.id, roleId: ALBUM_ARTIST_ROLES, compilation: 0, sort: 'yearalbum' }),
      fetchAlbums(0, MAX_ALBUMS, { artistId: props.id, sort: 'yearalbum' }),
    ])
    own.value = mine.items
    others.value = appearsOn(all.items, mine.items)
  } catch {
    error.value = true
  }
}

// Looked up online by a plugin, so they arrive after the albums and are left out when not found
const PORTRAIT_PX = 160
const biography = ref<string | null>(null)
const photos = ref<string[]>([])
async function loadAbout() {
  const [bio, pics] = await Promise.all([
    fetchBiography(props.id).catch(() => null),
    fetchArtistPhotos(props.id).catch(() => []),
  ])
  biography.value = bio
  photos.value = pics
}

onMounted(() => {
  void load()
  void loadAbout()
  heading.value?.focus()
})
</script>

<template>
  <article class="pb-6">
    <BackHeader :title="props.name" />
    <header class="flex items-center gap-4 px-4 pt-2">
      <img
        v-if="photos[0]"
        :src="imageUrl(photos[0], PORTRAIT_PX)"
        alt=""
        class="size-20 shrink-0 rounded-full bg-neutral-800 object-cover"
      />
      <div class="min-w-0">
        <h1 ref="heading" tabindex="-1" class="text-3xl font-bold outline-none">{{ props.name }}</h1>
        <p v-if="own" class="text-sm text-neutral-400">
          {{ own.length }} {{ own.length === 1 ? 'album' : 'albums' }}<template v-if="others.length">
            · appears on {{ others.length }}</template
          >
        </p>
      </div>
    </header>

    <PlayBar
      :target="target"
      :favorite="favorite"
      more-label="More artist options"
      @more="openActions(target, { title: props.name }, { favorite, extra: [addToPlaylist] })"
    />

    <AboutSection
      v-if="biography"
      class="pb-4"
      heading="About"
      :title="`About ${props.name}`"
      :text="biography"
      :photos="photos"
    />

    <p v-if="error" class="flex items-center justify-center gap-3 px-4 py-10 text-sm text-neutral-400">
      Couldn't load albums
      <button type="button" class="min-h-11 rounded-full bg-neutral-800 px-4 text-neutral-100" @click="load">Retry</button>
    </p>
    <p v-else-if="!own" class="px-4 py-10 text-center text-neutral-400">Loading…</p>

    <section v-if="own?.length" aria-labelledby="artist-albums">
      <h2 id="artist-albums" class="px-4 pb-3 text-lg font-semibold">Albums</h2>
      <ul class="grid grid-cols-2 gap-x-4 gap-y-5 px-4 @md:grid-cols-3 @2xl:grid-cols-4 @4xl:grid-cols-5 @6xl:grid-cols-6">
        <li v-for="a in own" :key="a.id">
          <AlbumTile :album="a" :show-artist="a.artist_id !== props.id" />
        </li>
      </ul>
    </section>

    <section v-if="others.length" aria-labelledby="artist-appears" class="pt-6">
      <h2 id="artist-appears" class="px-4 pb-3 text-lg font-semibold">Appears on</h2>
      <ul class="grid grid-cols-2 gap-x-4 gap-y-5 px-4 @md:grid-cols-3 @2xl:grid-cols-4 @4xl:grid-cols-5 @6xl:grid-cols-6">
        <li v-for="a in others" :key="a.id">
          <AlbumTile :album="a" />
        </li>
      </ul>
    </section>
  </article>
</template>
