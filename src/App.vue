<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import useFavoritesStore from '@/store/useFavoritesStore'
import usePodcastStore from '@/store/usePodcastStore'
import usePlayerStore from '@/store/usePlayerStore'
import ActionSheet from './components/ActionSheet.vue'
import ConfirmSheet from './components/ConfirmSheet.vue'
import BrowseView from './components/browse/BrowseView.vue'
import HomeView from './components/browse/HomeView.vue'
import SearchView from './components/browse/SearchView.vue'
import StackView from './components/browse/StackView.vue'
import { scrollBehavior, type Route } from './components/browse/nav'
import { syncLayers } from './components/history'
import MiniPlayer from './components/MiniPlayer.vue'
import NamePromptSheet from './components/NamePromptSheet.vue'
import NowPlayingBody from './components/NowPlayingBody.vue'
import NowPlayingSheet from './components/NowPlayingSheet.vue'
import OutputSelector from './components/OutputSelector.vue'
import { actionSheet, confirmSheet, namePrompt, playlistPicker } from './components/overlays'
import PlaylistPickerSheet from './components/PlaylistPickerSheet.vue'
import QueueSheet from './components/QueueSheet.vue'
import RoomsView from './components/RoomsView.vue'
import TabBar, { type Tab } from './components/TabBar.vue'
import Toast from './components/Toast.vue'
import { host } from './native/lyrplay'

const { getters, actions } = usePlayerStore()

const TAB_KEY = 'squire.tab'
const TABS: Tab[] = ['home', 'browse', 'search', 'rooms']

// Decided once at load, never after a poll, so the tab never moves under the user
function initialTab(): Tab {
  try {
    const saved = localStorage.getItem(TAB_KEY)
    if (TABS.includes(saved as Tab)) return saved as Tab
  } catch {
    // storage unavailable; fall through to the default
  }
  // Under Player Focus there's only one room, so the Rooms page would be a single card
  return host.focusPlayer ? 'home' : 'rooms'
}

const tab = ref<Tab>(initialTab())
watch(tab, (t) => {
  try {
    localStorage.setItem(TAB_KEY, t)
  } catch {
    // storage unavailable; the tab just won't be remembered
  }
})

// An action may open another action sheet; a new key mounts it fresh instead of reusing the closing one
const sheetKeys = new WeakMap<object, number>()
let lastSheetKey = 0
function sheetKey(content: object): number {
  let key = sheetKeys.get(content)
  if (key === undefined) sheetKeys.set(content, (key = ++lastSheetKey))
  return key
}

// Over Tailscale on mobile data this is routine: loaded lists stay readable, controls are switched off
const offline = computed(() => getters.reachable.value === false)
const retrying = ref(false)
async function retry() {
  retrying.value = true
  try {
    await actions.refresh()
  } finally {
    retrying.value = false
  }
}
const nowPlayingOpen = ref(false)
const queueOpen = ref(false)
const outputsFor = ref<string | null>(null)

// Sheets showing live state poll fast while open
watch(
  () => nowPlayingOpen.value || queueOpen.value || Boolean(outputsFor.value),
  (open) => actions.setWatching(open),
)

// Tabs mount on first visit and then stay mounted, so switching keeps place and scroll
const visited = reactive(new Set<Tab>([tab.value]))
watch(tab, (t) => visited.add(t))
// Back closes levels in the showing tab only, so whether history needs our entry changes with the tab
watch(tab, syncLayers, { flush: 'post' })

const stacks = reactive<Partial<Record<Tab, InstanceType<typeof StackView> | null>>>({})
const roomsScroller = ref<HTMLElement | null>(null)

function onReselect(t: Tab) {
  if (t === 'rooms') roomsScroller.value?.scrollTo({ top: 0, behavior: scrollBehavior() })
  else stacks[t]?.reselect()
}

// Now playing links into Library: Back from there returns to wherever Library was
async function goToLibrary(route: Route) {
  nowPlayingOpen.value = false
  tab.value = 'browse'
  await nextTick()
  stacks.browse?.push(route)
}

const favorites = useFavoritesStore()
const podcasts = usePodcastStore()

// Plugin menus need a player: a saved one is known at once, otherwise only after the first poll
watch(getters.menuPlayerId, (id) => void podcasts.actions.refresh(id), { immediate: true })

onMounted(() => {
  actions.start()
  // Loaded up front so ♥ states are right on whichever screen opens first
  void favorites.actions.refresh()
})
</script>

