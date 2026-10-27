<script setup lang="ts">
import type { Playlist } from '@/lms/types'
import Icon from '../Icon.vue'
import { useNav } from './nav'

const props = defineProps<{ playlist: Playlist }>()
const nav = useNav()
</script>

<template>
  <button
    type="button"
    class="flex min-h-14 w-full items-center gap-3 px-4 py-1.5 text-left active:bg-neutral-900"
    @click="nav.push({ kind: 'playlist', playlist: props.playlist })"
  >
    <span class="flex size-12 shrink-0 items-center justify-center rounded-lg bg-neutral-800 text-neutral-500">
      <Icon name="queue" class="size-6" />
    </span>
    <span class="truncate">{{ props.playlist.playlist }}</span>
  </button>
</template>
