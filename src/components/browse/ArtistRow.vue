<script setup lang="ts">
import { initials } from '@/lms/format'
import type { Artist } from '@/lms/types'
import Icon from '../Icon.vue'
import { useNav } from './nav'

const props = defineProps<{ artist: Artist }>()
const nav = useNav()
</script>

<template>
  <button
    type="button"
    class="flex min-h-14 w-full items-center gap-3 px-4 py-1.5 text-left active:bg-neutral-900"
    @click="nav.push({ kind: 'artist', id: props.artist.id, name: props.artist.artist })"
  >
    <span
      class="flex size-11 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-sm font-semibold text-neutral-300"
      aria-hidden="true"
    >
      <template v-if="initials(props.artist.artist)">{{ initials(props.artist.artist) }}</template>
      <Icon v-else name="person" class="size-5" />
    </span>
    <span class="truncate">{{ props.artist.artist }}</span>
  </button>
</template>
