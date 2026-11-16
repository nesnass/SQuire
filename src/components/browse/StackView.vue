<script setup lang="ts">
import { onBeforeUnmount, provide, ref } from 'vue'
import { openLayer } from '../history'
import AlbumView from './AlbumView.vue'
import ArtistView from './ArtistView.vue'
import CreditsView from './CreditsView.vue'
import FavoritesFolderView from './FavoritesFolderView.vue'
import MenuView from './MenuView.vue'
import { NAV, scrollBehavior, type Route } from './nav'
import PlaylistView from './PlaylistView.vue'
import PodcastSearchView from './PodcastSearchView.vue'
import PodcastView from './PodcastView.vue'
import RadioSourcesView from './RadioSourcesView.vue'

// `active` is whether this stack's tab is showing; Back only closes levels the user can see
const props = defineProps<{ active: boolean }>()

const stack = ref<Route[]>([])
// One history layer per level, released as the level closes
const releases: (() => void)[] = []
// While a level slides in, the one under it stays visible behind it
const entering = ref(false)

function push(route: Route) {
  stack.value.push(route)
  entering.value = true
  releases.push(openLayer({ close: pop, active: () => props.active }))
}

function pop() {
  stack.value.pop()
  releases.pop()?.()
}

provide(NAV, { push, pop })

const root = ref<HTMLElement | null>(null)

// Same as an iOS tab bar: the first tap goes back to the top level, the next scrolls it to the top
function reselect() {
  if (stack.value.length) {
    stack.value = []
    releases.splice(0).forEach((release) => release())
  } else root.value?.scrollTo({ top: 0, behavior: scrollBehavior() })
}

onBeforeUnmount(() => releases.splice(0).forEach((release) => release()))

defineExpose({ reselect, push })

function visible(i: number): boolean {
  const top = stack.value.length - 1
  return i === top || (entering.value && i === top - 1)
}

function routeId(route: Route) {
  if (route.kind === 'album') return route.album.id
  if (route.kind === 'playlist') return route.playlist.id
  if (route.kind === 'podcast') return route.show.id
  if (route.kind === 'podcastSearch' || route.kind === 'radioSources') return ''
  if (route.kind === 'menu') return `${route.menu}:${route.itemId ?? ''}:${route.search ?? ''}`
  return route.id
}
</script>

<template>
  <!-- Every level stays mounted with its own scroller, so going back keeps the scroll position.
       Hidden levels use a class, not v-show, which TransitionGroup would animate.
       Clipped rather than hidden: views focus their heading while still off to the side, and focus would
       scroll an overflow-hidden box sideways mid-slide -->
  <div class="relative h-full overflow-clip">
    <div
      ref="root"
      data-scroller
      class="absolute inset-0 overflow-y-auto"
      :class="{ hidden: stack.length && !(entering && stack.length === 1) }"
    >
      <slot />
    </div>
    <TransitionGroup
      enter-from-class="translate-x-full"
      leave-to-class="translate-x-full"
      enter-active-class="transition-transform duration-200 ease-out motion-reduce:transition-none"
      leave-active-class="transition-transform duration-200 ease-in motion-reduce:transition-none"
      @after-enter="entering = false"
      @enter-cancelled="entering = false"
    >
      <div
        v-for="(route, i) in stack"
        :key="`${i}:${route.kind}:${routeId(route)}`"
        data-scroller
        class="absolute inset-0 overflow-y-auto bg-neutral-950 shadow-2xl"
        :class="{ hidden: !visible(i) }"
      >
        <AlbumView v-if="route.kind === 'album'" :album="route.album" />
        <ArtistView v-else-if="route.kind === 'artist'" :id="route.id" :name="route.name" />
        <CreditsView v-else-if="route.kind === 'credits'" :id="route.id" :name="route.name" :role="route.role" />
        <PlaylistView v-else-if="route.kind === 'playlist'" :playlist="route.playlist" />
        <FavoritesFolderView v-else-if="route.kind === 'favorites'" :id="route.id" :name="route.name" />
        <PodcastView v-else-if="route.kind === 'podcast'" :show="route.show" />
        <PodcastSearchView v-else-if="route.kind === 'podcastSearch'" />
        <RadioSourcesView v-else-if="route.kind === 'radioSources'" />
        <MenuView v-else :menu="route.menu" :title="route.title" :item-id="route.itemId" :search="route.search" />
      </div>
    </TransitionGroup>
  </div>
</template>
