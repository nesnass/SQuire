<script setup lang="ts">
import { computed } from 'vue'
import { coverUrl, formatTime } from '@/lms/format'
import type { LibraryTrack } from '@/lms/types'
import usePlayerStore from '@/store/usePlayerStore'
import Icon from '../Icon.vue'
import PlayingBars from '../PlayingBars.vue'

// Album lists show the track number; elsewhere tracks show artwork and album
const props = defineProps<{ track: LibraryTrack; numbered?: boolean; hideArtist?: boolean }>()
const emit = defineEmits<{ play: []; more: [] }>()
const { getters } = usePlayerStore()

const isCurrent = computed(() => getters.currentTrack.value?.id === props.track.id)
const subtitle = computed(() => {
  const parts = props.hideArtist ? [] : [props.track.artist]
  if (!props.numbered) parts.push(props.track.album)
  return parts.filter(Boolean).join(' · ')
})
</script>

<template>
  <div class="flex items-center" :class="{ 'bg-neutral-900': isCurrent }">
    <button
      type="button"
      class="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-1.5 pl-4 text-left active:bg-neutral-800"
      :aria-current="isCurrent ? 'true' : undefined"
      @click="emit('play')"
    >
      <span v-if="props.numbered" class="flex w-6 shrink-0 justify-end text-sm tabular-nums text-neutral-500">
        <PlayingBars v-if="isCurrent && getters.isPlaying.value" />
        <template v-else>{{ props.track.tracknum }}</template>
      </span>
      <img
        v-else
        :src="coverUrl(props.track.artwork_track_id, 96)"
        alt=""
        loading="lazy"
        class="size-11 shrink-0 rounded bg-neutral-800 object-cover"
      />
      <span class="min-w-0 flex-1">
        <span class="block truncate" :class="isCurrent ? 'text-accent' : ''">{{ props.track.title }}</span>
        <span v-if="subtitle" class="block truncate text-sm text-neutral-400">{{ subtitle }}</span>
      </span>
      <span class="text-sm tabular-nums text-neutral-500">{{ formatTime(props.track.duration) }}</span>
    </button>
    <button
      type="button"
      class="flex size-12 shrink-0 items-center justify-center text-neutral-400 active:text-neutral-100"
      :aria-label="`More for ${props.track.title}`"
      @click="emit('more')"
    >
      <Icon name="more" class="size-6" />
    </button>
  </div>
</template>
