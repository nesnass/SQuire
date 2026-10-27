<script setup lang="ts">
import { computed } from 'vue'
import { favoriteKind, imageUrl, type FavoriteKind } from '@/lms/format'
import type { Favorite } from '@/lms/types'
import Icon, { type IconName } from '../Icon.vue'
import { useNav } from './nav'
import { usePlayActions } from './playActions'

// Items inside a favourites folder are already favourites, so they get no ♥ toggle
const props = defineProps<{ favorite: Favorite; nested?: boolean }>()
const nav = useNav()
const { play, openActions } = usePlayActions()

const KINDS: Record<FavoriteKind, { label: string; icon: IconName }> = {
  folder: { label: 'Folder', icon: 'folder' },
  album: { label: 'Album', icon: 'album' },
  artist: { label: 'Artist', icon: 'person' },
  playlist: { label: 'Playlist', icon: 'queue' },
  radio: { label: 'Radio', icon: 'radio' },
  track: { label: 'Song', icon: 'play' },
  other: { label: '', icon: 'heart' },
}

const kind = computed(() => KINDS[favoriteKind(props.favorite)])
const art = computed(() => imageUrl(props.favorite.image, 96))
const target = computed(() => ({ menu: 'favorites', item_id: props.favorite.id }))

function open() {
  if (props.favorite.hasitems) nav.push({ kind: 'favorites', id: props.favorite.id, name: props.favorite.name })
  else void play('load', target.value)
}

function more() {
  const { url, name } = props.favorite
  openActions(
    target.value,
    { title: name, subtitle: kind.value.label, art: art.value },
    { favorite: url && !props.nested ? { url, title: name } : undefined },
  )
}
</script>

<template>
  <div class="flex items-center">
    <button
      type="button"
      class="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-1.5 pl-4 text-left active:bg-neutral-900"
      @click="open"
    >
      <span class="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-800 text-neutral-500">
        <img v-if="art" :src="art" alt="" loading="lazy" class="size-full object-cover" />
        <Icon v-else :name="kind.icon" class="size-6" />
      </span>
      <span class="min-w-0 flex-1">
        <span class="block truncate">{{ props.favorite.name }}</span>
        <span v-if="kind.label" class="block truncate text-sm text-neutral-400">{{ kind.label }}</span>
      </span>
    </button>
    <button
      v-if="!props.favorite.hasitems"
      type="button"
      class="flex size-12 shrink-0 items-center justify-center text-neutral-400 active:text-neutral-100"
      :aria-label="`More for ${props.favorite.name}`"
      @click="more"
    >
      <Icon name="more" class="size-6" />
    </button>
  </div>
</template>
