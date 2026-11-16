<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import usePlayerStore from '@/store/usePlayerStore'
import { artworkUrl, formatTime, qualityLabel } from '@/lms/format'
import { fetchLyrics } from '@/lms/info'
import Icon from './Icon.vue'
import RoomVolume from './RoomVolume.vue'
import SkipIcon from './SkipIcon.vue'
import Spinner from './Spinner.vue'
import type { Route } from './browse/nav'
import { addToPlaylistAction, usePlayActions } from './browse/playActions'
import { hostStreamText } from '@/native/lyrplay'
import { useTransport } from './useTransport'
import { actionSheet, type SheetAction } from './overlays'

// Shared by the now playing sheet (phone) and the wide-screen side column, which has no close button
const props = defineProps<{ closable?: boolean }>()
const emit = defineEmits<{ close: []; queue: []; outputs: [roomId: string]; go: [route: Route] }>()
const { getters, actions } = usePlayerStore()

const SWIPE_PX = 60

const track = getters.currentTrack
const art = computed(() => artworkUrl(track.value, 800))

// When this phone (LyrPlay) is the player, its decoder's description beats the server's file details
const STREAM_TEXT_POLL_MS = 2000
const hostStream = ref<string | null>(null)
function readHostStream() {
  hostStream.value = hostStreamText(getters.activeId.value)
}
readHostStream()
const streamTimer = setInterval(readHostStream, STREAM_TEXT_POLL_MS)
const quality = computed(() => hostStream.value ?? qualityLabel(track.value))

// Cover view (tablet and desktop): the cover fills the screen; any tap, Esc or F returns to the controls
const COVER_MEDIA = '(min-width: 768px)'
const BAR_HIDE_MS = 3000
const coverView = ref(false)
const coverBar = ref(false)
const bigArt = computed(() => artworkUrl(track.value, 1600))
const coverLayer = ref<HTMLElement | null>(null)
let coverOpener: HTMLElement | null = null
let barTimer: ReturnType<typeof setTimeout> | undefined
let wakeLock: WakeLockSentinel | null = null

function canCoverView() {
  return window.matchMedia(COVER_MEDIA).matches && Boolean(art.value)
}

async function enterCoverView() {
  if (!canCoverView()) return
  coverOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null
  coverView.value = true
  await nextTick()
  coverLayer.value?.focus()
}

function exitCoverView() {
  coverView.value = false
  coverBar.value = false
  coverOpener?.focus()
}

// A thin bar for play/pause without leaving; it shows on movement and hides when idle
function showBar() {
  coverBar.value = true
  clearTimeout(barTimer)
  clearInterval(streamTimer)
  barTimer = setTimeout(() => (coverBar.value = false), BAR_HIDE_MS)
}

// Captured ahead of the sheet's own Escape handler, which would close now playing instead
function onCoverKey(event: KeyboardEvent) {
  if (event.target instanceof HTMLInputElement) return
  if (coverView.value && (event.key === 'Escape' || event.key === 'f' || event.key === 'F')) {
    event.stopImmediatePropagation()
    exitCoverView()
  } else if (!coverView.value && (event.key === 'f' || event.key === 'F')) enterCoverView()
}
document.addEventListener('keydown', onCoverKey, { capture: true })

// Keeps an iPad on a stand from sleeping while the cover shows and music plays
async function updateWakeLock() {
  const want = coverView.value && getters.isPlaying.value && document.visibilityState === 'visible'
  try {
    if (want && !wakeLock) {
      wakeLock = (await navigator.wakeLock?.request('screen')) ?? null
      wakeLock?.addEventListener('release', () => (wakeLock = null))
    } else if (!want && wakeLock) {
      await wakeLock.release()
      wakeLock = null
    }
  } catch {
    // Not offered (older Safari, low battery); the screen just follows its usual timeout
  }
}
watch([coverView, getters.isPlaying], updateWakeLock)
document.addEventListener('visibilitychange', updateWakeLock)

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onCoverKey, { capture: true })
  document.removeEventListener('visibilitychange', updateWakeLock)
  clearTimeout(barTimer)
  void wakeLock?.release()
})
const shuffle = computed(() => Boolean(getters.status.value?.['playlist shuffle']))
const repeat = computed(() => getters.status.value?.['playlist repeat'] ?? 0)
const { mode, station, previousStation, nextStation, previous, next } = useTransport()
const canSeek = computed(() => Boolean(getters.status.value?.can_seek))
const repeatLabel = computed(() => ['Repeat off', 'Repeating track', 'Repeating queue'][repeat.value])

