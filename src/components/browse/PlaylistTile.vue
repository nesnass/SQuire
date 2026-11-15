<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { coverUrl } from '@/lms/format'
import { fetchPlaylistTracks } from '@/lms/library'
import type { Playlist } from '@/lms/types'
import CoverTile from './CoverTile.vue'
import { useNav } from './nav'

// Enough tracks to usually find four different covers
const SAMPLE = 20
// Per playlist for the session, so scrolling back doesn't refetch
const cache = new Map<number, Promise<string[]>>()

// Same as PlaylistView's header: four distinct covers make a mosaic, fewer show the first
function coversFor(id: number): Promise<string[]> {
  const cached = cache.get(id)
  if (cached) return cached
  const covers = fetchPlaylistTracks(0, SAMPLE, id).then((page) => {
    const ids = [...new Set(page.items.map((t) => t.artwork_track_id).filter(Boolean))] as string[]
    const urls = ids.map((a) => coverUrl(a, 300)).filter((u): u is string => Boolean(u))
    return urls.length >= 4 ? urls.slice(0, 4) : urls.slice(0, 1)
  })
  covers.catch(() => cache.delete(id))
  cache.set(id, covers)
  return covers
}

const props = defineProps<{ playlist: Playlist }>()
const nav = useNav()
const root = ref<HTMLElement | null>(null)
const covers = ref<string[]>([])

// Playlists have no artwork of their own, so covers are fetched only once a tile scrolls into view
let observer: IntersectionObserver | null = null
onMounted(() => {
  observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return
      observer?.disconnect()
      coversFor(props.playlist.id)
        .then((c) => (covers.value = c))
        .catch(() => undefined)
    },
    { rootMargin: '200px' },
  )
  if (root.value) observer.observe(root.value)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div ref="root">
    <CoverTile
      :covers="covers"
      icon="queue"
      :title="props.playlist.playlist"
      @open="nav.push({ kind: 'playlist', playlist: props.playlist })"
    />
  </div>
</template>
