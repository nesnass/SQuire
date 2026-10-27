import { computed, ref } from 'vue'
import { createStore } from './dev-store'
import { lmsCommand } from '@/lms/client'
import { favoriteKind } from '@/lms/format'
import { fetchFavorites } from '@/lms/library'
import type { Favorite } from '@/lms/types'

export interface FavoriteInput {
  url: string
  title: string
  icon?: string
}

// Only top-level favourites are tracked; the ♥ state of items inside folders isn't shown
function useFavoritesStore() {
  const items = ref<Favorite[]>([])
  const loaded = ref(false)
  const error = ref<string | null>(null)

  const byUrl = computed(() => new Map(items.value.filter((f) => f.url).map((f) => [f.url as string, f])))

  async function refresh() {
    try {
      items.value = (await fetchFavorites(0, 500)).items
      error.value = null
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loaded.value = true
    }
  }

  const getters = {
    items: computed(() => items.value),
    // Saved radio stations, which the Library lists separately
    stations: computed(() => items.value.filter((f) => favoriteKind(f) === 'radio')),
    loaded: computed(() => loaded.value),
    error: computed(() => error.value),
    isFavorite: (url: string | undefined) => Boolean(url && byUrl.value.has(url)),
  }

  const actions = {
    refresh,
    async add(fav: FavoriteInput) {
      const command = ['favorites', 'add', `url:${fav.url}`, `title:${fav.title}`]
      if (fav.icon) command.push(`icon:${fav.icon}`)
      // Shown straight away; the refresh replaces the placeholder id with LMS's
      items.value = [...items.value, { id: `pending:${fav.url}`, name: fav.title, url: fav.url, isaudio: 1 }]
      await lmsCommand('', command)
      await refresh()
    },
    async remove(url: string) {
      const fav = byUrl.value.get(url)
      if (!fav) return
      items.value = items.value.filter((f) => f !== fav)
      await lmsCommand('', ['favorites', 'delete', `item_id:${fav.id}`])
      await refresh()
    },
  }

  return { getters, actions }
}

export default createStore('favorites', useFavoritesStore)