// Lyrics take the cover's place: a tap on the cover on a phone, where the controls need their room, or the
// Lyrics button on wider screens, where a tap on the cover opens cover view. Undefined while looking them up
const lyrics = ref<string | null | undefined>(null)
const showLyrics = ref(false)
watch(
  () => track.value?.id,
  async (id) => {
    lyrics.value = null
    // Library tracks only; streams carry negative ids
    if (!id || id < 0 || mode.value === 'radio') return void (showLyrics.value = false)
    lyrics.value = undefined
    const text = await fetchLyrics(id).catch(() => null)
    if (track.value?.id === id) lyrics.value = text
  },
  { immediate: true },
)
const lyricsText = computed(() => lyrics.value ?? (lyrics.value === undefined ? 'Looking for lyrics…' : 'No lyrics found for this song'))

const { favoriteAction } = usePlayActions()

// Only library tracks carry ids; streams show plain text
const albumRoute = computed<Route | null>(() => {
  const t = track.value
  const id = Number(t?.album_id)
  // AlbumView fetches the rest (cover, artist, year) for a route that carries only id and title
  return t?.album && id ? { kind: 'album', album: { id, album: t.album } } : null
})
const artistRoute = computed<Route | null>(() => {
  const t = track.value
  const id = Number(t?.artist_id?.split(',')[0])
  return t?.artist && id ? { kind: 'artist', id, name: t.artist } : null
})

function openMore() {
  const t = track.value
  if (!t?.url) return
  const url = t.url
  const art = artworkUrl(t, 96)
  if (mode.value === 'radio') {
    // The queue holds the resolved stream; a saved station is kept under its original link, so act on that
    const saved = station.value
    const name = saved?.name ?? t.remote_title ?? t.title
    const fav = saved?.url ? { url: saved.url, title: saved.name, icon: saved.image } : { url, title: name, icon: t.artwork_url }
    actionSheet.value = { title: name, subtitle: t.title, art, actions: [favoriteAction(fav)] }
    return
  }
  const actions: SheetAction[] = [
    favoriteAction({ url, title: t.title, icon: t.coverid ? `music/${t.coverid}/cover.png` : undefined }),
    addToPlaylistAction({ title: t.title, subtitle: t.artist, art, urls: async () => [url] }),
  ]
  const album = albumRoute.value
  const artist = artistRoute.value
  if (album) actions.push({ label: 'Go to album', icon: 'album', run: () => emit('go', album) })
  if (artist) actions.push({ label: 'Go to artist', icon: 'person', run: () => emit('go', artist) })
  actionSheet.value = { title: t.title, subtitle: t.artist, art, actions }
}

// Holds the dragged position so the ticking clock doesn't pull the thumb back mid-drag
const dragPosition = ref<number | null>(null)
const position = computed(() => dragPosition.value ?? getters.position.value)

function onSeekInput(event: Event) {
  dragPosition.value = Number((event.target as HTMLInputElement).value)
}

function onSeek(event: Event) {
  void actions.seek(Number((event.target as HTMLInputElement).value))
  dragPosition.value = null
}

