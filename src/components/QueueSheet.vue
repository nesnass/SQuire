<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import usePlayerStore from '@/store/usePlayerStore'
import { artworkUrl, formatTime } from '@/lms/format'
import { fetchPlaylists, saveQueueAsPlaylist } from '@/lms/library'
import BottomSheet from './BottomSheet.vue'
import Icon from './Icon.vue'
import { namePrompt, playlistsVersion, showToast } from './overlays'
import PlayingBars from './PlayingBars.vue'

const emit = defineEmits<{ close: [] }>()
const { getters, actions } = usePlayerStore()
const list = ref<HTMLOListElement | null>(null)

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

onMounted(async () => {
  await nextTick()
  list.value?.querySelector('[aria-current]')?.scrollIntoView({ block: 'center' })
})
</script>

<template>
  <BottomSheet label="Queue" @close="emit('close')">
    <template #header>
      <div class="flex items-center gap-2 pt-3 pr-3 pb-2 pl-5">
        <h2 class="flex-1 text-lg font-semibold">
          Queue <span class="text-sm font-normal text-neutral-400">· {{ getters.queue.value.length }} tracks</span>
        </h2>
        <button
          v-if="getters.queue.value.length"
          type="button"
          class="flex min-h-11 items-center gap-2 rounded-full bg-neutral-800 px-4 text-sm font-medium active:bg-neutral-700"
          @click="saveQueue"
        >
          <Icon name="save" class="size-5" /> Save as playlist
        </button>
      </div>
    </template>
    <p v-if="!getters.queue.value.length" class="p-6 text-center text-neutral-400">The queue is empty</p>
    <ol v-else ref="list" class="pb-4">
      <li v-for="t in getters.queue.value" :key="t['playlist index']">
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
          <span class="text-sm tabular-nums text-neutral-500">{{ formatTime(t.duration) }}</span>
        </button>
      </li>
    </ol>
  </BottomSheet>
</template>
