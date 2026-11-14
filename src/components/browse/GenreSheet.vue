<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { fetchGenres } from '@/lms/library'
import type { Genre } from '@/lms/types'
import BottomSheet from '../BottomSheet.vue'
import Icon from '../Icon.vue'

const props = defineProps<{ selected?: number }>()
const emit = defineEmits<{ pick: [genre: Genre | null]; close: [] }>()

const genres = ref<Genre[] | null>(null)
const error = ref(false)
const query = ref('')

const shown = computed(() => {
  const q = query.value.trim().toLocaleLowerCase()
  return (genres.value ?? []).filter((g) => !q || g.genre.toLocaleLowerCase().includes(q))
})

async function load() {
  error.value = false
  try {
    genres.value = await fetchGenres()
  } catch {
    error.value = true
  }
}

function pick(genre: Genre | null, close: () => void) {
  emit('pick', genre)
  close()
}

onMounted(load)
</script>

<template>
  <BottomSheet label="Genre" @close="emit('close')">
    <template #header>
      <div class="px-5 pt-3 pb-3">
        <h2 class="text-lg font-semibold">Genre</h2>
        <div class="relative mt-3">
          <Icon name="search" class="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-neutral-400" />
          <input
            v-model="query"
            type="search"
            aria-label="Filter genres"
            placeholder="Filter"
            class="min-h-11 w-full rounded-xl bg-neutral-800 pr-4 pl-10 text-base outline-none placeholder:text-neutral-400 focus:ring-2 focus:ring-accent"
          />
        </div>
      </div>
    </template>
    <template #default="{ close }">
      <p v-if="error" class="flex items-center justify-center gap-3 p-6 text-sm text-neutral-400">
        Couldn't load genres
        <button type="button" class="min-h-11 rounded-full bg-neutral-800 px-4 text-neutral-100" @click="load">Retry</button>
      </p>
      <p v-else-if="!genres" class="p-6 text-center text-neutral-400">Loading…</p>
      <ul v-else class="pb-4">
        <li v-if="!query">
          <button
            type="button"
            class="flex min-h-12 w-full items-center justify-between px-5 text-left active:bg-neutral-800"
            :aria-pressed="props.selected === undefined"
            @click="pick(null, close)"
          >
            All genres
            <Icon v-if="props.selected === undefined" name="check" class="size-5 text-accent" />
          </button>
        </li>
        <li v-for="g in shown" :key="g.id">
          <button
            type="button"
            class="flex min-h-12 w-full items-center justify-between px-5 text-left active:bg-neutral-800"
            :aria-pressed="props.selected === g.id"
            @click="pick(g, close)"
          >
            {{ g.genre }}
            <Icon v-if="props.selected === g.id" name="check" class="size-5 text-accent" />
          </button>
        </li>
        <li v-if="!shown.length" class="p-6 text-center text-neutral-400">No genre matches “{{ query }}”</li>
      </ul>
    </template>
  </BottomSheet>
</template>
