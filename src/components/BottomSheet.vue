<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { isTopSheet, popSheet, pushSheet } from './sheetStack'

const props = defineProps<{ label: string; full?: boolean }>()
const emit = defineEmits<{ close: [] }>()

const DISMISS_PX = 100

const shown = ref(false)
const panel = ref<HTMLElement | null>(null)
const dragY = ref(0)
const dragging = ref(false)
let dragStart = 0
let opener: HTMLElement | null = null
const id = pushSheet()

function close() {
  shown.value = false
}

// Content such as a text field may have focused itself already; keep that rather than the panel
function onEntered() {
  if (!panel.value?.contains(document.activeElement)) panel.value?.focus()
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && isTopSheet(id)) close()
}

function onPointerDown(event: PointerEvent) {
  // Capturing the pointer sends the click to the handle instead of a button in the header, so buttons don't start drags
  if ((event.target as Element).closest('button, a, input')) return
  dragStart = event.clientY
  dragging.value = true
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}
function onPointerMove(event: PointerEvent) {
  if (dragging.value) dragY.value = Math.max(0, event.clientY - dragStart)
}
function onPointerUp() {
  if (dragY.value > DISMISS_PX) close()
  else dragY.value = 0
  dragging.value = false
}

onMounted(() => {
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
  shown.value = true
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  popSheet(id)
  document.removeEventListener('keydown', onKey)
  // A sheet opened from this one may already hold focus; only reclaim it if focus was dropped
  if (!document.activeElement || document.activeElement === document.body) opener?.focus()
})
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-40 flex flex-col justify-end">
      <Transition
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
        enter-active-class="transition-opacity duration-300"
        leave-active-class="transition-opacity duration-200"
      >
        <div v-if="shown && !props.full" class="absolute inset-0 bg-black/60" aria-hidden="true" @click="close" />
      </Transition>
      <Transition
        enter-from-class="translate-y-full"
        leave-to-class="translate-y-full"
        enter-active-class="transition-transform duration-300 ease-out motion-reduce:duration-0"
        leave-active-class="transition-transform duration-200 ease-in motion-reduce:duration-0"
        @after-enter="onEntered"
        @after-leave="emit('close')"
      >
        <section
          v-if="shown"
          ref="panel"
          role="dialog"
          aria-modal="true"
          :aria-label="props.label"
          tabindex="-1"
          class="relative flex flex-col bg-neutral-900 outline-none"
          :class="[
            props.full ? 'h-full' : 'max-h-[85dvh] rounded-t-3xl pb-[env(safe-area-inset-bottom)]',
            dragging ? '' : 'transition-transform duration-200',
          ]"
          :style="dragY ? { transform: `translateY(${dragY}px)` } : undefined"
        >
          <div
            class="shrink-0 touch-none select-none"
            :class="props.full ? 'pt-[var(--top-pad,env(safe-area-inset-top))]' : ''"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
          >
            <div class="mx-auto mt-2 h-1 w-10 rounded-full bg-neutral-600" aria-hidden="true" />
            <slot name="header" :close="close" />
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto">
            <slot :close="close" />
          </div>
        </section>
      </Transition>
    </div>
  </Teleport>
</template>
