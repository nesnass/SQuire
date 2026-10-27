<script setup lang="ts">
import { imageUrl } from '@/lms/format'
import usePodcastStore from '@/store/usePodcastStore'
import Icon from '../Icon.vue'
import { useNav } from './nav'

const nav = useNav()
const podcasts = usePodcastStore()
</script>

<template>
  <ul class="grid grid-cols-2 gap-x-4 gap-y-5 px-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
    <li v-for="show in podcasts.getters.shows.value" :key="show.url">
      <button type="button" class="group w-full text-left" @click="nav.push({ kind: 'podcast', show })">
        <span class="block aspect-square overflow-hidden rounded-xl bg-neutral-800">
          <img
            v-if="show.image"
            :src="imageUrl(show.image, 300)"
            alt=""
            loading="lazy"
            class="size-full object-cover transition group-active:opacity-70"
          />
        </span>
        <span class="mt-2 line-clamp-2 text-sm font-medium">{{ show.name }}</span>
      </button>
    </li>
    <li>
      <button type="button" class="group w-full text-left" @click="nav.push({ kind: 'podcastSearch' })">
        <span
          class="flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-neutral-700 text-neutral-400 group-active:bg-neutral-900"
        >
          <Icon name="playlistAdd" class="size-10" />
        </span>
        <span class="mt-2 block text-sm font-medium text-accent">Add podcast</span>
      </button>
    </li>
  </ul>
</template>
