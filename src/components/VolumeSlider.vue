<script setup lang="ts">
import { computed, ref } from 'vue'
import Icon from './Icon.vue'

const props = defineProps<{ value: number; label: string; disabled?: boolean }>()
const emit = defineEmits<{ set: [value: number]; end: [] }>()

// Commands are throttled while dragging so LMS isn't flooded, with a trailing send so the final value lands
const THROTTLE_MS = 150

// Holds the dragged value so polling doesn't yank the thumb mid-drag
const local = ref<number | null>(null)
const shown = computed(() => local.value ?? props.value)
let lastSent = 0
let trailing: ReturnType<typeof setTimeout> | undefined

function emitNow(value: number) {
  lastSent = performance.now()
  emit('set', value)
}

function onInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  local.value = value
  clearTimeout(trailing)
  const wait = THROTTLE_MS - (performance.now() - lastSent)
  if (wait <= 0) emitNow(value)
  else trailing = setTimeout(() => emitNow(value), wait)
}

function onChange(event: Event) {
  clearTimeout(trailing)
  emitNow(Number((event.target as HTMLInputElement).value))
  emit('end')
  local.value = null
}
</script>

<template>
  <label class="flex items-center gap-3" :class="{ 'opacity-40': props.disabled }">
    <Icon name="volume" class="size-5 shrink-0 text-neutral-400" />
    <span class="sr-only">{{ props.label }}</span>
    <input
      type="range"
      class="h-11 min-w-0 flex-1 accent-accent"
      min="0"
      max="100"
      :value="shown"
      :disabled="props.disabled"
      @input="onInput"
      @change="onChange"
    />
    <span class="w-7 text-right text-sm tabular-nums text-neutral-400" aria-hidden="true">{{ shown }}</span>
  </label>
</template>
