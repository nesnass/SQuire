<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { CREDIT_ROLE_IDS, creditedOnly, type CreditRole } from '@/lms/credits'
import {
  canRandomPlay,
  fetchAlbumArtistRole,
  fetchAlbums,
  fetchAllArtists,
  fetchDecadeAlbums,
  fetchArtists,
  libraryTarget,
  type AlbumSort,
} from '@/lms/library'
import { groupBySection, indexOf, letterSections, type LetterSection } from '@/lms/sections'
import type { Artist, Genre, Period, PlayTarget } from '@/lms/types'
import usePlayerStore from '@/store/usePlayerStore'
import Icon from '../Icon.vue'
import { actionSheet, confirmSheet, showToast, type SheetAction } from '../overlays'
import AlbumTile from './AlbumTile.vue'
import ArtistRow from './ArtistRow.vue'
import FiltersSheet, { type AlbumFilters } from './FiltersSheet.vue'
import GenreSheet from './GenreSheet.vue'
import LetterRail from './LetterRail.vue'
import LoadMore from './LoadMore.vue'
import PlayBar from './PlayBar.vue'
import { usePlayActions } from './playActions'
import { usePaged } from './usePaged'

type Kind = 'albums' | 'artists'
type Role = 'main' | CreditRole

const SORTS: { id: AlbumSort; label: string }[] = [
  { id: 'new', label: 'Recently added' },
  { id: 'album', label: 'Title' },
  { id: 'artistalbum', label: 'Artist' },
]
const ROLES: { id: Role; label: string }[] = [
  { id: 'main', label: 'Album artists' },
  { id: 'composers', label: 'Composers' },
  { id: 'guests', label: 'Other artists' },
]
const MIXES = [
  { kind: 'tracks', label: 'Songs' },
  { kind: 'albums', label: 'Albums' },
  { kind: 'contributors', label: 'Artists' },
] as const

const { getters, actions } = usePlayerStore()
const { openActions } = usePlayActions()

const kind = ref<Kind>('albums')
const sort = ref<AlbumSort>('new')
const genres = ref<Genre[]>([])
// A comma-separated list, which LMS reads as any of them
const genreIds = computed(() => genres.value.map((g) => g.id).join(',') || undefined)
const genreLabel = computed(() =>
  genres.value.length > 2 ? `${genres.value.length} genres` : genres.value.map((g) => g.genre).join(', '),
)
const period = ref<Period | null>(null)
const year = computed(() => (period.value && !period.value.decade ? period.value.value : null))
const periodLabel = computed(() => (period.value ? `${period.value.value}${period.value.decade ? 's' : ''}` : ''))
const compilations = ref(false)
const role = ref<Role>('main')
// Albums filter in one sheet; artists have only genres, so theirs opens directly
const picking = ref<'filters' | 'genre' | null>(null)
const randomAvailable = ref(false)
const root = ref<HTMLElement | null>(null)

// The letter index comes with the first page; "Recently added" has no alphabetical order to index
const compilation = computed(() => (compilations.value ? (1 as const) : undefined))
const albums = usePaged((start, n) =>
  period.value?.decade
    ? fetchDecadeAlbums(period.value.value, { sort: sort.value, genreId: genreIds.value, compilation: compilation.value })
    : fetchAlbums(start, n, {
    sort: sort.value,
    withIndex: start === 0 && sort.value !== 'new',
    genreId: genreIds.value,
    year: year.value ?? undefined,
    compilation: compilation.value,
  }),
)
const artists = usePaged(
  async (start, n) =>
    fetchArtists(start, n, { withIndex: start === 0, genreId: genreIds.value, roleId: await fetchAlbumArtistRole() }),
  200,
)

const albumSections = computed(() => letterSections(albums.index.value))
// LMS caps "Recently added" at its own setting (Settings › Interface), so the list may stop short of the library
const recentCapped = computed(() => sort.value === 'new' && !filtered.value && albums.done.value)
const albumGroups = computed(() => groupBySection(albums.items.value, albumSections.value))
const artistSections = computed(() => letterSections(artists.index.value))
const artistGroups = computed(() => groupBySection(artists.items.value, artistSections.value))

