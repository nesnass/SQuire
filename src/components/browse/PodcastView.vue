<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { imageUrl } from '@/lms/format'
import { fetchEpisodes } from '@/lms/menus'
import type { MenuItem } from '@/lms/types'
import usePlayerStore from '@/store/usePlayerStore'
import usePodcastStore from '@/store/usePodcastStore'
import Icon from '../Icon.vue'
import { confirmSheet, showToast } from '../overlays'
import BackHeader from './BackHeader.vue'
import EpisodeRow from './EpisodeRow.vue'
import LoadMore from './LoadMore.vue'
import { useNav } from './nav'
import { usePaged } from './usePaged'

const props = defineProps<{ show: MenuItem }>()
const nav = useNav()
const { getters } = usePlayerStore()
const podcasts = usePodcastStore()
const heading = ref<HTMLElement | null>(null)

const name = computed(() => props.show.name ?? props.show.title ?? '')
const episodes = usePaged(async (start, n) => {
  const playerId = getters.menuPlayerId.value
  if (!playerId) throw new Error('No player connected')
  return fetchEpisodes(playerId, props.show.id, start, n)
}, 50)

function unsubscribe() {
  const url = props.show.url
  if (!url) return
  confirmSheet.value = {
    title: `Unsubscribe from “${name.value}”?`,
    message: 'It disappears from your podcasts. You can subscribe again from Add podcast.',
    confirmLabel: 'Unsubscribe',
    run: async () => {
      await podcasts.actions.unsubscribe(url)
      showToast(`Unsubscribed from ${name.value}`)
      nav.pop()
    },
  }
}

onMounted(() => {
  episodes.reset()
  heading.value?.focus()
})
</script>

<template>
  <article class="pb-6">
    <BackHeader :title="name" />
    <header class="px-6 pt-2 text-center">
      <img
        v-if="props.show.image"
        :src="imageUrl(props.show.image, 600)"
        alt=""
        class="mx-auto aspect-square w-full max-w-[min(100%,32dvh)] rounded-2xl bg-neutral-800 object-cover shadow-2xl"
      />
      <h1 ref="heading" tabindex="-1" class="mt-5 text-2xl font-bold outline-none">{{ name }}</h1>
      <p v-if="episodes.count.value !== null" class="mt-1 text-sm text-neutral-400">
        Podcast · {{ episodes.count.value }} episodes
      </p>
      <button
        v-if="props.show.url"
        type="button"
        class="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-neutral-800 px-5 text-sm font-medium active:bg-neutral-700"
        @click="unsubscribe"
      >
        <Icon name="remove" class="size-5" /> Unsubscribe
      </button>
    </header>

    <h2 class="px-4 pt-6 pb-1 text-lg font-semibold">Episodes</h2>
    <ol>
      <li v-for="e in episodes.items.value" :key="e.id"><EpisodeRow :episode="e" /></li>
    </ol>
    <LoadMore
      :loading="episodes.loading.value"
      :error="episodes.error.value"
      :done="episodes.done.value"
      @more="episodes.more"
    />
  </article>
</template>
