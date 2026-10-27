<script setup lang="ts">
import { onMounted, ref, shallowRef, watch } from 'vue'
import { lookupDirectory, parsePodcastInput, searchDirectory, type DirectoryShow } from '@/lms/podcastDirectory'
import usePodcastStore from '@/store/usePodcastStore'
import Icon from '../Icon.vue'
import { showToast } from '../overlays'
import BackHeader from './BackHeader.vue'
import { useNav } from './nav'

const DEBOUNCE_MS = 400

const nav = useNav()
const podcasts = usePodcastStore()
const input = ref<HTMLInputElement | null>(null)
const query = ref('')
const results = shallowRef<DirectoryShow[] | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const busy = ref<string | null>(null)

let timer: ReturnType<typeof setTimeout> | undefined
// Only the latest lookup may write results
let latest = 0

async function lookup(text: string) {
  const parsed = parsePodcastInput(text)
  const id = ++latest
  if (!parsed) {
    results.value = null
    loading.value = false
    return
  }
  loading.value = true
  try {
    let found: DirectoryShow[]
    if (parsed.kind === 'term') found = await searchDirectory(parsed.term)
    else if (parsed.kind === 'apple') found = await lookupDirectory(parsed.id)
    // A pasted feed isn't looked up; LMS reads its title once subscribed
    else found = [{ feedUrl: parsed.url, author: `RSS feed · ${new URL(parsed.url).hostname}` }]
    if (id !== latest) return
    results.value = found
    error.value = null
  } catch (e) {
    if (id === latest) error.value = e instanceof Error ? e.message : String(e)
  } finally {
    if (id === latest) loading.value = false
  }
}

watch(query, (q) => {
  clearTimeout(timer)
  timer = setTimeout(() => void lookup(q), DEBOUNCE_MS)
})

async function subscribe(show: DirectoryShow) {
  busy.value = show.feedUrl
  try {
    const name = await podcasts.actions.subscribe(show.feedUrl, show.name)
    showToast(`Subscribed to ${name}`)
  } catch {
    showToast("Couldn't subscribe")
  } finally {
    busy.value = null
  }
}

function open(show: DirectoryShow) {
  const subscribed = podcasts.getters.showForFeed(show.feedUrl)
  if (subscribed) nav.push({ kind: 'podcast', show: subscribed })
}

onMounted(() => input.value?.focus())
</script>

<template>
  <article class="pb-6">
    <BackHeader title="Add podcast" />
    <div class="px-4 pt-2">
      <h1 class="text-3xl font-bold">Add podcast</h1>
      <div class="relative mt-4">
        <Icon name="search" class="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-neutral-500" />
        <input
          ref="input"
          v-model="query"
          type="search"
          enterkeyhint="search"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          placeholder="Search, or paste a link"
          aria-label="Search podcasts, or paste an Apple Podcasts or RSS link"
          aria-describedby="podcast-search-hint"
          class="min-h-12 w-full rounded-xl bg-neutral-800 pr-4 pl-10 text-base outline-none placeholder:text-neutral-500 focus:ring-2 focus:ring-accent"
        />
      </div>
      <p id="podcast-search-hint" class="mt-2 text-sm text-neutral-500">
        Search by name, or paste an Apple Podcasts link or an RSS feed address.
      </p>
    </div>

    <p v-if="error" role="alert" class="px-4 py-6 text-center text-neutral-400">Search failed: {{ error }}</p>
    <p v-else-if="loading && !results" class="px-4 py-6 text-center text-neutral-500">Searching…</p>
    <p v-else-if="results && !results.length" class="px-4 py-6 text-center text-neutral-400">No podcasts found</p>
    <ul v-else-if="results" class="pt-4" :aria-busy="loading">
      <li v-for="show in results" :key="show.feedUrl" class="flex items-center gap-3 px-4 py-2">
        <img
          v-if="show.artwork"
          :src="show.artwork"
          alt=""
          loading="lazy"
          class="size-14 shrink-0 rounded-lg bg-neutral-800 object-cover"
        />
        <span v-else class="flex size-14 shrink-0 items-center justify-center rounded-lg bg-neutral-800 text-neutral-500">
          <Icon name="radio" class="size-6" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="line-clamp-2">{{ podcasts.getters.showForFeed(show.feedUrl)?.name ?? show.name ?? 'Podcast feed' }}</span>
          <span v-if="show.author" class="block truncate text-sm text-neutral-400">{{ show.author }}</span>
        </span>
        <button
          v-if="podcasts.getters.showForFeed(show.feedUrl)"
          type="button"
          class="min-h-10 shrink-0 rounded-full border border-accent px-4 text-sm font-medium text-accent"
          :aria-label="`Open ${show.name ?? 'podcast'}, subscribed`"
          @click="open(show)"
        >
          Subscribed
        </button>
        <button
          v-else
          type="button"
          class="min-h-10 shrink-0 rounded-full bg-accent px-4 text-sm font-semibold text-neutral-950 disabled:opacity-50"
          :disabled="busy !== null"
          :aria-label="`Subscribe to ${show.name ?? 'this feed'}`"
          @click="subscribe(show)"
        >
          {{ busy === show.feedUrl ? 'Adding…' : 'Subscribe' }}
        </button>
      </li>
    </ul>
  </article>
</template>