// Composers and guests: fetched whole once per role and kept for the session
const credits = ref<Partial<Record<Role, Artist[]>>>({})
const creditsError = ref(false)
const creditSections = computed(() => letterSections(indexOf(role.value === 'main' ? [] : (credits.value[role.value] ?? []))))
const creditGroups = computed(() =>
  groupBySection(role.value === 'main' ? [] : (credits.value[role.value] ?? []), creditSections.value),
)
// Already loaded whole, so a jump only scrolls
function jumpCredits(section: LetterSection) {
  document.getElementById(`credits-${section.start}`)?.scrollIntoView({ block: 'start' })
}
async function loadCredits(r: CreditRole) {
  if (credits.value[r]) return
  creditsError.value = false
  try {
    const [credited, main] = await Promise.all([
      fetchAllArtists(CREDIT_ROLE_IDS[r]),
      fetchAlbumArtistRole().then(fetchAllArtists),
    ])
    credits.value = { ...credits.value, [r]: creditedOnly(credited, main) }
  } catch {
    creditsError.value = true
  }
}

const filtered = computed(() => Boolean(genres.value.length || period.value || compilations.value))
const albumFilters = computed<AlbumFilters>(() => ({ genres: genres.value, period: period.value, compilations: compilations.value }))
function applyFilters(f: AlbumFilters) {
  genres.value = f.genres
  period.value = f.period
  compilations.value = f.compilations
}
const sortLabel = computed(() => SORTS.find((s) => s.id === sort.value)?.label)
const roleLabel = computed(() => ROLES.find((r) => r.id === role.value)?.label)
const mixOn = computed(() => Boolean(getters.status.value?.randomplay))

// Clearing every filter returns to the full list where it was left
let savedScroll: number | null = null
function scroller(): HTMLElement | null {
  return root.value?.closest<HTMLElement>('[data-scroller]') ?? null
}
watch(filtered, async (now, before) => {
  if (now && !before) savedScroll = scroller()?.scrollTop ?? null
  if (!now && before && savedScroll !== null) {
    await nextTick()
    scroller()?.scrollTo({ top: savedScroll })
    savedScroll = null
  }
})

watch([sort, genres, period, compilations], albums.reset)
watch(genres, () => {
  if (artists.count.value !== null) artists.reset()
})
watch([kind, role], ([k, r]) => {
  if (k !== 'artists') return
  if (r === 'main' && artists.count.value === null) artists.reset()
  if (r !== 'main') void loadCredits(r)
})

// Sliding along the rail fires several jumps; only the latest may scroll once its page arrives
let jumpToken = 0
async function jump(list: typeof albums | typeof artists, prefix: string, section: LetterSection) {
  const token = ++jumpToken
  await list.loadTo(section.start + 1)
  await nextTick()
  if (token === jumpToken) document.getElementById(`${prefix}-${section.start}`)?.scrollIntoView({ block: 'start' })
}

function chooseSort() {
  actionSheet.value = {
    title: 'Sort albums by',
    actions: SORTS.map((s): SheetAction => ({ label: s.label, selected: sort.value === s.id, run: () => (sort.value = s.id) })),
  }
}

function chooseRole() {
  actionSheet.value = {
    title: 'Show',
    subtitle: 'Composers and other artists leave out anyone with albums of their own',
    actions: ROLES.map((r): SheetAction => ({ label: r.label, selected: role.value === r.id, run: () => (role.value = r.id) })),
  }
}

// Filters that apply to what's showing: artists lists have only genres, and credits lists no filters at all
const activeGenres = computed(() => (kind.value === 'albums' || role.value === 'main' ? genres.value : []))
const activeLabel = computed(() =>
  [
    activeGenres.value.length ? genreLabel.value : '',
    kind.value === 'albums' ? periodLabel.value : '',
    kind.value === 'albums' && compilations.value ? 'Compilations' : '',
  ]
    .filter(Boolean)
    .join(' · '),
)
const activeCount = computed(
  () => activeGenres.value.length + (kind.value === 'albums' ? Number(Boolean(period.value)) + Number(compilations.value) : 0),
)
function clearFilters() {
  if (kind.value === 'albums') applyFilters({ genres: [], period: null, compilations: false })
  else genres.value = []
}

