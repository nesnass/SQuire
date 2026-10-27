<script setup lang="ts">
import { host, openHostSettings } from '@/native/lyrplay'
import usePlayerStore from '@/store/usePlayerStore'
import Icon from './Icon.vue'
import RoomCard from './RoomCard.vue'

const emit = defineEmits<{ group: [roomId: string] }>()
const { getters, actions } = usePlayerStore()
</script>

<template>
  <section class="px-4 pb-4" aria-labelledby="rooms-title">
    <header class="flex items-center justify-between py-4">
      <h1 id="rooms-title" class="text-3xl font-bold">Rooms</h1>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="min-h-11 rounded-full bg-neutral-800 px-4 text-sm font-medium active:bg-neutral-700"
          @click="getters.anyPlaying.value ? actions.pauseAll() : actions.playAll()"
        >
          {{ getters.anyPlaying.value ? 'Pause all' : 'Play all' }}
        </button>
        <!-- Embedded in an app, this is the only way back to the app's own settings -->
        <button
          v-if="host.settings"
          type="button"
          class="grid size-11 place-items-center rounded-full bg-neutral-800 active:bg-neutral-700"
          :aria-label="host.settings.name"
          @click="openHostSettings"
        >
          <Icon name="settings" class="size-6" />
        </button>
      </div>
    </header>
    <ul class="grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
      <li v-for="room in getters.rooms.value" :key="room.id">
        <RoomCard :room="room" @group="emit('group', $event)" />
      </li>
    </ul>
  </section>
</template>
