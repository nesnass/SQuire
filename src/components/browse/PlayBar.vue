<script setup lang="ts">
import type { PlayTarget } from '@/lms/types'
import type { FavoriteInput } from '@/store/useFavoritesStore'
import Icon from '../Icon.vue'
import FavoriteButton from './FavoriteButton.vue'
import { usePlayActions } from './playActions'

const props = defineProps<{ target: PlayTarget; favorite?: FavoriteInput; moreLabel: string }>()
const emit = defineEmits<{ more: [] }>()
const { play } = usePlayActions()
</script>

<template>
  <div class="flex items-center gap-3 px-4 py-5 md:justify-center">
    <button
      type="button"
      class="flex min-h-12 flex-1 items-center md:max-w-48 justify-center gap-2 rounded-full bg-accent font-semibold text-neutral-950 active:opacity-80"
      @click="play('load', props.target, { shuffle: false })"
    >
      <Icon name="play" class="size-6" /> Play
    </button>
    <button
      type="button"
      class="flex min-h-12 flex-1 items-center md:max-w-48 justify-center gap-2 rounded-full bg-neutral-800 font-semibold active:bg-neutral-700"
      @click="play('load', props.target, { shuffle: true })"
    >
      <Icon name="shuffle" class="size-5" /> Shuffle
    </button>
    <FavoriteButton :favorite="props.favorite" />
    <button
      type="button"
      class="flex size-12 shrink-0 items-center justify-center rounded-full bg-neutral-800 active:bg-neutral-700"
      :aria-label="props.moreLabel"
      @click="emit('more')"
    >
      <Icon name="more" class="size-6" />
    </button>
  </div>
</template>
