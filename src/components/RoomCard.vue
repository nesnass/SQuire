<script setup lang="ts">
import { computed } from 'vue'
import usePlayerStore, { type Room } from '@/store/usePlayerStore'
import { artworkUrl } from '@/lms/format'
import Icon from './Icon.vue'
import { actionSheet, showToast } from './overlays'
import PlayingBars from './PlayingBars.vue'
import RoomVolume from './RoomVolume.vue'

const props = defineProps<{ room: Room }>()
const emit = defineEmits<{ group: [roomId: string] }>()
const { getters, actions } = usePlayerStore()

const isActive = computed(() => props.room.members.some((m) => m.id === getters.activeId.value))
const online = computed(() => props.room.members.some((m) => m.connected))
const art = computed(() => artworkUrl(props.room.track, 160))

function openMenu() {
  const solo = props.room.members.length === 1
  actionSheet.value = {
    title: props.room.label,
    subtitle: 'Disabled rooms are hidden and never played to',
    actions: props.room.members.map((m) => ({
      label: solo ? 'Disable room' : `Disable ${m.name}`,
      icon: 'block',
      run: () =>
        void actions
          .setDisabled(m.id, true)
          .then(() => showToast(`${m.name} disabled`))
          .catch(() => showToast("Couldn't reach the server")),
    })),
  }
}
</script>

<template>
  <article
    class="rounded-3xl p-4 transition-colors"
    :class="isActive ? 'bg-neutral-800 ring-2 ring-accent/60' : 'bg-neutral-900'"
    :aria-label="props.room.label"
  >
    <header class="flex items-start justify-between gap-2">
      <h2 class="min-w-0 pt-2 font-semibold leading-snug">
        <span v-for="m in props.room.members" :key="m.id" class="block truncate">{{ m.name }}</span>
      </h2>
      <span class="flex items-center gap-1">
        <span v-if="isActive" class="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">Selected</span>
        <button
          type="button"
          class="grid size-11 place-items-center rounded-full text-neutral-300 active:bg-neutral-700 disabled:opacity-40"
          :aria-label="`Group ${props.room.label} with other rooms`"
          :disabled="!online"
          @click="emit('group', props.room.id)"
        >
          <Icon name="link" class="size-6" />
        </button>
        <button
          type="button"
          class="grid size-11 place-items-center rounded-full text-neutral-300 active:bg-neutral-700"
          :aria-label="`More options for ${props.room.label}`"
          @click="openMenu"
        >
          <Icon name="more" class="size-6" />
        </button>
      </span>
    </header>

    <div class="mt-2 flex items-center gap-3">
      <button
        type="button"
        class="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left disabled:opacity-50"
        :disabled="!online"
        :aria-pressed="isActive"
        @click="actions.selectPlayer(props.room.members.find((m) => m.connected)?.id ?? props.room.id)"
      >
        <img v-if="art" :src="art" alt="" class="size-14 shrink-0 rounded-lg bg-neutral-700 object-cover" />
        <span v-else class="size-14 shrink-0 rounded-lg bg-neutral-700" />
        <span class="min-w-0">
          <span class="flex items-center gap-2">
            <PlayingBars v-if="props.room.isPlaying" />
            <span class="truncate font-medium">{{ online ? (props.room.track?.title ?? 'Nothing queued') : 'Offline' }}</span>
          </span>
          <span class="block truncate text-sm text-neutral-400">{{ online ? props.room.track?.artist : '' }}</span>
        </span>
      </button>
      <button
        v-if="online && props.room.track"
        type="button"
        class="grid size-11 shrink-0 place-items-center rounded-full bg-white/10 active:bg-white/20"
        :aria-label="`${props.room.isPlaying ? 'Pause' : 'Play'} ${props.room.label}`"
        @click="actions.togglePlay(props.room.id)"
      >
        <Icon :name="props.room.isPlaying ? 'pause' : 'play'" class="size-6" />
      </button>
    </div>

    <RoomVolume v-if="online" :room="props.room" class="mt-2" />
  </article>
</template>
