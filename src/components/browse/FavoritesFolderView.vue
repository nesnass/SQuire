<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { fetchFavorites } from '@/lms/library'
import BackHeader from './BackHeader.vue'
import FavoriteRow from './FavoriteRow.vue'
import LoadMore from './LoadMore.vue'
import { usePaged } from './usePaged'

const props = defineProps<{ id: string; name: string }>()
const heading = ref<HTMLElement | null>(null)
const items = usePaged((start, n) => fetchFavorites(start, n, props.id))

onMounted(() => {
  items.reset()
  heading.value?.focus()
})
</script>

<template>
  <article class="pb-6">
    <BackHeader :title="props.name" />
    <h1 ref="heading" tabindex="-1" class="px-4 pt-2 pb-3 text-3xl font-bold outline-none">{{ props.name }}</h1>
    <ul>
      <li v-for="f in items.items.value" :key="f.id"><FavoriteRow :favorite="f" nested /></li>
    </ul>
    <LoadMore :loading="items.loading.value" :error="items.error.value" :done="items.done.value" @more="items.more" />
  </article>
</template>
