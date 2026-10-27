<script setup lang="ts">
import { computed } from 'vue'
import { imageUrl } from '@/lms/format'
import type { Episode } from '@/lms/menus'
import Icon from '../Icon.vue'
import { usePlayActions } from './playActions'

const props = defineProps<{ episode: Episode }>()
const { play, openActions } = usePlayActions()

const target = computed(() => ({ menu: 'podcasts', item_id: props.episode.id }))
const art = computed(() => imageUrl(props.episode.image, 96))
</script>

<template>
  <div class="flex items-center">
    <button
      type="button"
      class="flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2 pl-4 text-left active:bg-neutral-900"
      @click="play('load', target)"
    >
      <img v-if="art" :src="art" alt="" loading="lazy" class="size-12 shrink-0 rounded-lg bg-neutral-800 object-cover" />
      <span class="min-w-0 flex-1">
        <span class="line-clamp-2">{{ props.episode.title }}</span>
        <span v-if="props.episode.detail" class="block truncate text-sm text-neutral-400">{{ props.episode.detail }}</span>
      </span>
    </button>
    <button
      type="button"
      class="flex size-12 shrink-0 items-center justify-center text-neutral-400 active:text-neutral-100"
      :aria-label="`More for ${props.episode.title}`"
      @click="openActions(target, { title: props.episode.title, subtitle: props.episode.detail, art })"
    >
      <Icon name="more" class="size-6" />
    </button>
  </div>
</template>
