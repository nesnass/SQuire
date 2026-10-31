<script setup lang="ts">
import { computed } from 'vue'
import usePlayerStore from '@/store/usePlayerStore'
import { artworkUrl } from '@/lms/format'
import Icon from './Icon.vue'
import SkipIcon from './SkipIcon.vue'
import Spinner from './Spinner.vue'
import { useTransport } from './useTransport'

const emit = defineEmits<{ open: [] }>()
const { getters, actions } = usePlayerStore()

const SWIPE_PX = 40

const track = getters.currentTrack
const { mode, nextStation, next } = useTransport()
const progress = computed(() => (getters.duration.value ? (getters.position.value / getters.duration.value) * 100 : 0))

let touchStartY: number | null = null
function onTouchStart(event: TouchEvent) {
  touchStartY = event.touches[0].clientY
}
function onTouchEnd(event: TouchEvent) {
  if (touchStartY !== null && touchStartY - event.changedTouches[0].clientY > SWIPE_PX) emit('open')
  touchStartY = null
}
</script>

<template>
  <div class="mx-2 overflow-hidden rounded-2xl bg-neutral-800 shadow-lg" @touchstart.passive="onTouchStart" @touchend="onTouchEnd">
    <div class="flex items-center gap-1 p-2">
      <button type="button" class="flex min-w-0 flex-1 items-center gap-3 text-left" @click="emit('open')">
        <img
          v-if="artworkUrl(track, 120)"
          :src="artworkUrl(track, 120)"
          alt=""
          class="size-11 shrink-0 rounded-lg bg-neutral-700 object-cover"
        />
        <span v-else class="size-11 shrink-0 rounded-lg bg-neutral-700" />
        <span class="min-w-0">
          <span class="sr-only">Open now playing: </span>
          <span class="block truncate text-sm font-semibold">{{ getters.activeLabel.value }}</span>
          <span class="block truncate text-sm text-neutral-400">
            <template v-if="getters.starting.value">Starting…</template>
            <template v-else>{{ track ? [track.title, track.artist].filter(Boolean).join(' · ') : 'Nothing queued' }}</template>
          </span>
        </span>
      </button>
      <button
        type="button"
        class="grid size-11 shrink-0 place-items-center rounded-full active:bg-neutral-700"
        :aria-label="getters.isPlaying.value ? 'Pause' : 'Play'"
        @click="actions.togglePlay()"
      >
        <Spinner v-if="getters.starting.value" class="size-7" />
        <Icon v-else :name="getters.isPlaying.value ? 'pause' : 'play'" class="size-7" />
      </button>
      <button
        v-if="mode === 'podcast'"
        type="button"
        class="grid size-11 shrink-0 place-items-center rounded-full active:bg-neutral-700 disabled:opacity-40"
        aria-label="Forward 30 seconds"
        :disabled="!getters.status.value?.can_seek"
        @click="next"
      >
        <SkipIcon :seconds="30" forward class="size-7" />
      </button>
      <button
        v-else-if="mode === 'track' || nextStation"
        type="button"
        class="grid size-11 shrink-0 place-items-center rounded-full active:bg-neutral-700"
        :aria-label="mode === 'radio' ? `Next station: ${nextStation?.name}` : 'Next track'"
        @click="next"
      >
        <Icon name="next" class="size-7" />
      </button>
    </div>
    <div class="h-0.5 bg-neutral-700" aria-hidden="true">
      <div class="h-full bg-accent" :style="{ width: `${progress}%` }" />
    </div>
  </div>
</template>
