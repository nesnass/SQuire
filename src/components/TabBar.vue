<script setup lang="ts">
import Icon, { type IconName } from './Icon.vue'

export type Tab = 'home' | 'browse' | 'search' | 'rooms'

const tabs: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'browse', label: 'Library', icon: 'browse' },
  { id: 'search', label: 'Search', icon: 'search' },
  { id: 'rooms', label: 'Rooms', icon: 'speaker' },
]

const model = defineModel<Tab>({ required: true })
// Tapping the current tab again returns it to its top level
const emit = defineEmits<{ reselect: [tab: Tab] }>()
</script>

<template>
  <nav aria-label="Sections">
    <ul class="flex">
      <li v-for="t in tabs" :key="t.id" class="flex-1">
        <button
          type="button"
          class="flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-xs"
          :class="model === t.id ? 'text-accent' : 'text-neutral-500'"
          :aria-current="model === t.id ? 'page' : undefined"
          @click="model === t.id ? emit('reselect', t.id) : (model = t.id)"
        >
          <Icon :name="t.icon" class="size-6" />
          {{ t.label }}
        </button>
      </li>
    </ul>
  </nav>
</template>
