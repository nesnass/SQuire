import { computed, ref } from 'vue'
import { createStore } from './dev-store'
import { fetchMenu, fetchPodcastHome, subscribePodcast, unsubscribePodcast } from '@/lms/menus'
import type { MenuItem } from '@/lms/types'

function usePodcastStore() {
  const shows = ref<MenuItem[]>([])
  const lists = ref<MenuItem[]>([])
  const loaded = ref(false)
  const error = ref<string | null>(null)
  let lastPlayer: string | null = null

  async function refresh(playerId: string | null = lastPlayer) {
    if (!playerId) return
    lastPlayer = playerId
    try {
      const home = await fetchPodcastHome(playerId)
      shows.value = home.shows
      lists.value = home.lists
      error.value = null
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loaded.value = true
    }
  }

  const getters = {
    shows: computed(() => shows.value),
    lists: computed(() => lists.value),
    loaded: computed(() => loaded.value),
    error: computed(() => error.value),
    showForFeed: (feedUrl: string) => shows.value.find((s) => s.url === feedUrl),
  }

  const actions = {
    refresh,
    // Without a name (a pasted feed) the show is renamed to the title LMS reads from the feed.
    // Resolves to the name it was saved under
    async subscribe(feedUrl: string, name?: string): Promise<string> {
      const placeholder = name ?? new URL(feedUrl).hostname
      await subscribePodcast(feedUrl, placeholder)
      await refresh()
      const show = getters.showForFeed(feedUrl)
      if (name || !show || !lastPlayer) return placeholder
      const { title } = await fetchMenu(lastPlayer, 'podcasts', { itemId: show.id, n: 1 })
      if (!title || title === placeholder) return placeholder
      await unsubscribePodcast(feedUrl)
      await subscribePodcast(feedUrl, title)
      await refresh()
      return title
    },
    async unsubscribe(feedUrl: string) {
      shows.value = shows.value.filter((s) => s.url !== feedUrl)
      await unsubscribePodcast(feedUrl)
      await refresh()
    },
  }

  return { getters, actions }
}

export default createStore('podcasts', usePodcastStore)
