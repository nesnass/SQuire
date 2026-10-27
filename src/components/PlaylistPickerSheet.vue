<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { addToPlaylist, createPlaylist, fetchPlaylists } from '@/lms/library'
import type { Playlist } from '@/lms/types'
import BottomSheet from './BottomSheet.vue'
import Icon from './Icon.vue'
import { addedMessage } from '@/lms/format'
import { playlistsVersion, showToast, type PlaylistPickerContent } from './overlays'

const props = defineProps<{ content: PlaylistPickerContent }>()
const emit = defineEmits<{ close: [] }>()

const playlists = ref<Playlist[] | null>(null)
const loadError = ref(false)
const creating = ref(false)
const newName = ref('')
const busy = ref(false)
const nameInput = ref<HTMLInputElement | null>(null)

onMounted(async () => {
  try {
    playlists.value = (await fetchPlaylists(0, 500)).items
  } catch {
    loadError.value = true
  }
})

async function startCreating() {
  creating.value = true
  await nextTick()
  nameInput.value?.focus()
}

interface Destination {
  id: number
  name: string
}

// Reuses a same-named playlist, since `playlists new` with an existing name replaces that playlist
async function findOrCreate(name: string): Promise<Destination> {
  const match = playlists.value?.find((p) => p.playlist.toLowerCase() === name.toLowerCase())
  return match ? { id: match.id, name: match.playlist } : { id: await createPlaylist(name), name }
}

async function save(target: Destination | { name: string }, close: () => void) {
  if (busy.value) return
  busy.value = true
  try {
    // Songs are resolved first so a failure can't leave an empty new playlist behind
    const urls = await props.content.urls()
    if (!urls.length) {
      showToast('Nothing to add')
      return
    }
    const { id, name } = 'id' in target ? target : await findOrCreate(target.name)
    const added = await addToPlaylist(id, urls)
    playlistsVersion.value++
    showToast(addedMessage(added, urls.length, name))
    close()
  } catch {
    showToast("Couldn't update the playlist")
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <BottomSheet label="Add to playlist" @close="emit('close')">
    <template #header>
      <div class="flex items-center gap-3 border-b border-neutral-800 px-5 pt-3 pb-4">
        <img v-if="props.content.art" :src="props.content.art" alt="" class="size-12 rounded bg-neutral-800 object-cover" />
        <div class="min-w-0">
          <p class="text-sm text-neutral-400">Add to playlist</p>
          <p class="truncate font-semibold">{{ props.content.title }}</p>
        </div>
      </div>
    </template>
    <template #default="{ close }">
      <div :aria-busy="busy" class="py-2">
        <form v-if="creating" class="flex gap-2 px-4 py-2" @submit.prevent="newName.trim() && save({ name: newName.trim() }, close)">
          <input
            ref="nameInput"
            v-model="newName"
            type="text"
            enterkeyhint="done"
            maxlength="100"
            placeholder="Playlist name"
            aria-label="New playlist name"
            class="min-h-12 min-w-0 flex-1 rounded-xl bg-neutral-800 px-4 text-base outline-none focus:ring-2 focus:ring-accent"
          />
          <button
            type="submit"
            class="min-h-12 rounded-xl bg-accent px-4 font-semibold text-neutral-950 disabled:opacity-40"
            :disabled="!newName.trim() || busy"
          >
            Create
          </button>
        </form>
        <button
          v-else
          type="button"
          class="flex min-h-14 w-full items-center gap-4 px-5 text-left text-accent active:bg-neutral-800"
          @click="startCreating"
        >
          <span class="flex size-10 items-center justify-center rounded-lg bg-neutral-800">
            <Icon name="playlistAdd" class="size-6" />
          </span>
          New playlist…
        </button>

        <p v-if="loadError" class="px-5 py-4 text-sm text-neutral-400">Couldn't load your playlists</p>
        <p v-else-if="!playlists" class="px-5 py-4 text-sm text-neutral-400">Loading…</p>
        <ul v-else>
          <li v-for="p in playlists" :key="p.id">
            <button
              type="button"
              class="flex min-h-14 w-full items-center gap-4 px-5 text-left active:bg-neutral-800 disabled:opacity-40"
              :disabled="busy"
              @click="save({ id: p.id, name: p.playlist }, close)"
            >
              <span class="flex size-10 items-center justify-center rounded-lg bg-neutral-800 text-neutral-500">
                <Icon name="queue" class="size-6" />
              </span>
              <span class="truncate">{{ p.playlist }}</span>
            </button>
          </li>
        </ul>
      </div>
    </template>
  </BottomSheet>
</template>
