<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { CREDIT_ROLE_IDS, creditedOnly, type CreditRole } from '@/lms/credits'
import {
  canRandomPlay,
  fetchAlbumArtistRole,
  fetchAlbums,
  fetchAllArtists,
  fetchDecadeAlbums,
  fetchGenres,
  fetchYears,
  fetchArtists,
  type AlbumSort,
} from '@/lms/library'
import { groupBySection, indexOf, letterSections, type LetterSection } from '@/lms/sections'
import type { Artist, Genre, PlayTarget } from '@/lms/types'
import usePlayerStore from '@/store/usePlayerStore'
import Icon from '../Icon.vue'
import { actionSheet, confirmSheet, showToast, type SheetAction } from '../overlays'
import AlbumTile from './AlbumTile.vue'
import ArtistRow from './ArtistRow.vue'
import GenreSheet from './GenreSheet.vue'
import LetterRail from './LetterRail.vue'
import LoadMore from './LoadMore.vue'
import PlayBar from './PlayBar.vue'
import { usePlayActions } from './playActions'
import { usePaged } from './usePaged'
import YearSheet, { type Period } from './YearSheet.vue'

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
const role = ref<Role>('main')
const picking = ref<'genre' | 'year' | null>(null)
const randomAvailable = ref(false)
const root = ref<HTMLElement | null>(null)

