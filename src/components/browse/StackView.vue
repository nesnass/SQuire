<script setup lang="ts">
import { provide, ref } from 'vue'
import AlbumView from './AlbumView.vue'
import ArtistView from './ArtistView.vue'
import FavoritesFolderView from './FavoritesFolderView.vue'
import MenuView from './MenuView.vue'
import { NAV, scrollBehavior, type Route } from './nav'
import PlaylistView from './PlaylistView.vue'
import PodcastSearchView from './PodcastSearchView.vue'
import PodcastView from './PodcastView.vue'
import RadioSourcesView from './RadioSourcesView.vue'

const stack = ref<Route[]>([])

provide(NAV, {
  push: (route) => stack.value.push(route),
  pop: () => stack.value.pop(),
})

const root = ref<HTMLElement | null>(null)

// Same as an iOS tab bar: the first tap goes back to the top level, the next scrolls it to the top
function reselect() {
  if (stack.value.length) stack.value = []
  else root.value?.scrollTo({ top: 0, behavior: scrollBehavior() })
}

defineExpose({ reselect })

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
  <!-- Every level stays mounted with its own scroller, so going back keeps the scroll position -->
  <div class="relative h-full">
    <div v-show="!stack.length" ref="root" data-scroller class="absolute inset-0 overflow-y-auto">
      <slot />
    </div>
    <div
      v-for="(route, i) in stack"
      v-show="i === stack.length - 1"
      :key="`${i}:${route.kind}:${routeId(route)}`"
      data-scroller
      class="absolute inset-0 overflow-y-auto"
    >
      <AlbumView v-if="route.kind === 'album'" :album="route.album" />
      <ArtistView v-else-if="route.kind === 'artist'" :id="route.id" :name="route.name" />
      <PlaylistView v-else-if="route.kind === 'playlist'" :playlist="route.playlist" />
      <FavoritesFolderView v-else-if="route.kind === 'favorites'" :id="route.id" :name="route.name" />
      <PodcastView v-else-if="route.kind === 'podcast'" :show="route.show" />
      <PodcastSearchView v-else-if="route.kind === 'podcastSearch'" />
      <RadioSourcesView v-else-if="route.kind === 'radioSources'" />
      <MenuView v-else :menu="route.menu" :title="route.title" :item-id="route.itemId" :search="route.search" />
    </div>
  </div>
</template>
