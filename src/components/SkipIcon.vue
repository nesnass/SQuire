<script setup lang="ts">
// Material "replay" arrow (Apache-2.0) with the jump length drawn inside; mirrored for forward
const REPLAY = 'M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z'

defineProps<{ seconds: number; forward?: boolean }>()
</script>

<template>
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path :d="REPLAY" :transform="forward ? 'matrix(-1 0 0 1 24 0)' : undefined" />
    <text x="12" y="15.2" text-anchor="middle" font-size="6" font-weight="700">{{ seconds }}</text>
  </svg>
</template>
