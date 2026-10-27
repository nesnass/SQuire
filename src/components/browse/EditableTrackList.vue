<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue'
import { coverUrl } from '@/lms/format'
import type { LibraryTrack } from '@/lms/types'
import Icon from '../Icon.vue'

const props = defineProps<{ tracks: LibraryTrack[] }>()
const emit = defineEmits<{ remove: [index: number]; move: [from: number, to: number] }>()

const EDGE_PX = 72
const MAX_SCROLL_STEP = 14

const list = ref<HTMLOListElement | null>(null)
const announcement = ref('')
const dragFrom = ref<number | null>(null)
const dragTo = ref(0)
const offset = ref(0)
const rowHeight = ref(0)

let startY = 0
let pointerY = 0
let startScroll = 0
let scroller: HTMLElement | null = null
let frame = 0

function clamp(n: number) {
  return Math.min(props.tracks.length - 1, Math.max(0, n))
}

function update() {
  offset.value = pointerY - startY + (scroller ? scroller.scrollTop - startScroll : 0)
  dragTo.value = clamp((dragFrom.value ?? 0) + Math.round(offset.value / rowHeight.value))
}

// Scrolls while the finger rests near the top or bottom edge, faster the closer it is
function tick() {
  if (scroller) {
    const box = scroller.getBoundingClientRect()
    const fromTop = pointerY - box.top
    const fromBottom = box.bottom - pointerY
    if (fromTop < EDGE_PX) scroller.scrollTop -= MAX_SCROLL_STEP * (1 - Math.max(0, fromTop) / EDGE_PX)
    else if (fromBottom < EDGE_PX) scroller.scrollTop += MAX_SCROLL_STEP * (1 - Math.max(0, fromBottom) / EDGE_PX)
  }
  update()
  frame = requestAnimationFrame(tick)
}

function onPointerDown(event: PointerEvent, index: number) {
  const handle = event.currentTarget as HTMLElement
  handle.setPointerCapture(event.pointerId)
  rowHeight.value = handle.closest('li')?.getBoundingClientRect().height ?? 56
  scroller = handle.closest('[data-scroller]')
  startScroll = scroller?.scrollTop ?? 0
  startY = pointerY = event.clientY
  dragFrom.value = index
  dragTo.value = index
  offset.value = 0
  frame = requestAnimationFrame(tick)
}

function onPointerMove(event: PointerEvent) {
  if (dragFrom.value !== null) pointerY = event.clientY
}

function finishDrag(event: PointerEvent) {
  cancelAnimationFrame(frame)
  if (dragFrom.value === null) return
  // The target is otherwise only recomputed once per frame, so the final movement would be lost
  pointerY = event.clientY
  update()
  const from = dragFrom.value
  const to = dragTo.value
  dragFrom.value = null
  offset.value = 0
  if (from !== to) move(from, to)
}

function move(from: number, to: number) {
  const title = props.tracks[from].title
  emit('move', from, to)
  announcement.value = `Moved ${title} to position ${to + 1}`
}

async function onKey(event: KeyboardEvent, index: number) {
  const to = event.key === 'ArrowUp' ? index - 1 : event.key === 'ArrowDown' ? index + 1 : null
  if (to === null || to < 0 || to >= props.tracks.length) return
  event.preventDefault()
  const id = props.tracks[index].id
  move(index, to)
  // Keeps focus on the moved song's handle so repeated presses keep moving it
  await nextTick()
  list.value?.querySelector<HTMLElement>(`[data-handle="${id}"]`)?.focus()
}

// Rows between the dragged row's start and target shift by one row to open a gap
function shift(index: number): number {
  const from = dragFrom.value
  if (from === null) return 0
  if (index === from) return offset.value
  if (from < dragTo.value && index > from && index <= dragTo.value) return -rowHeight.value
  if (from > dragTo.value && index < from && index >= dragTo.value) return rowHeight.value
  return 0
}

onBeforeUnmount(() => cancelAnimationFrame(frame))
</script>

<template>
  <div>
    <p id="reorder-hint" class="sr-only">Drag to reorder, or press the up and down arrow keys.</p>
    <p class="sr-only" aria-live="polite">{{ announcement }}</p>
    <ol ref="list">
      <li
        v-for="(t, i) in props.tracks"
        :key="t.id"
        class="relative flex items-center bg-neutral-950"
        :class="[
          dragFrom === i ? 'z-10 bg-neutral-800 shadow-xl' : '',
          dragFrom !== null && dragFrom !== i ? 'transition-transform duration-150' : '',
        ]"
        :style="shift(i) ? { transform: `translateY(${shift(i)}px)` } : undefined"
      >
        <button
          type="button"
          class="flex size-12 shrink-0 items-center justify-center text-red-400"
          :aria-label="`Remove ${t.title}`"
          @click="emit('remove', i)"
        >
          <span class="flex size-6 items-center justify-center rounded-full bg-red-500 text-white" aria-hidden="true">
            <span class="h-0.5 w-3 rounded bg-white" />
          </span>
        </button>
        <img
          :src="coverUrl(t.artwork_track_id, 96)"
          alt=""
          loading="lazy"
          class="size-11 shrink-0 rounded bg-neutral-800 object-cover"
        />
        <span class="min-w-0 flex-1 px-3 py-1.5">
          <span class="block truncate">{{ t.title }}</span>
          <span class="block truncate text-sm text-neutral-400">{{ t.artist }}</span>
        </span>
        <button
          type="button"
          class="flex size-12 shrink-0 cursor-grab touch-none items-center justify-center text-neutral-500 active:cursor-grabbing"
          :data-handle="t.id"
          :aria-label="`Reorder ${t.title}, position ${i + 1} of ${props.tracks.length}`"
          aria-describedby="reorder-hint"
          @pointerdown="onPointerDown($event, i)"
          @pointermove="onPointerMove"
          @pointerup="finishDrag"
          @pointercancel="finishDrag"
          @keydown="onKey($event, i)"
        >
          <Icon name="dragHandle" class="size-6" />
        </button>
      </li>
    </ol>
  </div>
</template>
