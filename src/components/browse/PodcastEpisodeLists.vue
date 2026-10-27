<script setup lang="ts">
import { ref, watch } from 'vue'
import { fetchMenu, type Episode } from '@/lms/menus'
import usePlayerStore from '@/store/usePlayerStore'
import usePodcastStore from '@/store/usePodcastStore'
import Icon from '../Icon.vue'
import EpisodeRow from './EpisodeRow.vue'
import { useNav } from './nav'

interface Shelf {
  id: string
  name: string
  episodes: Episode[]
  more: boolean
}

const PREVIEW = 4

const nav = useNav()
const { getters } = usePlayerStore()
const podcasts = usePodcastStore()
const shelves = ref<Shelf[]>([])

// The plugin's own lists (new episodes, recently played) are shown inline when they have episodes in them
watch(
  podcasts.getters.lists,
  async (lists) => {
    const playerId = getters.menuPlayerId.value
    if (!playerId) return
    const loaded = await Promise.all(
      lists.map(async (list) => {
        const page = await fetchMenu(playerId, 'podcasts', { itemId: list.id, n: PREVIEW }).catch(() => null)
        const episodes = (page?.items ?? [])
          .filter((i) => i.isaudio)
          .map((i) => ({ id: i.id, title: i.name ?? i.title ?? '', image: i.image }))
        return { id: list.id, name: list.name ?? '', episodes, more: (page?.count ?? 0) > PREVIEW }
      }),
    )
    shelves.value = loaded.filter((s) => s.episodes.length)
  },
  { immediate: true },
)
</script>

<template>
  <!-- The plugin's list names ("Recently played") read as music without the Podcasts heading over them -->
  <section v-if="shelves.length" aria-labelledby="home-podcasts" class="pt-6">
    <h2 id="home-podcasts" class="px-4 text-lg font-semibold">Podcasts</h2>
    <section v-for="shelf in shelves" :key="shelf.id" :aria-labelledby="`shelf-${shelf.id}`" class="pt-2">
      <div class="flex items-center px-4">
        <h3 :id="`shelf-${shelf.id}`" class="flex-1 text-sm font-medium text-neutral-400">{{ shelf.name }}</h3>
        <button
          v-if="shelf.more"
          type="button"
          class="flex min-h-11 items-center gap-1 text-sm text-accent"
          @click="nav.push({ kind: 'menu', menu: 'podcasts', itemId: shelf.id, title: shelf.name })"
        >
          See all <Icon name="back" class="size-4 rotate-180" />
        </button>
      </div>
      <ul>
        <li v-for="e in shelf.episodes" :key="e.id"><EpisodeRow :episode="e" /></li>
      </ul>
    </section>
  </section>
</template>
