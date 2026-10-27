<script setup lang="ts">
import { coverUrl } from '@/lms/format'
import type { Album } from '@/lms/types'
import Icon from '../Icon.vue'
import { useNav } from './nav'

const props = withDefaults(defineProps<{ album: Album; showArtist?: boolean }>(), { showArtist: true })
const nav = useNav()
</script>

<template>
  <button type="button" class="group w-full text-left" @click="nav.push({ kind: 'album', album: props.album })">
    <span class="relative block aspect-square overflow-hidden rounded-xl bg-neutral-800">
      <img
        v-if="props.album.artwork_track_id"
        :src="coverUrl(props.album.artwork_track_id, 300)"
        alt=""
        loading="lazy"
        decoding="async"
        class="size-full object-cover transition group-active:opacity-70"
      />
      <Icon v-else name="album" class="absolute inset-0 m-auto size-1/3 text-neutral-600" />
    </span>
    <span class="mt-2 block truncate text-sm font-medium">{{ props.album.album }}</span>
    <span class="block truncate text-sm text-neutral-400">
      <template v-if="props.showArtist">{{ props.album.artist }}</template>
      <template v-else>{{ props.album.year || '' }}</template>
    </span>
  </button>
</template>
