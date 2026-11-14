<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import usePlayerStore from '@/store/usePlayerStore'
import { artworkUrl, formatTime } from '@/lms/format'
import { fetchPlaylists, saveQueueAsPlaylist } from '@/lms/library'
import { occurrenceKeys } from '@/lms/queue'
import BottomSheet from './BottomSheet.vue'
import EditableTrackList, { type EditableRow } from './browse/EditableTrackList.vue'
import LoadMore from './browse/LoadMore.vue'
import Icon from './Icon.vue'
import { actionSheet, confirmSheet, namePrompt, playlistsVersion, showToast } from './overlays'
import PlayingBars from './PlayingBars.vue'

const emit = defineEmits<{ close: [] }>()
const { getters, actions } = usePlayerStore()
const list = ref<HTMLOListElement | null>(null)
const editing = ref(false)

const queue = getters.queue
const total = getters.queueTotal
const keys = computed(() => occurrenceKeys(queue.value.map((t) => t.id)))
const editRows = computed<EditableRow[]>(() =>
  queue.value.map((t, i) => ({ key: keys.value[i], title: t.title, subtitle: t.artist, art: artworkUrl(t, 96) })),
)

function saveQueue() {
  const playerId = getters.activeId.value
  if (!playerId) return
  namePrompt.value = {
    title: 'Save queue as playlist',
    label: 'Playlist name',
    confirmLabel: 'Save',
    submit: async (name) => {
      // `playlist save` replaces a same-named playlist without asking
      const taken = (await fetchPlaylists(0, 500)).items.some((p) => p.playlist.toLowerCase() === name.toLowerCase())
      if (taken) return 'A playlist with that name already exists'
      await saveQueueAsPlaylist(playerId, name)
      playlistsVersion.value++
      showToast(`Saved as ${name}`)
      return null
    },
  }
}

function confirmClear() {
  const room = getters.activeLabel.value
  confirmSheet.value = {
    title: `Clear the queue on ${room}?`,
    message: 'Playback stops and every track is removed from the queue.',
    confirmLabel: 'Clear queue',
    run: async () => {
      editing.value = false
      await actions.clearQueue()
    },
  }
}

function openMore() {
  actionSheet.value = {
    title: 'Queue',
    subtitle: `${total.value} tracks on ${getters.activeLabel.value}`,
    actions: [
      { label: 'Save as playlist', icon: 'save', run: saveQueue },
      { label: 'Clear queue', icon: 'delete', danger: true, run: confirmClear },
    ],
  }
}

function report(edit: Promise<void>) {
  edit.catch(() => showToast("Couldn't update the queue"))
}

onMounted(async () => {
  await nextTick()
  list.value?.querySelector('[aria-current]')?.scrollIntoView({ block: 'center' })
})
</script>

<template>
  <BottomSheet label="Queue" @close="emit('close')">
    <template #header>
      <div class="flex items-center gap-1 pt-3 pr-3 pb-2 pl-5">
        <h2 class="flex-1 text-lg font-semibold">
          Queue <span class="text-sm font-normal text-neutral-400">· {{ total }} tracks</span>
        </h2>
        <template v-if="queue.length">
          <button
            type="button"
            class="min-h-11 shrink-0 rounded-full px-4 font-semibold active:bg-neutral-800"
            :class="editing ? 'text-accent' : 'text-neutral-300'"
            :aria-pressed="editing"
            @click="editing = !editing"
          >
            {{ editing ? 'Done' : 'Edit' }}
          </button>
          <button
            type="button"
            class="grid size-11 place-items-center rounded-full text-neutral-300 active:bg-neutral-800"
            aria-label="More queue options"
            @click="openMore"
          >
            <Icon name="more" class="size-6" />
          </button>
        </template>
      </div>
    </template>
    <p v-if="!queue.length" class="p-6 text-center text-neutral-400">The queue is empty</p>
    <template v-else>
      <EditableTrackList
        v-if="editing"
        :tracks="editRows"
        @remove="report(actions.removeFromQueue($event))"
        @move="(from, to) => report(actions.moveInQueue(from, to))"
      />
      <ol v-else ref="list">
        <li v-for="(t, i) in queue" :key="keys[i]">
          <button
            type="button"
            class="flex w-full items-center gap-3 px-4 py-2 text-left active:bg-neutral-800"
            :class="{ 'bg-neutral-800/70': t['playlist index'] === getters.currentIndex.value }"
            :aria-current="t['playlist index'] === getters.currentIndex.value ? 'true' : undefined"
            @click="actions.playIndex(t['playlist index'])"
          >
            <img :src="artworkUrl(t, 96)" alt="" loading="lazy" class="size-12 shrink-0 rounded bg-neutral-800 object-cover" />
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-2">
                <PlayingBars v-if="t['playlist index'] === getters.currentIndex.value && getters.isPlaying.value" />
                <span class="truncate font-medium">{{ t.title }}</span>
              </span>
              <span class="block truncate text-sm text-neutral-400">{{ t.artist }}</span>
            </span>
            <span class="text-sm tabular-nums text-neutral-400">{{ formatTime(t.duration) }}</span>
          </button>
        </li>
      </ol>
      <LoadMore
        v-if="queue.length < total"
        :loading="getters.queueLoading.value"
        :error="getters.queueLoadError.value"
        :done="false"
        @more="actions.loadMoreQueue"
      />
    </template>
    <div class="h-4" />
  </BottomSheet>
</template>
