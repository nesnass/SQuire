<script setup lang="ts">
import { computed } from 'vue'
import usePlayerStore from '@/store/usePlayerStore'
import { artworkUrl, formatTime, qualityLabel } from '@/lms/format'
import BottomSheet from './BottomSheet.vue'
import Icon from './Icon.vue'
import RoomVolume from './RoomVolume.vue'
import SkipIcon from './SkipIcon.vue'
import { addToPlaylistAction, usePlayActions } from './browse/playActions'
import { useTransport } from './useTransport'
import { actionSheet, type SheetAction } from './overlays'

const emit = defineEmits<{ close: []; queue: []; outputs: [roomId: string] }>()
const { getters, actions } = usePlayerStore()

const SWIPE_PX = 60

const track = getters.currentTrack
const art = computed(() => artworkUrl(track.value, 800))
const shuffle = computed(() => Boolean(getters.status.value?.['playlist shuffle']))
const repeat = computed(() => getters.status.value?.['playlist repeat'] ?? 0)
const { mode, station, previousStation, nextStation, previous, next } = useTransport()
const canSeek = computed(() => Boolean(getters.status.value?.can_seek))
const repeatLabel = computed(() => ['Repeat off', 'Repeating track', 'Repeating queue'][repeat.value])

const { favoriteAction } = usePlayActions()

function openMore() {
  const t = track.value
  if (!t?.url) return
  const url = t.url
  const art = artworkUrl(t, 96)
  if (mode.value === 'radio') {
    // The queue holds the resolved stream; a saved station is kept under its original link, so act on that
    const saved = station.value
    const name = saved?.name ?? t.remote_title ?? t.title
    const fav = saved?.url ? { url: saved.url, title: saved.name, icon: saved.image } : { url, title: name, icon: t.artwork_url }
    actionSheet.value = { title: name, subtitle: t.title, art, actions: [favoriteAction(fav)] }
    return
  }
  const actions: SheetAction[] = [
    favoriteAction({ url, title: t.title, icon: t.coverid ? `music/${t.coverid}/cover.png` : undefined }),
    addToPlaylistAction({ title: t.title, subtitle: t.artist, art, urls: async () => [url] }),
  ]
  actionSheet.value = { title: t.title, subtitle: t.artist, art, actions }
}

function onSeek(event: Event) {
  void actions.seek(Number((event.target as HTMLInputElement).value))
}

// Horizontal swipe on the artwork skips; the buttons below remain the primary control
let touchStartX: number | null = null
function onTouchStart(event: TouchEvent) {
  touchStartX = event.touches[0].clientX
}
function onTouchEnd(event: TouchEvent) {
  if (touchStartX === null) return
  const dx = event.changedTouches[0].clientX - touchStartX
  if (dx < -SWIPE_PX) next()
  else if (dx > SWIPE_PX) previous()
  touchStartX = null
}
</script>

