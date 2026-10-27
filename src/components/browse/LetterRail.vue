<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { LetterSection } from '@/lms/sections'

const props = defineProps<{ sections: LetterSection[] }>()
const emit = defineEmits<{ jump: [section: LetterSection] }>()

const rail = ref<HTMLElement | null>(null)
const active = ref<{ letter: string; y: number } | null>(null)

// The rail is fixed to the window edge, where a desktop's always-visible scrollbar would cover it
const gutter = ref(0)
let observer: ResizeObserver | undefined

onMounted(() => {
  const scroller = rail.value?.closest<HTMLElement>('[data-scroller]')
  if (!scroller) return
  const measure = () => (gutter.value = scroller.offsetWidth - scroller.clientWidth)
  observer = new ResizeObserver(measure)
  observer.observe(scroller)
  measure()
})
onBeforeUnmount(() => observer?.disconnect())

function pick(event: PointerEvent) {
  const box = rail.value?.getBoundingClientRect()
  if (!box || !props.sections.length) return
  const i = Math.min(props.sections.length - 1, Math.max(0, Math.floor(((event.clientY - box.top) / box.height) * props.sections.length)))
  const section = props.sections[i]
  const y = Math.min(box.bottom, Math.max(box.top, event.clientY))
  if (active.value?.letter !== section.letter) emit('jump', section)
  active.value = { letter: section.letter, y }
}

function onDown(event: PointerEvent) {
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  active.value = null
  pick(event)
}
function onMove(event: PointerEvent) {
  if (active.value) pick(event)
}
function onUp() {
  active.value = null
}
</script>

<template>
  <!-- Pointer shortcut only: the sticky letter headings are the accessible way through the list -->
  <div aria-hidden="true" :style="{ '--gutter': `${gutter}px` }">
    <div
      ref="rail"
      class="fixed top-1/2 right-(--gutter) z-10 flex h-[min(60dvh,28rem)] w-8 -translate-y-1/2 touch-none flex-col items-center justify-evenly select-none"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
    >
      <span
        v-for="s in sections"
        :key="s.start"
        class="text-[11px] leading-none font-semibold"
        :class="active?.letter === s.letter ? 'text-neutral-50' : 'text-accent'"
      >
        {{ s.letter }}
      </span>
    </div>
    <div
      v-if="active"
      class="pointer-events-none fixed right-[calc(var(--gutter)+3rem)] z-10 grid size-16 -translate-y-1/2 place-items-center rounded-2xl bg-neutral-800 text-3xl font-bold text-neutral-50 shadow-xl"
      :style="{ top: `${active.y}px` }"
    >
      {{ active.letter }}
    </div>
  </div>
</template>
