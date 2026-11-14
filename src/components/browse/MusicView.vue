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
  type AlbumSort,
} from '@/lms/library'
import { groupBySection, letterSections, type LetterSection } from '@/lms/sections'
import type { Artist, Genre, PlayTarget } from '@/lms/types'
import usePlayerStore from '@/store/usePlayerStore'
import Icon from '../Icon.vue'
import { actionSheet, showToast, type SheetAction } from '../overlays'
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
  { kind: 'tracks', label: 'Random songs' },
  { kind: 'albums', label: 'Random albums' },
  { kind: 'contributors', label: 'Random artists' },
] as const

const { getters, actions } = usePlayerStore()
const { openActions } = usePlayActions()

const kind = ref<Kind>('albums')
const sort = ref<AlbumSort>('new')
const genre = ref<Genre | null>(null)
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
    ? fetchDecadeAlbums(period.value.value, { sort: sort.value, genreId: genre.value?.id })
    : fetchAlbums(start, n, {
    sort: sort.value,
    withIndex: start === 0 && sort.value !== 'new',
    genreId: genre.value?.id,
    year: year.value ?? undefined,
  }),
)
const artists = usePaged(
  async (start, n) =>
    fetchArtists(start, n, { withIndex: start === 0, genreId: genre.value?.id, roleId: await fetchAlbumArtistRole() }),
  200,
)

const albumSections = computed(() => letterSections(albums.index.value))
const albumGroups = computed(() => groupBySection(albums.items.value, albumSections.value))
const artistSections = computed(() => letterSections(artists.index.value))
const artistGroups = computed(() => groupBySection(artists.items.value, artistSections.value))

// Composers and guests: fetched whole once per role and kept for the session
const credits = ref<Partial<Record<Role, Artist[]>>>({})
const creditsError = ref(false)
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

const filtered = computed(() => Boolean(genre.value || period.value))
// LMS plays one year at a time, so a decade has no play-all
const filterTarget = computed<PlayTarget | null>(() => {
  if (period.value?.decade) return null
  if (genre.value) return { genre_id: genre.value.id, ...(year.value ? { year: year.value } : {}) }
  return year.value ? { year: year.value } : null
})
const filterTitle = computed(() => [genre.value?.genre, periodLabel.value].filter(Boolean).join(' · '))
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

watch([sort, genre, period], albums.reset)
watch(genre, () => {
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

function startMix(mix: (typeof MIXES)[number]['kind'] | 'disable') {
  actions
    .randomMix(mix)
    .then((ok) => {
      if (!ok) showToast('Pick a room in Rooms first')
      else showToast(mix === 'disable' ? 'Random mix stopped' : `Random mix on ${getters.activeLabel.value}`)
    })
    .catch(() => showToast("Couldn't reach the server"))
}

function chooseMix() {
  const options: SheetAction[] = MIXES.map((m) => ({ label: m.label, icon: 'shuffle', run: () => startMix(m.kind) }))
  if (mixOn.value) options.unshift({ label: 'Stop random mix', icon: 'close', run: () => startMix('disable') })
  actionSheet.value = {
    title: 'Random mix',
    subtitle: 'Keeps the queue topped up from your library',
    actions: options,
  }
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
      <button v-if="randomAvailable" type="button" :class="[chip, mixOn ? chipOn : chipOff]" @click="chooseMix">
        <Icon name="shuffle" class="size-4" /> {{ mixOn ? 'Random mix on' : 'Random mix' }}
      </button>
    </div>

    <div class="flex gap-2 overflow-x-auto px-4 py-3" role="group" aria-label="Filters">
      <button v-if="kind === 'albums'" type="button" :class="[chip, chipOff]" @click="chooseSort">
        <span class="sr-only">Sort by</span>{{ sortLabel }}
        <Icon name="expandMore" class="size-4" />
      </button>
      <button v-if="kind === 'artists'" type="button" :class="[chip, role === 'main' ? chipOff : chipOn]" @click="chooseRole">
        <span class="sr-only">Show</span>{{ roleLabel }}
        <Icon name="expandMore" class="size-4" />
      </button>
      <template v-if="kind === 'albums' || role === 'main'">
        <span v-if="genre" :class="[chip, chipOn, 'pr-0']">
          <button type="button" class="flex items-center gap-1" @click="picking = 'genre'">
            <span class="sr-only">Genre:</span>{{ genre.genre }}
          </button>
          <button type="button" class="grid size-9 place-items-center" :aria-label="`Clear genre ${genre.genre}`" @click="genre = null">
            <Icon name="close" class="size-4" />
          </button>
        </span>
        <button v-else type="button" :class="[chip, chipOff]" @click="picking = 'genre'">
          Genre <Icon name="expandMore" class="size-4" />
        </button>
      </template>
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
        <ul>
          <li v-for="a in credits[role]" :key="a.id">
            <ArtistRow :artist="a" :role="role" />
          </li>
        </ul>
      </template>
    </template>

    <GenreSheet v-if="picking === 'genre'" :selected="genre?.id" @pick="genre = $event" @close="picking = null" />
    <YearSheet v-if="picking === 'year'" :selected="period" @pick="period = $event" @close="picking = null" />
  </div>
</template>