<template>
  <BottomSheet full label="Now playing" @close="emit('close')">
    <template #header="{ close }">
      <div class="flex items-center px-3 pb-1">
        <button
          type="button"
          class="grid size-11 place-items-center rounded-full active:bg-neutral-800"
          aria-label="Close now playing"
          @click="close"
        >
          <Icon name="expandMore" class="size-8" />
        </button>
        <p class="flex-1 truncate text-center text-xs font-medium tracking-wide text-neutral-400 uppercase">
          Playing on {{ getters.activeLabel.value }}
        </p>
        <button
          type="button"
          class="grid size-11 place-items-center rounded-full active:bg-neutral-800 disabled:invisible"
          :aria-label="mode === 'radio' ? 'More for this station' : 'More for this song'"
          :disabled="!track?.url"
          @click="openMore"
        >
          <Icon name="more" class="size-6" />
        </button>
      </div>
    </template>

    <div
      class="mx-auto flex h-full max-w-md flex-col justify-evenly gap-4 px-6 pb-[max(env(safe-area-inset-bottom),1rem)]"
    >
      <div
        class="mx-auto aspect-square w-full max-w-[min(100%,42dvh)] overflow-hidden rounded-2xl bg-neutral-800 shadow-2xl"
        @touchstart.passive="onTouchStart"
        @touchend="onTouchEnd"
      >
        <img v-if="art" :src="art" alt="" class="size-full object-cover" draggable="false" />
      </div>

      <div class="min-w-0">
        <h2 class="truncate text-2xl font-bold">{{ track?.title ?? 'Nothing queued' }}</h2>
        <p class="truncate text-neutral-300">{{ track?.artist }}</p>
        <p class="truncate text-sm text-neutral-500">{{ track?.album ?? track?.remote_title }}</p>
      </div>

      <div v-if="mode === 'radio'" class="flex items-center justify-between gap-2 text-xs text-neutral-400">
        <span class="flex items-center gap-1.5 font-semibold tracking-wide text-accent">
          <span class="size-2 rounded-full bg-accent" aria-hidden="true" />LIVE
        </span>
        <span class="truncate text-neutral-500">{{ qualityLabel(track) }}</span>
      </div>
      <div v-else>
        <input
          type="range"
          class="h-6 w-full accent-accent"
          min="0"
          :max="getters.duration.value || 0"
          step="1"
          :value="getters.position.value"
          :disabled="!canSeek"
          aria-label="Seek"
          :aria-valuetext="`${formatTime(getters.position.value)} of ${formatTime(getters.duration.value)}`"
          @change="onSeek"
        />
        <div class="flex items-center justify-between gap-2 text-xs tabular-nums text-neutral-400">
          <span>{{ formatTime(getters.position.value) }}</span>
          <span class="truncate text-neutral-500">{{ qualityLabel(track) }}</span>
          <span>-{{ formatTime(getters.duration.value - getters.position.value) }}</span>
        </div>
      </div>

      <!-- Controls that do nothing for the current item stay in the layout, invisible, so play/pause doesn't shift -->
      <div class="flex items-center justify-between">
        <button
          type="button"
          class="grid size-11 place-items-center rounded-full active:bg-neutral-800"
          :class="[shuffle ? 'text-accent' : 'text-neutral-400', { invisible: mode === 'radio' }]"
          aria-label="Shuffle"
          :aria-pressed="shuffle"
          @click="actions.toggleShuffle"
        >
          <Icon name="shuffle" class="size-6" />
        </button>
        <button
          v-if="mode === 'podcast'"
          type="button"
          class="grid size-14 place-items-center rounded-full active:bg-neutral-800 disabled:opacity-40"
          aria-label="Back 15 seconds"
          :disabled="!canSeek"
          @click="previous"
        >
          <SkipIcon :seconds="15" class="size-10" />
        </button>
        <button
          v-else
          type="button"
          class="grid size-14 place-items-center rounded-full active:bg-neutral-800"
          :class="{ invisible: mode === 'radio' && !previousStation }"
          :aria-label="mode === 'radio' ? `Previous station: ${previousStation?.name}` : 'Previous track'"
          @click="previous"
        >
          <Icon name="previous" class="size-9" />
        </button>
        <button
          type="button"
          class="grid size-18 place-items-center rounded-full bg-white text-neutral-950 active:scale-95"
          :aria-label="getters.isPlaying.value ? 'Pause' : 'Play'"
          @click="actions.togglePlay()"
        >
          <Icon :name="getters.isPlaying.value ? 'pause' : 'play'" class="size-10" />
        </button>
        <button
          v-if="mode === 'podcast'"
          type="button"
          class="grid size-14 place-items-center rounded-full active:bg-neutral-800 disabled:opacity-40"
          aria-label="Forward 30 seconds"
          :disabled="!canSeek"
          @click="next"
        >
          <SkipIcon :seconds="30" forward class="size-10" />
        </button>
        <button
          v-else
          type="button"
          class="grid size-14 place-items-center rounded-full active:bg-neutral-800"
          :class="{ invisible: mode === 'radio' && !nextStation }"
          :aria-label="mode === 'radio' ? `Next station: ${nextStation?.name}` : 'Next track'"
          @click="next"
        >
          <Icon name="next" class="size-9" />
        </button>
        <button
          type="button"
          class="grid size-11 place-items-center rounded-full active:bg-neutral-800"
          :class="[repeat ? 'text-accent' : 'text-neutral-400', { invisible: mode === 'radio' }]"
          :aria-label="repeatLabel"
          @click="actions.cycleRepeat"
        >
          <Icon :name="repeat === 1 ? 'repeatOne' : 'repeat'" class="size-6" />
        </button>
      </div>

      <div class="flex flex-col gap-2">
        <RoomVolume v-if="getters.activeRoom.value" :room="getters.activeRoom.value" />
        <div class="flex items-center justify-between">
          <button
            type="button"
            class="flex min-h-11 min-w-0 items-center gap-2 rounded-full bg-neutral-800 px-4 text-sm font-medium active:bg-neutral-700"
            @click="getters.activeRoom.value && emit('outputs', getters.activeRoom.value.id)"
          >
            <Icon name="speaker" class="size-5 shrink-0 text-accent" />
            <span class="sr-only">Choose where to play. Now playing on</span>
            <span class="truncate">{{ getters.activeLabel.value }}</span>
          </button>
          <button
            type="button"
            class="grid size-11 place-items-center rounded-full text-neutral-300 active:bg-neutral-800"
            aria-label="Queue"
            @click="emit('queue')"
          >
            <Icon name="queue" class="size-6" />
          </button>
        </div>
      </div>
    </div>
  </BottomSheet>
</template>
