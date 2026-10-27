import { computed, ref, shallowRef } from 'vue'
import type { Page } from '@/lms/library'
import type { LetterIndex } from '@/lms/types'

// Libraries run to thousands of items and may be reached over a slow link, so lists load in pages
export function usePaged<T>(fetchPage: (start: number, n: number) => Promise<Page<T>>, size = 100) {
  const items = shallowRef<T[]>([])
  const count = ref<number | null>(null)
  const index = shallowRef<LetterIndex | undefined>()
  const loading = ref(false)
  const error = ref<string | null>(null)
  // Bumped on reset so responses for an earlier query are dropped
  let generation = 0
  let inFlight: Promise<void> | null = null

  const done = computed(() => count.value !== null && items.value.length >= count.value)

  async function load(n: number) {
    const gen = generation
    loading.value = true
    error.value = null
    try {
      const page = await fetchPage(items.value.length, n)
      if (gen !== generation) return
      items.value = [...items.value, ...page.items]
      count.value = page.items.length ? page.count : items.value.length
      if (page.index) index.value = page.index
    } catch (e) {
      if (gen === generation) error.value = e instanceof Error ? e.message : String(e)
    } finally {
      if (gen === generation) loading.value = false
    }
  }

  function run(n: number) {
    const request: Promise<void> = load(n).finally(() => {
      if (inFlight === request) inFlight = null
    })
    inFlight = request
    return request
  }

  async function more() {
    if (loading.value || done.value) return
    await run(size)
  }

  // A jump far down the list loads everything before it in one request, so the list stays contiguous
  async function loadTo(target: number) {
    while (inFlight) await inFlight
    if (items.value.length >= target || done.value) return
    await run(target - items.value.length + size)
  }

  function reset() {
    generation++
    items.value = []
    count.value = null
    index.value = undefined
    loading.value = false
    error.value = null
    inFlight = null
    void more()
  }

  return { items, count, index, loading, error, done, more, loadTo, reset }
}
