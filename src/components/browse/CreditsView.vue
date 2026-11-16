<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { CreditRole } from '@/lms/credits'
import { fetchTracks } from '@/lms/library'
import type { LibraryTrack } from '@/lms/types'
import BackHeader from './BackHeader.vue'
import LoadMore from './LoadMore.vue'
import PlayBar from './PlayBar.vue'
import TrackRow from './TrackRow.vue'
import { usePlayActions } from './playActions'
import { usePaged } from './usePaged'

// A composer or other artist has no albums of their own; their albums are other people's, so this lists tracks by album
const props = defineProps<{ id: number; name: string; role: CreditRole }>()
const { play, openActions, openTrackActions } = usePlayActions()
const heading = ref<HTMLElement | null>(null)

const tracks = usePaged((start, n) => fetchTracks(start, n, { artistId: props.id, sort: 'albumtrack' }), 200)
const albums = computed(() => {
  const groups: { album: string; tracks: LibraryTrack[] }[] = []
  for (const t of tracks.items.value) {
    const name = t.album ?? ''
    const last = groups.at(-1)
    if (last?.album === name) last.tracks.push(t)
    else groups.push({ album: name, tracks: [t] })
  }
  return groups
})
// Played as an explicit list: these are the tracks with this credit, not everything under the name
const target = computed(() => ({ track_id: tracks.items.value.map((t) => t.id).join(',') }))
const roleLabel = computed(() => (props.role === 'composers' ? 'Composer' : 'On other albums'))

onMounted(() => {
  tracks.reset()
  heading.value?.focus({ preventScroll: true })
})
</script>

<template>
  <article class="pb-6">
    <BackHeader :title="props.name" />
    <header class="px-4 pt-2">
      <h1 ref="heading" tabindex="-1" class="text-3xl font-bold outline-none">{{ props.name }}</h1>
      <p class="text-sm text-neutral-400">
        {{ roleLabel }}<template v-if="tracks.count.value !== null"> · {{ tracks.count.value }} {{ tracks.count.value === 1 ? 'track' : 'tracks' }}</template>
      </p>
    </header>

    <PlayBar
      v-if="tracks.items.value.length"
      :target="target"
      :more-label="`More for ${props.name}`"
      @more="openActions(target, { title: props.name, subtitle: roleLabel })"
    />

    <section v-for="(g, gi) in albums" :key="`${gi}:${g.album}`" :aria-label="g.album || 'No album'">
      <h2 class="px-4 pt-3 pb-1 text-sm font-semibold text-neutral-300">{{ g.album || 'No album' }}</h2>
      <ul>
        <li v-for="t in g.tracks" :key="t.id">
          <TrackRow :track="t" @play="play('load', { track_id: t.id })" @more="openTrackActions(t, { withAlbum: true })" />
        </li>
      </ul>
    </section>
    <LoadMore :loading="tracks.loading.value" :error="tracks.error.value" :done="tracks.done.value" @more="tracks.more" />
  </article>
</template>
