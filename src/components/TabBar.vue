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
    <ul class="flex xl:flex-col xl:gap-1">
      <li v-for="t in tabs" :key="t.id" class="flex-1 xl:flex-none">
        <button
          type="button"
          class="flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-xs xl:min-h-11 xl:flex-row xl:justify-start xl:gap-3 xl:rounded-xl xl:px-3 xl:text-base xl:font-medium"
          :class="model === t.id ? 'text-accent xl:bg-neutral-900' : 'text-neutral-400 xl:hover:bg-neutral-900'"
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
