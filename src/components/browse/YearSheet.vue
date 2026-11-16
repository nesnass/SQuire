<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { fetchYears } from '@/lms/library'
import type { Period } from '@/lms/types'
import BottomSheet from '../BottomSheet.vue'

const props = defineProps<{ selected: Period | null }>()
const emit = defineEmits<{ pick: [period: Period | null]; close: [] }>()

function isSelected(decade: boolean, value: number) {
  return props.selected?.decade === decade && props.selected.value === value
}

const years = ref<number[] | null>(null)
const error = ref(false)

// Newest decade first, each decade's years newest first
const decades = computed(() => {
  const groups = new Map<number, number[]>()
  for (const y of [...(years.value ?? [])].sort((a, b) => b - a)) {
    const decade = Math.floor(y / 10) * 10
    groups.set(decade, [...(groups.get(decade) ?? []), y])
  }
  return [...groups].map(([decade, list]) => ({ decade, years: list }))
})

async function load() {
  error.value = false
  try {
    years.value = await fetchYears()
  } catch {
    error.value = true
  }
}

// Picking the selected year or decade again clears it, as unticking a genre does
function pick(period: Period | null, close: () => void) {
  emit('pick', period && isSelected(period.decade, period.value) ? null : period)
  close()
}

onMounted(load)
</script>

<template>
  <BottomSheet label="Year" @close="emit('close')">
    <template #header>
      <div class="flex items-center justify-between pt-3 pr-3 pb-2 pl-5">
        <h2 class="text-lg font-semibold">Year</h2>
      </div>
    </template>
    <template #default="{ close }">
      <p v-if="error" class="flex items-center justify-center gap-3 p-6 text-sm text-neutral-400">
        Couldn't load years
        <button type="button" class="min-h-11 rounded-full bg-neutral-800 px-4 text-neutral-100" @click="load">Retry</button>
      </p>
      <p v-else-if="!years" class="p-6 text-center text-neutral-400">Loading…</p>
      <div v-else class="px-5 pb-5">
        <button
          type="button"
          class="min-h-11 rounded-full border px-4 text-sm font-medium"
          :class="!props.selected ? 'border-accent text-accent' : 'border-neutral-700 text-neutral-300'"
          :aria-pressed="!props.selected"
          @click="pick(null, close)"
        >
          All years
        </button>
        <section v-for="d in decades" :key="d.decade" :aria-labelledby="`decade-${d.decade}`" class="pt-4">
          <div class="flex items-center justify-between pb-2">
            <h3 :id="`decade-${d.decade}`" class="text-sm font-semibold text-neutral-400">{{ d.decade }}s</h3>
            <button
              v-if="d.years.length > 1"
              type="button"
              class="min-h-11 rounded-full border px-4 text-sm font-medium"
              :class="isSelected(true, d.decade) ? 'border-accent text-accent' : 'border-neutral-700 text-neutral-300'"
              :aria-pressed="isSelected(true, d.decade)"
              :aria-label="`All of the ${d.decade}s`"
              @click="pick({ decade: true, value: d.decade }, close)"
            >
              All {{ d.decade }}s
            </button>
          </div>
          <ul class="grid grid-cols-4 gap-2 sm:grid-cols-5">
            <li v-for="y in d.years" :key="y">
              <button
                type="button"
                class="min-h-11 w-full rounded-xl text-sm font-medium tabular-nums"
                :class="isSelected(false, y) ? 'bg-accent text-neutral-950' : 'bg-neutral-800 active:bg-neutral-700'"
                :aria-pressed="isSelected(false, y)"
                @click="pick({ decade: false, value: y }, close)"
              >
                {{ y }}
              </button>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </BottomSheet>
</template>
