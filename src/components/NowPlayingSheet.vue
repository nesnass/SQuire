<script setup lang="ts">
import type { Route } from './browse/nav'
import BottomSheet from './BottomSheet.vue'
import NowPlayingBody from './NowPlayingBody.vue'

const emit = defineEmits<{ close: []; queue: []; outputs: [roomId: string]; go: [route: Route] }>()
</script>

<template>
  <BottomSheet full label="Now playing" @close="emit('close')">
    <template #default="{ close }">
      <NowPlayingBody
        closable
        @close="close"
        @queue="emit('queue')"
        @outputs="emit('outputs', $event)"
        @go="emit('go', $event)"
      />
    </template>
  </BottomSheet>
</template>
