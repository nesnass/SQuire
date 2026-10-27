<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { imageUrl } from '@/lms/format'
import { fetchFavoriteDetails, fetchMenu } from '@/lms/menus'
import type { MenuItem } from '@/lms/types'
import usePlayerStore from '@/store/usePlayerStore'
import Icon from '../Icon.vue'
import BackHeader from './BackHeader.vue'
import LoadMore from './LoadMore.vue'
import { useNav } from './nav'
import { usePaged } from './usePaged'
import { usePlayActions } from './playActions'

const props = defineProps<{ menu: string; title: string; itemId?: string; search?: string }>()
const nav = useNav()
const { getters } = usePlayerStore()
const { play, openActions } = usePlayActions()
const heading = ref<HTMLElement | null>(null)
const terms = ref<Record<string, string>>({})

const items = usePaged(async (start, n) => {
  const playerId = getters.menuPlayerId.value
  if (!playerId) throw new Error('No player connected')
  return fetchMenu(playerId, props.menu, { itemId: props.itemId, search: props.search, start, n })
}, 100)

function label(item: MenuItem) {
  return item.name ?? item.title ?? ''
}

function isPlayable(item: MenuItem) {
  return Boolean(item.isaudio)
}

function open(item: MenuItem) {
  if (isPlayable(item)) void play('load', { menu: props.menu, item_id: item.id })
  else nav.push({ kind: 'menu', menu: props.menu, itemId: item.id, title: label(item) })
}

function search(item: MenuItem) {
  const term = terms.value[item.id]?.trim()
  if (term) nav.push({ kind: 'menu', menu: props.menu, itemId: item.id, search: term, title: `“${term}”` })
}

async function more(item: MenuItem) {
  const playerId = getters.menuPlayerId.value
  // A failed lookup only costs the favourite option; playing still works
  const favorite = playerId ? await fetchFavoriteDetails(playerId, props.menu, item.id).catch(() => undefined) : undefined
  openActions({ menu: props.menu, item_id: item.id }, { title: label(item), art: imageUrl(item.image, 96) }, { favorite })
}

onMounted(() => {
  items.reset()
  heading.value?.focus()
})
</script>

<template>
  <article class="pb-6">
    <BackHeader :title="props.title" />
    <h1 ref="heading" tabindex="-1" class="px-4 pt-2 pb-3 text-3xl font-bold outline-none">{{ props.title }}</h1>
    <ul>
      <li v-for="item in items.items.value" :key="item.id">
        <form v-if="item.type === 'search'" class="px-4 py-2" @submit.prevent="search(item)">
          <div class="relative">
            <Icon name="search" class="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-neutral-500" />
            <input
              v-model="terms[item.id]"
              type="search"
              enterkeyhint="search"
              autocomplete="off"
              :placeholder="label(item)"
              :aria-label="label(item)"
              class="min-h-12 w-full rounded-xl bg-neutral-800 pr-4 pl-10 text-base outline-none placeholder:text-neutral-500 focus:ring-2 focus:ring-accent"
            />
          </div>
        </form>
        <p v-else-if="!item.hasitems && !isPlayable(item)" class="px-4 py-3 text-neutral-400">{{ label(item) }}</p>
        <div v-else class="flex items-center">
          <button
            type="button"
            class="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-1.5 pl-4 text-left active:bg-neutral-900"
            @click="open(item)"
          >
            <span class="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-800 text-neutral-500">
              <img v-if="item.image" :src="imageUrl(item.image, 96)" alt="" loading="lazy" class="size-full object-cover" />
              <Icon v-else :name="isPlayable(item) ? 'radio' : 'folder'" class="size-6" />
            </span>
            <span class="min-w-0 flex-1 truncate">{{ label(item) }}</span>
            <Icon v-if="!isPlayable(item)" name="back" class="size-5 shrink-0 rotate-180 text-neutral-600" />
          </button>
          <button
            v-if="isPlayable(item)"
            type="button"
            class="flex size-12 shrink-0 items-center justify-center text-neutral-400 active:text-neutral-100"
            :aria-label="`More for ${label(item)}`"
            @click="more(item)"
          >
            <Icon name="more" class="size-6" />
          </button>
          <span v-else class="w-3" />
        </div>
      </li>
    </ul>
    <p v-if="items.done.value && !items.items.value.length" class="px-4 py-10 text-center text-neutral-400">Nothing here</p>
    <LoadMore :loading="items.loading.value" :error="items.error.value" :done="items.done.value" @more="items.more" />
  </article>
</template>
