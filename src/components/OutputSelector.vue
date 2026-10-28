<script setup lang="ts">
import { computed, ref } from 'vue'
import usePlayerStore from '@/store/usePlayerStore'
import { artworkUrl } from '@/lms/format'
import BottomSheet from './BottomSheet.vue'
import PlayingBars from './PlayingBars.vue'

const props = defineProps<{ roomId: string }>()
const emit = defineEmits<{ close: [] }>()
const { getters, actions } = usePlayerStore()

const room = computed(() => getters.rooms.value.find((r) => r.id === props.roomId))
const selected = ref<string[]>(room.value?.members.map((m) => m.id) ?? [])
const busy = ref(false)

function isPlaying(playerId: string): boolean {
  return getters.rooms.value.some((r) => r.isPlaying && r.members.some((m) => m.id === playerId))
}

async function done(close: () => void) {
  busy.value = true
  try {
    await actions.applyOutputs(props.roomId, selected.value)
  } finally {
    busy.value = false
    close()
  }
}
</script>

<template>
  <BottomSheet label="Choose where to play" @close="emit('close')">
    <template #header>
      <div class="flex items-center gap-3 border-b border-neutral-800 px-5 pt-3 pb-4">
        <img
          v-if="artworkUrl(room?.track, 120)"
          :src="artworkUrl(room?.track, 120)"
          alt=""
          class="size-12 rounded-lg bg-neutral-700 object-cover"
        />
        <div class="min-w-0">
          <h2 class="truncate font-semibold">{{ room?.track?.title ?? 'Choose rooms' }}</h2>
          <p class="truncate text-sm text-neutral-400">{{ room?.track?.artist }}</p>
        </div>
      </div>
    </template>
    <template #default="{ close }">
      <fieldset class="px-2 py-2">
        <legend class="sr-only">Rooms to play on</legend>
        <label
          v-for="p in getters.enabledPlayers.value"
          :key="p.playerid"
          class="flex min-h-14 items-center gap-3 rounded-xl px-3 active:bg-neutral-800"
          :class="{ 'opacity-40': !p.connected }"
        >
          <span class="min-w-0 flex-1 truncate">{{ p.name }}</span>
          <PlayingBars v-if="isPlaying(p.playerid)" />
          <span v-if="!p.connected" class="text-xs text-neutral-400">Offline</span>
          <input v-model="selected" type="checkbox" :value="p.playerid" :disabled="!p.connected" class="size-6 accent-accent" />
        </label>
      </fieldset>
      <div class="sticky bottom-0 bg-neutral-900 px-5 pt-2 pb-4">
        <button
          type="button"
          class="min-h-12 w-full rounded-full bg-accent font-semibold text-neutral-950 disabled:opacity-40"
          :disabled="!selected.length || busy"
          @click="done(close)"
        >
          {{ busy ? 'Applying…' : 'Done' }}
        </button>
      </div>
    </template>
  </BottomSheet>
</template>
