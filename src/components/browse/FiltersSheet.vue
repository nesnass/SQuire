<script lang="ts">
export interface AlbumFilters {
  genres: Genre[]
  period: Period | null
  compilations: boolean
}
</script>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Genre, Period } from '@/lms/types'
import BottomSheet from '../BottomSheet.vue'
import Icon from '../Icon.vue'
import GenreSheet from './GenreSheet.vue'
import YearSheet from './YearSheet.vue'

const props = defineProps<{ selected: AlbumFilters }>()
const emit = defineEmits<{ pick: [filters: AlbumFilters]; close: [] }>()

// Changed here and applied when the sheet closes, so the album list reloads once
const draft = ref<AlbumFilters>({ ...props.selected })
const picking = ref<'genre' | 'year' | null>(null)
const any = computed(() => Boolean(draft.value.genres.length || draft.value.period || draft.value.compilations))

const genreValue = computed(() => {
  const g = draft.value.genres
  return g.length > 2 ? `${g.length} genres` : g.map((x) => x.genre).join(', ') || 'All'
})
const yearValue = computed(() => {
  const p = draft.value.period
  return p ? `${p.value}${p.decade ? 's' : ''}` : 'All'
})

const key = (f: AlbumFilters) => JSON.stringify([f.genres.map((g) => g.id), f.period, f.compilations])
function finish() {
  if (key(draft.value) !== key(props.selected)) emit('pick', draft.value)
  emit('close')
}

const row = 'flex min-h-14 w-full items-center gap-3 px-5 text-left active:bg-neutral-800'
</script>

<template>
  <BottomSheet label="Filters" @close="finish">
    <template #header="{ close }">
      <div class="flex items-center justify-between gap-2 pt-3 pr-3 pb-2 pl-5">
        <h2 class="text-lg font-semibold">Filters</h2>
        <div class="flex items-center">
          <button
            v-if="any"
            type="button"
            class="min-h-11 rounded-full px-3 text-sm font-medium text-neutral-300 active:bg-neutral-800"
            @click="draft = { genres: [], period: null, compilations: false }"
          >
            Clear
          </button>
          <button
            type="button"
            class="min-h-11 rounded-full px-4 text-sm font-semibold text-accent active:bg-neutral-800"
            @click="close()"
          >
            Done
          </button>
        </div>
      </div>
    </template>
    <ul class="pb-4">
      <li>
        <button type="button" :class="row" @click="picking = 'genre'">
          <span class="flex-1 font-medium">Genre</span>
          <span class="truncate text-sm" :class="draft.genres.length ? 'text-accent' : 'text-neutral-400'">{{ genreValue }}</span>
          <Icon name="chevronRight" class="size-5 shrink-0 text-neutral-500" />
        </button>
      </li>
      <li>
        <button type="button" :class="row" @click="picking = 'year'">
          <span class="flex-1 font-medium">Year</span>
          <span class="text-sm tabular-nums" :class="draft.period ? 'text-accent' : 'text-neutral-400'">{{ yearValue }}</span>
          <Icon name="chevronRight" class="size-5 shrink-0 text-neutral-500" />
        </button>
      </li>
      <li>
        <button
          type="button"
          role="switch"
          :aria-checked="draft.compilations"
          :class="row"
          @click="draft = { ...draft, compilations: !draft.compilations }"
        >
          <span class="flex-1">
            <span class="block font-medium">Compilations only</span>
            <span class="block text-sm text-neutral-400">Albums by various artists</span>
          </span>
          <span
            class="relative h-7 w-12 shrink-0 rounded-full transition-colors"
            :class="draft.compilations ? 'bg-accent' : 'bg-neutral-700'"
            aria-hidden="true"
          >
            <span
              class="absolute top-1 left-1 size-5 rounded-full bg-neutral-50 transition-transform motion-reduce:transition-none"
              :class="draft.compilations ? 'translate-x-5' : ''"
            />
          </span>
        </button>
      </li>
    </ul>

    <GenreSheet
      v-if="picking === 'genre'"
      :selected="draft.genres"
      @pick="draft = { ...draft, genres: $event }"
      @close="picking = null"
    />
    <YearSheet
      v-if="picking === 'year'"
      :selected="draft.period"
      @pick="draft = { ...draft, period: $event }"
      @close="picking = null"
    />
  </BottomSheet>
</template>