// Replacing the queue with a whole slice of the library, so a room with something queued is asked first
function replacingQueue(what: string, run: () => Promise<void>) {
  if (!getters.queueTotal.value) return void run()
  confirmSheet.value = {
    title: `Replace the queue on ${getters.activeLabel.value}?`,
    message: `${what}. The ${getters.queueTotal.value} tracks queued now are removed.`,
    confirmLabel: 'Replace queue',
    run,
  }
}

function reportStart(ok: boolean, message: string) {
  showToast(ok ? message : 'Pick a room in Rooms first')
}

async function withLibraryTarget(run: (target: PlayTarget) => Promise<void> | void) {
  try {
    const target = await libraryTarget({ genreId: genreIds.value, period: period.value, compilations: compilations.value })
    if (!target) return showToast('Nothing to play')
    await run(target)
  } catch {
    showToast("Couldn't reach the server")
  }
}

// Plays what the album grid shows, or the whole library when nothing filters it
function playLibrary(shuffle: boolean | 'albums') {
  const scope = activeLabel.value || 'your library'
  const how = shuffle === 'albums' ? 'Shuffles ' + scope + ' album by album' : shuffle ? `Shuffles ${scope} song by song` : `Plays ${scope}`
  replacingQueue(how, () =>
    withLibraryTarget(async (target) => {
      const ok = await actions.playItems('load', target, { shuffle })
      reportStart(ok, `${shuffle ? 'Shuffling' : 'Playing'} on ${getters.activeLabel.value}`)
    }),
  )
}

function libraryMore() {
  void withLibraryTarget((target) =>
    openActions(
      target,
      { title: activeLabel.value || 'Your library' },
      { extra: [{ label: 'Shuffle albums', icon: 'album', run: () => playLibrary('albums') }] },
    ),
  )
}

// RandomPlay can be limited to genres but not to years or compilations
function startMix(mix: (typeof MIXES)[number]['kind']) {
  replacingQueue('An endless mix keeps adding random tracks until you stop it', async () => {
    try {
      const ok = await actions.randomMix(mix, activeGenres.value.map((g) => g.genre))
      reportStart(ok, `Endless mix on ${getters.activeLabel.value}`)
    } catch {
      showToast("Couldn't reach the server")
    }
  })
}

function stopMix() {
  actions
    .randomMix('disable')
    .then((ok) => reportStart(ok, 'Endless mix stopped'))
    .catch(() => showToast("Couldn't reach the server"))
}

function chooseMix() {
  if (mixOn.value) {
    actionSheet.value = { title: 'Endless mix', actions: [{ label: 'Stop endless mix', icon: 'close', run: stopMix }] }
    return
  }
  const scope = activeGenres.value.length ? `from ${genreLabel.value}` : 'from your whole library'
  const ignored = kind.value === 'albums' && (period.value || compilations.value) ? ' · only genre filters apply' : ''
  actionSheet.value = {
    title: 'Endless mix',
    subtitle: `Keeps adding random tracks ${scope}${ignored}`,
    actions: MIXES.map((m) => ({ label: m.label, icon: 'shuffle', run: () => startMix(m.kind) })),
  }
}

onMounted(() => {
  albums.reset()
  canRandomPlay()
    .then((ok) => (randomAvailable.value = ok))
    .catch(() => undefined)
})

const chip = 'flex min-h-9 shrink-0 items-center gap-1 rounded-full border px-3 text-sm'
const chipOn = 'border-accent text-accent'
const chipOff = 'border-neutral-700 text-neutral-300'
</script>

