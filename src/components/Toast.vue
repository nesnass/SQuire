<script setup lang="ts">
import { toastMessage } from './overlays'
</script>

<template>
  <div role="status" aria-live="polite" class="pointer-events-none flex justify-center px-4">
    <Transition
      enter-from-class="translate-y-2 opacity-0"
      leave-to-class="opacity-0"
      enter-active-class="transition duration-200 motion-reduce:duration-0"
      leave-active-class="transition duration-200 motion-reduce:duration-0"
    >
      <p v-if="toastMessage" class="mb-2 rounded-full bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 shadow-lg">
        {{ toastMessage }}
      </p>
    </Transition>
  </div>
</template>