// The letter index comes with the first page; "Recently added" has no alphabetical order to index
const albums = usePaged((start, n) =>
  period.value?.decade
    ? fetchDecadeAlbums(period.value.value, { sort: sort.value, genreId: genreIds.value })
    : fetchAlbums(start, n, {
    sort: sort.value,
    withIndex: start === 0 && sort.value !== 'new',
    genreId: genreIds.value,
    year: year.value ?? undefined,
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

const filtered = computed(() => Boolean(genres.value.length || period.value))
// LMS plays one year at a time, so a decade has no play-all
const filterTarget = computed<PlayTarget | null>(() => {
  if (period.value?.decade) return null
  if (genreIds.value) return { genre_id: genreIds.value, ...(year.value ? { year: year.value } : {}) }
  return year.value ? { year: year.value } : null
})
const filterTitle = computed(() => [genreLabel.value, periodLabel.value].filter(Boolean).join(' · '))
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

watch([sort, genres, period], albums.reset)
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

// Filters that apply to what's showing: artists lists have no year filter, and credits lists no filters at all
const activeGenres = computed(() => (kind.value === 'albums' || role.value === 'main' ? genres.value : []))
const activePeriod = computed(() => (kind.value === 'albums' ? period.value : null))
const shuffleScope = computed(
  () => [activeGenres.value.length ? genreLabel.value : '', activePeriod.value ? periodLabel.value : ''].filter(Boolean).join(' · ') ||
    'your library',
)

// What to queue for the active filters. LMS takes one year per command, so a decade is one target per year;
// with no filter, every genre stands in for the whole library
async function shuffleTargets(): Promise<PlayTarget[]> {
  const ids = activeGenres.value.length ? genreIds.value : (await fetchGenres()).map((g) => g.id).join(',')
  const p = activePeriod.value
  if (!p) return ids ? [{ genre_id: ids }] : []
  const years = p.decade ? (await fetchYears()).filter((y) => y >= p.value && y < p.value + 10) : [p.value]
  return years.map((year) => (ids && activeGenres.value.length ? { genre_id: ids, year } : { year }))
}

// Both replace the queue, so a room with something queued is asked first
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

function shuffle(by: 'songs' | 'albums') {
  replacingQueue(`Shuffles ${shuffleScope.value} ${by === 'albums' ? 'album by album' : 'song by song'}`, async () => {
    try {
      const targets = await shuffleTargets()
      if (!targets.length) return showToast('Nothing to shuffle')
      reportStart(await actions.shuffleAll(targets, by), `Shuffling on ${getters.activeLabel.value}`)
    } catch {
      showToast("Couldn't reach the server")
    }
  })
}

// RandomPlay can be limited to genres but not to years
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
  const scope = activeGenres.value.length ? `from ${genreLabel.value}` : 'from your whole library'
  actionSheet.value = {
    title: 'Endless mix',
    subtitle: `Keeps adding random tracks ${scope}${activePeriod.value ? ' · year filters don’t apply' : ''}`,
    actions: MIXES.map((m) => ({ label: m.label, icon: 'shuffle', run: () => startMix(m.kind) })),
  }
}

function chooseShuffle() {
  const options: SheetAction[] = [
    { label: 'Shuffle songs', icon: 'shuffle', run: () => shuffle('songs') },
    { label: 'Shuffle albums', icon: 'album', run: () => shuffle('albums') },
  ]
  if (mixOn.value) options.push({ label: 'Stop endless mix', icon: 'close', run: stopMix })
  else if (randomAvailable.value) options.push({ label: 'Endless mix…', icon: 'repeat', run: chooseMix })
  actionSheet.value = { title: `Shuffle ${shuffleScope.value}`, actions: options }
}

function filterMore() {
  const target = filterTarget.value
  if (target) openActions(target, { title: filterTitle.value })
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
      <!-- Shuffles whatever the filters below select; its sheet title names it -->
      <button type="button" :class="[chip, mixOn ? chipOn : chipOff]" @click="chooseShuffle">
        <Icon name="shuffle" class="size-4" /> {{ mixOn ? 'Endless mix on' : 'Shuffle' }}
      </button>
    </div>

    <!-- Sorting and "show" choices are plain text with their own icon; filters are the pills after the divider -->
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
      <div v-if="kind === 'albums' || role === 'main'" class="flex gap-2" role="group" aria-label="Filters">
        <span v-if="genres.length" :class="[chip, chipOn, 'pr-0']">
          <button type="button" class="flex items-center gap-1" @click="picking = 'genre'">
            <span class="sr-only">Genre:</span>{{ genreLabel }}
          </button>
          <button type="button" class="grid size-9 place-items-center" :aria-label="`Clear genre ${genreLabel}`" @click="genres = []">
            <Icon name="close" class="size-4" />
          </button>
        </span>
        <button v-else type="button" :class="[chip, chipOff]" @click="picking = 'genre'">
          Genre <Icon name="expandMore" class="size-4" />
        </button>
        <template v-if="kind === 'albums'">
        <span v-if="period" :class="[chip, chipOn, 'pr-0']">
          <button type="button" class="flex items-center gap-1 tabular-nums" @click="picking = 'year'">
            <span class="sr-only">Year:</span>{{ periodLabel }}
          </button>
          <button type="button" class="grid size-9 place-items-center" :aria-label="`Clear year ${periodLabel}`" @click="period = null">
            <Icon name="close" class="size-4" />
          </button>
        </span>
        <button v-else type="button" :class="[chip, chipOff]" @click="picking = 'year'">
          Year <Icon name="expandMore" class="size-4" />
        </button>
        </template>
      </div>
    </div>

    <template v-if="kind === 'albums'">
      <template v-if="filtered">
        <PlayBar v-if="filterTarget" :target="filterTarget" :more-label="`More for ${filterTitle}`" @more="filterMore" />
        <p v-if="albums.count.value !== null" class="px-4 pb-3 text-sm text-neutral-400">
          {{ albums.count.value }} {{ albums.count.value === 1 ? 'album' : 'albums' }}
        </p>
      </template>
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
      <p v-if="artists.count.value !== null" class="px-4 pb-2 text-sm text-neutral-400">
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

    <GenreSheet v-if="picking === 'genre'" :selected="genres" @pick="genres = $event" @close="picking = null" />
    <YearSheet v-if="picking === 'year'" :selected="period" @pick="period = $event" @close="picking = null" />
  </div>
</template>
