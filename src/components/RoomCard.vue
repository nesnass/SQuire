<script setup lang="ts">
import { computed } from 'vue'
import usePlayerStore, { type Room } from '@/store/usePlayerStore'
import { artworkUrl } from '@/lms/format'
import Icon from './Icon.vue'
import { actionSheet, showToast, type SheetAction } from './overlays'
import PlayingBars from './PlayingBars.vue'
import RoomVolume from './RoomVolume.vue'

const props = defineProps<{ room: Room }>()
const emit = defineEmits<{ group: [roomId: string] }>()
const { getters, actions } = usePlayerStore()

const isActive = computed(() => props.room.members.some((m) => m.id === getters.activeId.value))
const online = computed(() => props.room.members.some((m) => m.connected))
const art = computed(() => artworkUrl(props.room.track, 160))

function select() {
  if (online.value) actions.selectPlayer(props.room.members.find((m) => m.connected)?.id ?? props.room.id)
}

// Anywhere on the card that isn't a control selects. The art-and-title button stays the target for keyboards
// and screen readers; this only widens it for pointers.
function onCardClick(event: MouseEvent) {
  if (!(event.target as Element).closest('button, input, a, label')) select()
}

const SLEEP_MINUTES = [15, 30, 45, 60, 90]

const sleepMinutes = computed(() => (props.room.sleepIn ? Math.max(1, Math.round(props.room.sleepIn / 60)) : null))

function report(done: Promise<unknown>, success: string) {
  done.then(() => showToast(success)).catch(() => showToast("Couldn't reach the server"))
}

function setSleep(seconds: number, success: string) {
  report(actions.setSleep(props.room.id, seconds), success)
}

function openSleep() {
  const status = props.room.status
  // A live stream has no end to wait for
  const left = status?.duration ? status.duration - (status.time ?? 0) : 0
  const options: SheetAction[] = SLEEP_MINUTES.map((m) => ({
    label: `${m} minutes`,
    icon: 'sleep',
    run: () => setSleep(m * 60, `${props.room.label} sleeps in ${m} min`),
  }))
  if (left > 0) options.push({ label: 'End of track', icon: 'sleep', run: () => setSleep(left, `${props.room.label} sleeps after this track`) })
  if (props.room.sleepIn) options.push({ label: 'Turn off timer', icon: 'close', run: () => setSleep(0, 'Sleep timer off') })
  actionSheet.value = {
    title: 'Sleep timer',
    subtitle: sleepMinutes.value ? `${props.room.label} sleeps in ${sleepMinutes.value} min` : props.room.label,
    actions: options,
  }
}

function setPower(on: boolean) {
  report(actions.setPower(props.room.id, on), `${props.room.label} turned ${on ? 'on' : 'off'}`)
}

function openMenu() {
  const solo = props.room.members.length === 1
  const items: SheetAction[] = []
  if (online.value && props.room.power) {
    const label = sleepMinutes.value ? `Sleep timer · ${sleepMinutes.value} min` : 'Sleep timer…'
    items.push({ label, icon: 'sleep', run: openSleep })
  }
  if (online.value && props.room.canPowerOff) {
    items.push({ label: props.room.power ? 'Turn off' : 'Turn on', icon: 'power', run: () => setPower(!props.room.power) })
  }
  actionSheet.value = {
    title: props.room.label,
    subtitle: 'Disabled rooms are hidden and never played to',
    actions: [
      ...items,
      ...props.room.members.map(
        (m): SheetAction => ({
          label: solo ? 'Disable room' : `Disable ${m.name}`,
          icon: 'block',
          run: () =>
            void actions
              .setDisabled(m.id, true)
              .then(() => showToast(`${m.name} disabled`))
              .catch(() => showToast("Couldn't reach the server")),
        }),
      ),
    ],
  }
}
</script>

<template>
  <article
    class="rounded-3xl p-4 transition-colors"
    :class="isActive ? 'bg-neutral-800 ring-2 ring-accent/60' : ['bg-neutral-900', { 'cursor-pointer': online }]"
    :aria-label="props.room.label"
    @click="onCardClick"
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
        @click="select"
      >
        <img v-if="art" :src="art" alt="" class="size-14 shrink-0 rounded-lg bg-neutral-700 object-cover" />
        <span v-else class="size-14 shrink-0 rounded-lg bg-neutral-700" />
        <span class="min-w-0">
          <span class="flex items-center gap-2">
            <PlayingBars v-if="props.room.isPlaying" />
            <span class="truncate font-medium">{{ !online ? 'Offline' : !props.room.power ? 'Off' : (props.room.track?.title ?? 'Nothing queued') }}</span>
          </span>
          <span class="block truncate text-sm text-neutral-400">{{ online && props.room.power ? props.room.track?.artist : '' }}</span>
          <span v-if="online && props.room.power && sleepMinutes" class="flex items-center gap-1 text-xs text-accent">
            <Icon name="sleep" class="size-3.5" />Sleeps in {{ sleepMinutes }} min
          </span>
        </span>
      </button>
      <button
        v-if="online && !props.room.power && props.room.canPowerOff"
        type="button"
        class="flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-medium active:bg-white/20"
        @click="setPower(true)"
      >
        <Icon name="power" class="size-5" /> Turn on <span class="sr-only">{{ props.room.label }}</span>
      </button>
      <button
        v-else-if="online && props.room.power && props.room.track"
        type="button"
        class="grid size-11 shrink-0 place-items-center rounded-full bg-white/10 active:bg-white/20"
        :aria-label="`${props.room.isPlaying ? 'Pause' : 'Play'} ${props.room.label}`"
        @click="actions.togglePlay(props.room.id)"
      >
        <Icon :name="props.room.isPlaying ? 'pause' : 'play'" class="size-6" />
      </button>
    </div>

    <RoomVolume v-if="online && props.room.power" :room="props.room" class="mt-2" />
  </article>
</template>