// Horizontal swipe on the artwork skips; the buttons below remain the primary control.
// Mostly vertical moves are scrolling the lyrics, so they never skip
let touchStart: { x: number; y: number } | null = null
function onTouchStart(event: TouchEvent) {
  touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY }
}
function onTouchEnd(event: TouchEvent) {
  if (!touchStart) return
  const dx = event.changedTouches[0].clientX - touchStart.x
  const dy = event.changedTouches[0].clientY - touchStart.y
  touchStart = null
  if (Math.abs(dx) < Math.abs(dy) * 2) return
  if (dx < -SWIPE_PX) next()
  else if (dx > SWIPE_PX) previous()
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex items-center px-3 pb-1">
      <button
        v-if="props.closable"
        type="button"
        class="grid size-11 place-items-center rounded-full active:bg-neutral-800"
        aria-label="Close now playing"
        @click="emit('close')"
      >
        <Icon name="expandMore" class="size-8" />
      </button>
      <span v-else class="size-11" aria-hidden="true" />
      <p class="flex-1 truncate text-center text-xs font-medium tracking-wide text-neutral-400 uppercase">
        Playing on {{ getters.activeLabel.value }}
      </p>
      <button
        type="button"
        class="grid size-11 place-items-center rounded-full active:bg-neutral-800 disabled:invisible"
        :aria-label="mode === 'radio' ? 'More for this station' : 'More for this song'"
        :disabled="!track?.url"
        @click="openMore"
      >
        <Icon name="more" class="size-6" />
      </button>
    </div>

    <!-- Disabled while the server is unreachable: every control in here would fail -->
    <fieldset
      :disabled="getters.reachable.value === false"
      class="mx-auto flex min-h-0 w-full max-w-md min-w-0 flex-1 flex-col justify-evenly gap-4 border-0 px-6 pt-0 pb-[max(env(safe-area-inset-bottom),1rem)]"
      :class="{ 'opacity-60': getters.reachable.value === false }"
    >
      <div
        class="relative mx-auto aspect-square w-full max-w-[min(100%,42dvh)] overflow-hidden rounded-2xl bg-neutral-800 shadow-2xl"
        @touchstart.passive="onTouchStart"
        @touchend="onTouchEnd"
      >
        <template v-if="showLyrics">
          <img v-if="art" :src="art" alt="" class="absolute inset-0 size-full scale-110 object-cover opacity-30 blur-2xl" draggable="false" />
          <!-- A tap anywhere returns to the cover; the hidden button is the same for keyboards and screen readers -->
          <div
            role="region"
            aria-label="Lyrics"
            class="relative size-full overflow-y-auto overscroll-contain p-6 text-lg leading-relaxed font-semibold whitespace-pre-line"
            :class="lyrics ? 'text-neutral-50' : 'grid place-items-center text-center text-base text-neutral-300'"
            @click="showLyrics = false"
          >
            {{ lyricsText }}
          </div>
          <button type="button" class="sr-only" @click="showLyrics = false">Show cover</button>
        </template>
        <template v-else>
          <!-- On wide screens the cover opens cover view; on a phone a tap shows the lyrics, when there are some -->
          <button
            v-if="art"
            type="button"
            class="hidden size-full md:block md:cursor-zoom-in"
            aria-label="Show cover full screen"
            @click="enterCoverView"
          >
            <img :src="art" alt="" class="size-full object-cover" draggable="false" />
          </button>
          <button v-if="lyrics" type="button" class="size-full md:hidden" aria-label="Show lyrics" @click="showLyrics = true">
            <img v-if="art" :src="art" alt="" class="size-full object-cover" draggable="false" />
          </button>
          <img v-else-if="art" :src="art" alt="" class="size-full object-cover md:hidden" draggable="false" />
          <span
            v-if="lyrics"
            class="pointer-events-none absolute right-3 bottom-3 grid size-8 place-items-center rounded-full bg-black/60 text-neutral-100 md:hidden"
            aria-hidden="true"
          >
            <Icon name="lyrics" class="size-4" />
          </span>
        </template>
      </div>

      <div class="min-w-0">
        <h2 class="truncate text-2xl font-bold">{{ track?.title ?? 'Nothing queued' }}</h2>
        <button
          v-if="artistRoute"
          type="button"
          class="block max-w-full truncate text-left text-neutral-300 hover:underline active:text-white"
          :aria-label="`Go to artist ${track?.artist}`"
          @click="emit('go', artistRoute)"
        >
          {{ track?.artist }}
        </button>
        <p v-else class="truncate text-neutral-300">{{ track?.artist }}</p>
        <button
          v-if="albumRoute"
          type="button"
          class="block max-w-full truncate py-0.5 text-left text-sm text-neutral-400 hover:underline active:text-white"
          :aria-label="`Go to album ${track?.album}`"
          @click="emit('go', albumRoute)"
        >
          {{ track?.album }}
        </button>
        <p v-else class="truncate text-sm text-neutral-400">{{ track?.album ?? track?.remote_title }}</p>
      </div>

      <div v-if="mode === 'radio'" class="flex items-center justify-between gap-2 text-xs text-neutral-400">
        <span class="flex items-center gap-1.5 font-semibold tracking-wide text-accent">
          <span class="size-2 rounded-full bg-accent" aria-hidden="true" />LIVE
        </span>
        <span class="truncate text-neutral-400">{{ quality }}</span>
      </div>
      <div v-else>
        <input
          type="range"
          class="h-6 w-full accent-accent"
          min="0"
          :max="getters.duration.value || 0"
          step="1"
          :value="position"
          :disabled="!canSeek"
          aria-label="Seek"
          :aria-valuetext="`${formatTime(position)} of ${formatTime(getters.duration.value)}`"
          @input="onSeekInput"
          @change="onSeek"
        />
        <div class="flex items-center justify-between gap-2 text-xs tabular-nums text-neutral-400">
          <span>{{ formatTime(position) }}</span>
          <span class="truncate text-neutral-400">{{ quality }}</span>
          <span>-{{ formatTime(getters.duration.value - position) }}</span>
        </div>
      </div>

      <!-- Controls that do nothing for the current item stay in the layout, invisible, so play/pause doesn't shift -->
      <div class="flex items-center justify-between">
        <button
          type="button"
          class="grid size-11 place-items-center rounded-full active:bg-neutral-800"
          :class="[shuffle ? 'text-accent' : 'text-neutral-400', { invisible: mode === 'radio' }]"
          aria-label="Shuffle"
          :aria-pressed="shuffle"
          @click="actions.toggleShuffle"
        >
          <Icon name="shuffle" class="size-6" />
        </button>
        <button
          v-if="mode === 'podcast'"
          type="button"
          class="grid size-14 place-items-center rounded-full active:bg-neutral-800 disabled:opacity-40"
          aria-label="Back 15 seconds"
          :disabled="!canSeek"
          @click="previous"
        >
          <SkipIcon :seconds="15" class="size-10" />
        </button>
        <button
          v-else
          type="button"
          class="grid size-14 place-items-center rounded-full active:bg-neutral-800"
          :class="{ invisible: mode === 'radio' && !previousStation }"
          :aria-label="mode === 'radio' ? `Previous station: ${previousStation?.name}` : 'Previous track'"
          @click="previous"
        >
          <Icon name="previous" class="size-9" />
        </button>
        <button
          type="button"
          class="grid size-18 place-items-center rounded-full bg-white text-neutral-950 active:scale-95"
          :aria-label="getters.isPlaying.value ? 'Pause' : 'Play'"
          @click="actions.togglePlay()"
        >
          <Spinner v-if="getters.starting.value" class="size-10" />
        <Icon v-else :name="getters.isPlaying.value ? 'pause' : 'play'" class="size-10" />
        </button>
        <button
          v-if="mode === 'podcast'"
          type="button"
          class="grid size-14 place-items-center rounded-full active:bg-neutral-800 disabled:opacity-40"
          aria-label="Forward 30 seconds"
          :disabled="!canSeek"
          @click="next"
        >
          <SkipIcon :seconds="30" forward class="size-10" />
        </button>
        <button
          v-else
          type="button"
          class="grid size-14 place-items-center rounded-full active:bg-neutral-800"
          :class="{ invisible: mode === 'radio' && !nextStation }"
          :aria-label="mode === 'radio' ? `Next station: ${nextStation?.name}` : 'Next track'"
          @click="next"
        >
          <Icon name="next" class="size-9" />
        </button>
        <button
          type="button"
          class="grid size-11 place-items-center rounded-full active:bg-neutral-800"
          :class="[repeat ? 'text-accent' : 'text-neutral-400', { invisible: mode === 'radio' }]"
          :aria-label="repeatLabel"
          @click="actions.cycleRepeat"
        >
          <Icon :name="repeat === 1 ? 'repeatOne' : 'repeat'" class="size-6" />
        </button>
      </div>

      <div class="flex flex-col gap-2">
        <RoomVolume v-if="getters.activeRoom.value" :room="getters.activeRoom.value" />
        <div class="flex items-center justify-between">
          <button
            type="button"
            class="flex min-h-11 min-w-0 items-center gap-2 rounded-full bg-neutral-800 px-4 text-sm font-medium active:bg-neutral-700"
            @click="getters.activeRoom.value && emit('outputs', getters.activeRoom.value.id)"
          >
            <Icon name="speaker" class="size-5 shrink-0 text-accent" />
            <span class="sr-only">Choose where to play. Now playing on</span>
            <span class="truncate">{{ getters.activeLabel.value }}</span>
          </button>
          <div class="flex items-center gap-1">
            <button
              type="button"
              class="hidden size-11 place-items-center rounded-full active:bg-neutral-800 disabled:opacity-40 md:grid"
              :class="showLyrics ? 'text-accent' : 'text-neutral-300'"
              aria-label="Lyrics"
              :aria-pressed="showLyrics"
              :disabled="!lyrics && !showLyrics"
              @click="showLyrics = !showLyrics"
            >
              <Icon name="lyrics" class="size-6" />
            </button>
            <button
              type="button"
              class="grid size-11 place-items-center rounded-full text-neutral-300 active:bg-neutral-800"
              aria-label="Queue"
              @click="emit('queue')"
            >
              <Icon name="queue" class="size-6" />
            </button>
          </div>
        </div>
      </div>
    </fieldset>

    <Transition
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
      enter-active-class="transition-opacity duration-200 motion-reduce:transition-none"
      leave-active-class="transition-opacity duration-200 motion-reduce:transition-none"
    >
      <div
        v-if="coverView && art"
        ref="coverLayer"
        class="fixed inset-0 z-50 grid cursor-zoom-out place-items-center overflow-hidden bg-black"
        role="button"
        tabindex="0"
        aria-label="Show controls"
        @click="exitCoverView"
        @keydown.enter.prevent="exitCoverView"
        @keydown.space.prevent="exitCoverView"
        @pointermove="showBar"
        @touchstart.passive="showBar"
      >
        <img :src="art" alt="" class="absolute inset-0 size-full scale-110 object-cover opacity-50 blur-3xl" aria-hidden="true" />
        <!-- Crossfades when the track changes -->
        <Transition
          mode="out-in"
          enter-from-class="opacity-0"
          leave-to-class="opacity-0"
          enter-active-class="transition-opacity duration-300 motion-reduce:transition-none"
          leave-active-class="transition-opacity duration-300 motion-reduce:transition-none"
        >
          <img
            :key="bigArt"
            :src="bigArt"
            :alt="track?.album ? `Cover of ${track.album}` : ''"
            class="relative aspect-square w-[min(92vw,92dvh)] rounded-lg object-cover shadow-2xl"
            draggable="false"
          />
        </Transition>
        <Transition
          enter-from-class="translate-y-full"
          leave-to-class="translate-y-full"
          enter-active-class="transition-transform duration-200 motion-reduce:transition-none"
          leave-active-class="transition-transform duration-200 motion-reduce:transition-none"
        >
          <div
            v-if="coverBar"
            class="absolute inset-x-0 bottom-0 flex cursor-default items-center gap-3 bg-black/70 px-6 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] backdrop-blur"
            @click.stop
          >
            <div class="min-w-0 flex-1">
              <p class="truncate font-semibold">{{ track?.title }}</p>
              <p class="truncate text-sm text-neutral-300">{{ track?.artist }}</p>
            </div>
            <button
              type="button"
              class="grid size-12 place-items-center rounded-full bg-white text-neutral-950 active:scale-95"
              :aria-label="getters.isPlaying.value ? 'Pause' : 'Play'"
              :disabled="getters.reachable.value === false"
              @click="actions.togglePlay()"
            >
              <Icon :name="getters.isPlaying.value ? 'pause' : 'play'" class="size-7" />
            </button>
            <button
              type="button"
              class="min-h-11 rounded-full px-4 text-sm font-medium text-neutral-200 active:bg-white/10"
              @click="exitCoverView"
            >
              Controls
            </button>
          </div>
        </Transition>
      </div>
    </Transition>
  </div>
</template>
