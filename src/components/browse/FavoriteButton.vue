<script setup lang="ts">
import { computed } from 'vue'
import useFavoritesStore, { type FavoriteInput } from '@/store/useFavoritesStore'
import Icon from '../Icon.vue'
import { usePlayActions } from './playActions'

const props = defineProps<{ favorite: FavoriteInput | undefined }>()
const { getters } = useFavoritesStore()
const { toggleFavorite } = usePlayActions()

const active = computed(() => getters.isFavorite(props.favorite?.url))
</script>

<template>
  <button
    type="button"
    class="flex size-12 shrink-0 items-center justify-center rounded-full bg-neutral-800 active:bg-neutral-700 disabled:opacity-40"
    :class="active ? 'text-accent' : ''"
    aria-label="Favourite"
    :aria-pressed="active"
    :disabled="!props.favorite"
    @click="props.favorite && toggleFavorite(props.favorite)"
  >
    <Icon :name="active ? 'heart' : 'heartOutline'" class="size-6" />
  </button>
</template>