<template>
  <!-- An embedding app (LyrPlay) sets --top-pad to its status bar height.
       Wide screens: tab rail on the left, now playing always showing on the right, no mini player. -->
  <div
    class="flex h-full flex-col pt-[var(--top-pad,env(safe-area-inset-top))] xl:grid xl:grid-cols-[13rem_minmax(0,1fr)_24rem] xl:grid-rows-[auto_minmax(0,1fr)]"
  >
    <div
      v-if="offline"
      role="alert"
      class="flex items-center gap-3 bg-red-950 py-1 pr-2 pl-4 text-sm text-red-200 xl:col-span-3 xl:row-start-1"
    >
      <p class="flex-1">Can't reach the server</p>
      <button
        type="button"
        class="min-h-11 rounded-full px-4 font-semibold text-red-100 active:bg-red-900 disabled:opacity-60"
        :disabled="retrying"
        @click="retry"
      >
        {{ retrying ? 'Retrying…' : 'Retry' }}
      </button>
    </div>

    <!-- A disabled fieldset switches off every control inside it, keyboard included, while lists still scroll -->
    <fieldset
      :disabled="offline"
      class="relative m-0 min-h-0 min-w-0 flex-1 border-0 p-0 transition-opacity xl:col-start-2 xl:row-start-2"
      :class="{ 'opacity-60': offline }"
    >
    <main class="@container absolute inset-0">
      <div v-show="tab === 'rooms'" ref="roomsScroller" class="absolute inset-0 overflow-y-auto">
        <RoomsView @group="outputsFor = $event" />
      </div>
      <div v-if="visited.has('home')" v-show="tab === 'home'" class="absolute inset-0">
        <StackView :ref="(el) => (stacks.home = el as InstanceType<typeof StackView> | null)" :active="tab === 'home'">
          <HomeView />
        </StackView>
      </div>
      <div v-if="visited.has('browse')" v-show="tab === 'browse'" class="absolute inset-0">
        <StackView :ref="(el) => (stacks.browse = el as InstanceType<typeof StackView> | null)" :active="tab === 'browse'">
          <BrowseView />
        </StackView>
      </div>
      <div v-if="visited.has('search')" v-show="tab === 'search'" class="absolute inset-0">
        <StackView :ref="(el) => (stacks.search = el as InstanceType<typeof StackView> | null)" :active="tab === 'search'">
          <SearchView />
        </StackView>
      </div>
    </main>
    </fieldset>

    <footer
      class="relative border-t border-neutral-900 bg-neutral-950 pt-2 pb-[env(safe-area-inset-bottom)] xl:col-start-1 xl:row-start-2 xl:border-t-0 xl:border-r xl:px-3 xl:pt-6"
    >
      <div class="absolute inset-x-0 bottom-full xl:fixed xl:inset-x-auto xl:bottom-6 xl:left-1/2 xl:w-96 xl:-translate-x-1/2">
        <Toast />
      </div>
      <MiniPlayer v-if="getters.activeRoom.value" class="xl:hidden" :offline="offline" @open="nowPlayingOpen = true" />
      <TabBar v-model="tab" @reselect="onReselect" />
    </footer>

    <aside
      v-if="getters.activeRoom.value"
      aria-label="Now playing"
      class="hidden min-h-0 border-l border-neutral-900 pt-3 xl:col-start-3 xl:row-start-2 xl:flex xl:flex-col"
    >
      <NowPlayingBody @queue="queueOpen = true" @outputs="outputsFor = $event" @go="goToLibrary" />
    </aside>

    <NowPlayingSheet
      v-if="nowPlayingOpen"
      @close="nowPlayingOpen = false"
      @queue="queueOpen = true"
      @outputs="outputsFor = $event"
      @go="goToLibrary"
    />
    <QueueSheet v-if="queueOpen" @close="queueOpen = false" />
    <OutputSelector v-if="outputsFor" :room-id="outputsFor" @close="outputsFor = null" />
    <ActionSheet v-if="actionSheet" :key="sheetKey(actionSheet)" :content="actionSheet" @close="actionSheet = null" />
    <PlaylistPickerSheet v-if="playlistPicker" :content="playlistPicker" @close="playlistPicker = null" />
    <NamePromptSheet v-if="namePrompt" :content="namePrompt" @close="namePrompt = null" />
    <ConfirmSheet v-if="confirmSheet" :content="confirmSheet" @close="confirmSheet = null" />
  </div>
</template>