<template>
  <div ref="root">
    <div class="flex items-center justify-between gap-2 px-4 pt-4">
      <div class="flex rounded-full bg-neutral-900 p-1" role="group" aria-label="Show">
        <button
          v-for="k in ['albums', 'artists'] as const"
          :key="k"
          type="button"
          class="min-h-9 rounded-full px-4 text-sm font-medium capitalize"
          :class="kind === k ? 'bg-neutral-700 text-neutral-50' : 'text-neutral-400'"
          :aria-pressed="kind === k"
          @click="kind = k"
        >
          {{ k }}
        </button>
      </div>
      <button v-if="randomAvailable || mixOn" type="button" :class="[chip, mixOn ? chipOn : chipOff]" @click="chooseMix">
        <Icon name="repeat" class="size-4" /> {{ mixOn ? 'Endless mix on' : 'Endless mix' }}
      </button>
    </div>

    <!-- Sorting and "show" choices are plain text with their own icon; the filters button follows the divider -->
    <div class="flex items-center gap-2 overflow-x-auto px-4 py-3">
      <button
        v-if="kind === 'albums'"
        type="button"
        class="flex min-h-9 shrink-0 items-center gap-1.5 pr-1 text-sm font-medium text-neutral-200"
        @click="chooseSort"
      >
        <Icon name="sort" class="size-5 text-neutral-400" /><span class="sr-only">Sort by</span>{{ sortLabel }}
        <Icon name="expandMore" class="size-4 text-neutral-400" />
      </button>
      <button
        v-if="kind === 'artists'"
        type="button"
        class="flex min-h-9 shrink-0 items-center gap-1.5 pr-1 text-sm font-medium text-neutral-200"
        @click="chooseRole"
      >
        <Icon name="person" class="size-5 text-neutral-400" /><span class="sr-only">Show</span>{{ roleLabel }}
        <Icon name="expandMore" class="size-4 text-neutral-400" />
      </button>
      <span
        v-if="kind === 'albums' || role === 'main'"
        class="h-6 w-px shrink-0 bg-neutral-700"
        aria-hidden="true"
      />
      <button
        v-if="kind === 'albums' || role === 'main'"
        type="button"
        :class="[chip, activeCount ? chipOn : chipOff]"
        @click="picking = kind === 'albums' ? 'filters' : 'genre'"
      >
        <Icon name="filter" class="size-4" /> {{ kind === 'albums' ? 'Filters' : 'Genre' }}
        <span v-if="activeCount" class="tabular-nums">· {{ activeCount }}<span class="sr-only"> on</span></span>
      </button>
    </div>

    <template v-if="kind === 'albums'">
      <PlayBar
        :more-label="`More for ${activeLabel || 'your library'}`"
        @play="playLibrary(false)"
        @shuffle="playLibrary(true)"
        @more="libraryMore"
      />
      <!-- Filters live in a sheet, so what they narrow the list to is spelled out here -->
      <div v-if="filtered" class="flex items-center gap-2 pb-2 pl-4 pr-2 text-sm text-neutral-400">
        <p class="min-w-0 flex-1 truncate">
          <span class="text-neutral-200">{{ activeLabel }}</span>
          <template v-if="albums.count.value !== null"> · {{ albums.count.value }} {{ albums.count.value === 1 ? 'album' : 'albums' }}</template>
        </p>
        <button type="button" class="min-h-11 shrink-0 rounded-full px-3 font-medium text-neutral-300 active:bg-neutral-800" @click="clearFilters">
          Clear
        </button>
      </div>
      <section
        v-for="g in albumGroups"
        :key="g.section?.start ?? 'all'"
        :aria-labelledby="g.section ? `albums-${g.section.start}` : undefined"
      >
        <h3
          v-if="g.section"
          :id="`albums-${g.section.start}`"
          class="sticky top-0 z-5 bg-neutral-950/95 px-4 py-1.5 text-sm font-semibold text-accent backdrop-blur"
        >
          {{ g.section.letter }}
        </h3>
        <ul
          class="grid grid-cols-2 gap-x-4 gap-y-5 pb-5 pl-4 @md:grid-cols-3 @2xl:grid-cols-4 @4xl:grid-cols-5 @6xl:grid-cols-6"
          :class="g.section ? 'pr-10' : 'pr-4'"
        >
          <li v-for="a in g.items" :key="a.id">
            <AlbumTile :album="a" />
          </li>
        </ul>
      </section>
      <p v-if="albums.done.value && !albums.items.value.length" class="px-4 py-10 text-center text-neutral-400">
        No albums match
      </p>
      <p v-else-if="recentCapped" class="px-4 pb-4 text-center text-sm text-neutral-400">
        The {{ albums.count.value }} most recently added albums. LMS sets how many in Settings › Interface.
      </p>
      <LoadMore :loading="albums.loading.value" :error="albums.error.value" :done="albums.done.value" @more="albums.more" />
      <LetterRail v-if="albumSections.length > 1" :sections="albumSections" @jump="jump(albums, 'albums', $event)" />
    </template>

    <template v-else-if="role === 'main'">
      <div v-if="activeLabel" class="flex items-center gap-2 pb-2 pl-4 pr-2 text-sm text-neutral-400">
        <p class="min-w-0 flex-1 truncate">
          <span class="text-neutral-200">{{ activeLabel }}</span>
          <template v-if="artists.count.value !== null"> · {{ artists.count.value }} artists</template>
        </p>
        <button type="button" class="min-h-11 shrink-0 rounded-full px-3 font-medium text-neutral-300 active:bg-neutral-800" @click="clearFilters">
          Clear
        </button>
      </div>
      <p v-else-if="artists.count.value !== null" class="px-4 pb-2 text-sm text-neutral-400">
        {{ artists.count.value }} artists
      </p>
      <section
        v-for="g in artistGroups"
        :key="g.section?.start ?? 'all'"
        :aria-labelledby="g.section ? `artists-${g.section.start}` : undefined"
      >
        <h3
          v-if="g.section"
          :id="`artists-${g.section.start}`"
          class="sticky top-0 z-5 bg-neutral-950/95 px-4 py-1.5 text-sm font-semibold text-accent backdrop-blur"
        >
          {{ g.section.letter }}
        </h3>
        <ul :class="{ 'pr-6': g.section }">
          <li v-for="a in g.items" :key="a.id">
            <ArtistRow :artist="a" />
          </li>
        </ul>
      </section>
      <LoadMore :loading="artists.loading.value" :error="artists.error.value" :done="artists.done.value" @more="artists.more" />
      <LetterRail v-if="artistSections.length > 1" :sections="artistSections" @jump="jump(artists, 'artists', $event)" />
    </template>

    <template v-else>
      <p v-if="creditsError" class="flex items-center justify-center gap-3 px-4 py-10 text-sm text-neutral-400">
        Couldn't load {{ roleLabel?.toLowerCase() }}
        <button type="button" class="min-h-11 rounded-full bg-neutral-800 px-4 text-neutral-100" @click="loadCredits(role as CreditRole)">
          Retry
        </button>
      </p>
      <p v-else-if="!credits[role]" class="px-4 py-10 text-center text-neutral-400">Loading…</p>
      <template v-else>
        <p class="px-4 pb-2 text-sm text-neutral-400">{{ credits[role]?.length }} {{ roleLabel?.toLowerCase() }}</p>
        <section
          v-for="g in creditGroups"
          :key="g.section?.start ?? 'all'"
          :aria-labelledby="g.section ? `credits-${g.section.start}` : undefined"
        >
          <h3
            v-if="g.section"
            :id="`credits-${g.section.start}`"
            class="sticky top-0 z-5 bg-neutral-950/95 px-4 py-1.5 text-sm font-semibold text-accent backdrop-blur"
          >
            {{ g.section.letter }}
          </h3>
          <ul :class="{ 'pr-6': g.section }">
            <li v-for="a in g.items" :key="a.id">
              <ArtistRow :artist="a" :role="role" />
            </li>
          </ul>
        </section>
        <LetterRail v-if="creditSections.length > 1" :sections="creditSections" @jump="jumpCredits" />
      </template>
    </template>

    <FiltersSheet v-if="picking === 'filters'" :selected="albumFilters" @pick="applyFilters" @close="picking = null" />
    <GenreSheet v-if="picking === 'genre'" :selected="genres" @pick="genres = $event" @close="picking = null" />
  </div>
</template>
