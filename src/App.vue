<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import useFavoritesStore from '@/store/useFavoritesStore'
import usePodcastStore from '@/store/usePodcastStore'
import usePlayerStore from '@/store/usePlayerStore'
import ActionSheet from './components/ActionSheet.vue'
import ConfirmSheet from './components/ConfirmSheet.vue'
import BrowseView from './components/browse/BrowseView.vue'
import HomeView from './components/browse/HomeView.vue'
import SearchView from './components/browse/SearchView.vue'
import StackView from './components/browse/StackView.vue'
import { scrollBehavior } from './components/browse/nav'
import MiniPlayer from './components/MiniPlayer.vue'
import NamePromptSheet from './components/NamePromptSheet.vue'
import NowPlayingSheet from './components/NowPlayingSheet.vue'
import OutputSelector from './components/OutputSelector.vue'
import { actionSheet, confirmSheet, namePrompt, playlistPicker } from './components/overlays'
import PlaylistPickerSheet from './components/PlaylistPickerSheet.vue'
import QueueSheet from './components/QueueSheet.vue'
import RoomsView from './components/RoomsView.vue'
import TabBar, { type Tab } from './components/TabBar.vue'
import Toast from './components/Toast.vue'

const { getters, actions } = usePlayerStore()

const tab = ref<Tab>('rooms')
const nowPlayingOpen = ref(false)
const queueOpen = ref(false)
const outputsFor = ref<string | null>(null)

// Tabs mount on first visit and then stay mounted, so switching keeps place and scroll
const visited = reactive(new Set<Tab>([tab.value]))
watch(tab, (t) => visited.add(t))

const stacks = reactive<Partial<Record<Tab, InstanceType<typeof StackView> | null>>>({})
const roomsScroller = ref<HTMLElement | null>(null)

function onReselect(t: Tab) {
  if (t === 'rooms') roomsScroller.value?.scrollTo({ top: 0, behavior: scrollBehavior() })
  else stacks[t]?.reselect()
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
  <!-- An embedding app (LyrPlay) sets --top-pad to its status bar height -->
  <div class="flex h-full flex-col pt-[var(--top-pad,env(safe-area-inset-top))]">
    <p v-if="getters.error.value" role="alert" class="bg-red-950 px-4 py-2 text-sm text-red-300">
      Can't reach the server: {{ getters.error.value }}
    </p>

    <main class="relative min-h-0 flex-1">
      <div v-show="tab === 'rooms'" ref="roomsScroller" class="absolute inset-0 overflow-y-auto">
        <RoomsView @group="outputsFor = $event" />
      </div>
      <div v-if="visited.has('home')" v-show="tab === 'home'" class="absolute inset-0">
        <StackView :ref="(el) => (stacks.home = el as InstanceType<typeof StackView> | null)">
          <HomeView />
        </StackView>
      </div>
      <div v-if="visited.has('browse')" v-show="tab === 'browse'" class="absolute inset-0">
        <StackView :ref="(el) => (stacks.browse = el as InstanceType<typeof StackView> | null)">
          <BrowseView />
        </StackView>
      </div>
      <div v-if="visited.has('search')" v-show="tab === 'search'" class="absolute inset-0">
        <StackView :ref="(el) => (stacks.search = el as InstanceType<typeof StackView> | null)">
          <SearchView />
        </StackView>
      </div>
    </main>

    <footer class="relative border-t border-neutral-900 bg-neutral-950 pt-2 pb-[env(safe-area-inset-bottom)]">
      <div class="absolute inset-x-0 bottom-full">
        <Toast />
      </div>
      <MiniPlayer v-if="getters.activeRoom.value" @open="nowPlayingOpen = true" />
      <TabBar v-model="tab" @reselect="onReselect" />
    </footer>

    <NowPlayingSheet
      v-if="nowPlayingOpen"
      @close="nowPlayingOpen = false"
      @queue="queueOpen = true"
      @outputs="outputsFor = $event"
    />
    <QueueSheet v-if="queueOpen" @close="queueOpen = false" />
    <OutputSelector v-if="outputsFor" :room-id="outputsFor" @close="outputsFor = null" />
    <ActionSheet v-if="actionSheet" :content="actionSheet" @close="actionSheet = null" />
    <PlaylistPickerSheet v-if="playlistPicker" :content="playlistPicker" @close="playlistPicker = null" />
    <NamePromptSheet v-if="namePrompt" :content="namePrompt" @close="namePrompt = null" />
    <ConfirmSheet v-if="confirmSheet" :content="confirmSheet" @close="confirmSheet = null" />
  </div>
</template>
