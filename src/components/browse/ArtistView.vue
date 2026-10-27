<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { fetchAlbums } from '@/lms/library'
import AlbumTile from './AlbumTile.vue'
import BackHeader from './BackHeader.vue'
import LoadMore from './LoadMore.vue'
import PlayBar from './PlayBar.vue'
import { usePaged } from './usePaged'
import { addToPlaylistAction, artistFavorite, trackUrls, usePlayActions } from './playActions'

const props = defineProps<{ id: number; name: string }>()
const { openActions } = usePlayActions()
const heading = ref<HTMLElement | null>(null)

const albums = usePaged((start, n) => fetchAlbums(start, n, { artistId: props.id, sort: 'yearalbum' }))
const target = computed(() => ({ artist_id: props.id }))
const favorite = computed(() => artistFavorite(props.name))
const addToPlaylist = addToPlaylistAction({ title: props.name, urls: () => trackUrls({ artistId: props.id }) })

onMounted(() => {
  albums.reset()
  heading.value?.focus()
})
</script>

<template>
  <article class="pb-6">
    <BackHeader :title="props.name" />
    <header class="px-4 pt-2">
      <h1 ref="heading" tabindex="-1" class="text-3xl font-bold outline-none">{{ props.name }}</h1>
      <p v-if="albums.count.value !== null" class="text-sm text-neutral-400">
        {{ albums.count.value }} {{ albums.count.value === 1 ? 'album' : 'albums' }}
      </p>
    </header>

    <PlayBar
      :target="target"
      :favorite="favorite"
      more-label="More artist options"
      @more="openActions(target, { title: props.name }, { favorite, extra: [addToPlaylist] })"
    />

    <h2 class="px-4 pb-3 text-lg font-semibold">Albums</h2>
    <ul class="grid grid-cols-2 gap-x-4 gap-y-5 px-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      <li v-for="a in albums.items.value" :key="a.id">
        <AlbumTile :album="a" :show-artist="a.artist_id !== props.id" />
      </li>
    </ul>
    <LoadMore :loading="albums.loading.value" :error="albums.error.value" :done="albums.done.value" @more="albums.more" />
  </article>
</template>
