<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { coverUrl, groupByDisc, totalLength } from '@/lms/format'
import { fetchAlbums, fetchTracks } from '@/lms/library'
import type { Album, LibraryTrack } from '@/lms/types'
import BackHeader from './BackHeader.vue'
import LoadMore from './LoadMore.vue'
import PlayBar from './PlayBar.vue'
import TrackRow from './TrackRow.vue'
import { useNav } from './nav'
import { usePaged } from './usePaged'
import { addToPlaylistAction, albumFavorite, trackUrls, usePlayActions } from './playActions'

const props = defineProps<{ album: Album }>()
// Routes from a search song carry only id and title; the rest is fetched
const album = ref<Album>(props.album)
const nav = useNav()
const { play, openActions, openTrackActions } = usePlayActions()
const heading = ref<HTMLElement | null>(null)

const tracks = usePaged((start, n) => fetchTracks(start, n, { albumId: props.album.id }), 500)
const discs = computed(() => groupByDisc(tracks.items.value))
const target = computed(() => ({ album_id: props.album.id }))
const seconds = computed(() => tracks.items.value.reduce((sum, t) => sum + (t.duration ?? 0), 0))
const meta = computed(() =>
  [album.value.year || null, tracks.count.value !== null && `${tracks.count.value} tracks`, seconds.value > 0 && totalLength(seconds.value)]
    .filter(Boolean)
    .join(' · '),
)

onMounted(async () => {
  tracks.reset()
  heading.value?.focus()
  if (!album.value.artist) {
    const res = await fetchAlbums(0, 1, { albumId: props.album.id }).catch(() => null)
    if (res?.items[0]) album.value = res.items[0]
  }
})

function indexOf(track: LibraryTrack) {
  return tracks.items.value.indexOf(track)
}

function albumActions() {
  const { artist_id: artistId, artist = '' } = album.value
  const art = coverUrl(album.value.artwork_track_id, 96)
  const extra = [
    addToPlaylistAction({ title: album.value.album, subtitle: artist, art, urls: () => trackUrls({ albumId: props.album.id }) }),
  ]
  if (artistId) {
    extra.push({ label: 'Go to artist', icon: 'person', run: () => nav.push({ kind: 'artist', id: artistId, name: artist }) })
  }
  openActions(target.value, { title: album.value.album, subtitle: artist, art }, { extra })
}
</script>

<template>
  <article class="pb-6">
    <BackHeader :title="album.album" />
    <header class="px-6 pt-2 text-center">
      <img
        v-if="album.artwork_track_id"
        :src="coverUrl(album.artwork_track_id, 600)"
        alt=""
        class="mx-auto aspect-square w-full max-w-[min(100%,40dvh)] rounded-2xl bg-neutral-800 object-cover shadow-2xl"
      />
      <h1 ref="heading" tabindex="-1" class="mt-5 text-2xl font-bold outline-none">{{ album.album }}</h1>
      <button
        v-if="album.artist_id"
        type="button"
        class="mt-1 min-h-11 px-2 text-lg text-accent"
        @click="nav.push({ kind: 'artist', id: album.artist_id, name: album.artist ?? '' })"
      >
        {{ album.artist }}
      </button>
      <p class="text-sm text-neutral-400">{{ meta }}</p>
    </header>

    <PlayBar :target="target" :favorite="albumFavorite(album)" more-label="More album options" @more="albumActions" />

    <section v-for="d in discs" :key="d.disc" :aria-label="discs.length > 1 ? `Disc ${d.disc}` : 'Tracks'">
      <h2 v-if="discs.length > 1" class="px-4 pt-4 pb-1 text-sm font-semibold text-neutral-400">Disc {{ d.disc }}</h2>
      <ol>
        <li v-for="t in d.tracks" :key="t.id">
          <TrackRow
            :track="t"
            numbered
            :hide-artist="t.artist === album.artist"
            @play="play('load', target, { playIndex: indexOf(t) })"
            @more="openTrackActions(t, { withAlbum: false })"
          />
        </li>
      </ol>
    </section>
    <LoadMore :loading="tracks.loading.value" :error="tracks.error.value" :done="tracks.done.value" @more="tracks.more" />
  </article>
</template>
