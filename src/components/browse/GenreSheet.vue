<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { fetchGenres } from '@/lms/library'
import type { Genre } from '@/lms/types'
import BottomSheet from '../BottomSheet.vue'
import Icon from '../Icon.vue'

const props = defineProps<{ selected: Genre[] }>()
const emit = defineEmits<{ pick: [genres: Genre[]]; close: [] }>()

// Ticked here and applied when the sheet closes, so the album list doesn't reload on every tap
const chosen = ref<Genre[]>([...props.selected])
const isChosen = (g: Genre) => chosen.value.some((c) => c.id === g.id)
function toggle(g: Genre) {
  chosen.value = isChosen(g) ? chosen.value.filter((c) => c.id !== g.id) : [...chosen.value, g]
}

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

function finish() {
  const before = props.selected.map((g) => g.id).join()
  if (chosen.value.map((g) => g.id).join() !== before) emit('pick', chosen.value)
  emit('close')
}

onMounted(load)
</script>

<template>
  <BottomSheet label="Genre" @close="finish">
    <template #header="{ close }">
      <div class="px-5 pt-3 pb-3">
        <div class="flex items-center justify-between gap-2">
          <h2 class="text-lg font-semibold">Genres</h2>
          <div class="flex items-center">
            <button
              v-if="chosen.length"
              type="button"
              class="min-h-11 rounded-full px-3 text-sm font-medium text-neutral-300 active:bg-neutral-800"
              @click="chosen = []"
            >
              Clear
            </button>
            <button
              type="button"
              class="min-h-11 rounded-full px-4 text-sm font-semibold text-accent active:bg-neutral-800"
              @click="close()"
            >
              Done<template v-if="chosen.length"> ({{ chosen.length }})</template>
            </button>
          </div>
        </div>
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
    <template #default>
      <p v-if="error" class="flex items-center justify-center gap-3 p-6 text-sm text-neutral-400">
        Couldn't load genres
        <button type="button" class="min-h-11 rounded-full bg-neutral-800 px-4 text-neutral-100" @click="load">Retry</button>
      </p>
      <p v-else-if="!genres" class="p-6 text-center text-neutral-400">Loading…</p>
      <ul v-else class="pb-4">
        <li v-for="g in shown" :key="g.id">
          <button
            type="button"
            class="flex min-h-12 w-full items-center justify-between px-5 text-left active:bg-neutral-800"
            role="checkbox"
            :aria-checked="isChosen(g)"
            @click="toggle(g)"
          >
            {{ g.genre }}
            <Icon v-if="isChosen(g)" name="check" class="size-5 text-accent" />
          </button>
        </li>
        <li v-if="!shown.length" class="p-6 text-center text-neutral-400">No genre matches “{{ query }}”</li>
      </ul>
    </template>
  </BottomSheet>
</template>
