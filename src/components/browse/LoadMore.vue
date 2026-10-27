<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{ loading: boolean; error: string | null; done: boolean }>()
const emit = defineEmits<{ more: [] }>()

const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | undefined

onMounted(() => {
  // Starts the next page well before the end so scrolling rarely waits
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting) && !props.error) emit('more')
    },
    // Root must be the scroller: a viewport margin can't see past the scroller's clipping
    { root: sentinel.value?.closest('[data-scroller]'), rootMargin: '800px 0px' },
  )
  if (sentinel.value) observer.observe(sentinel.value)
})
onBeforeUnmount(() => observer?.disconnect())

// The observer only reports changes; re-observing re-checks a sentinel that stayed on screen after a page loaded
watch(
  () => props.loading,
  (loading) => {
    if (loading || props.done || !observer || !sentinel.value) return
    observer.unobserve(sentinel.value)
    observer.observe(sentinel.value)
  },
)
</script>

<template>
  <div ref="sentinel" class="flex min-h-16 items-center justify-center py-4 text-sm text-neutral-400">
    <p v-if="props.error" class="flex items-center gap-3">
      Couldn't load more
      <button type="button" class="min-h-11 rounded-full bg-neutral-800 px-4 text-neutral-100" @click="emit('more')">
        Retry
      </button>
    </p>
    <p v-else-if="props.loading">Loading…</p>
  </div>
</template>
