import { computed } from 'vue'
import { matchStation } from '@/lms/format'
import useFavoritesStore from '@/store/useFavoritesStore'
import usePlayerStore from '@/store/usePlayerStore'

export type TransportMode = 'podcast' | 'radio' | 'track'

// What the previous/next controls do for the current item: jump within an episode, step through saved stations, or change track
export function useTransport() {
  const { getters, actions } = usePlayerStore()
  const favorites = useFavoritesStore()

  const mode = computed<TransportMode>(() =>
    getters.isPodcast.value ? 'podcast' : getters.isRadio.value ? 'radio' : 'track',
  )

  const stationIndex = computed(() => {
    const track = getters.currentTrack.value
    return mode.value === 'radio' && track ? matchStation(track, favorites.getters.stations.value) : -1
  })
  // The saved station that's playing, if it is one
  const station = computed(() => (stationIndex.value < 0 ? undefined : favorites.getters.stations.value[stationIndex.value]))

  // Stepping only makes sense from a saved station with somewhere else to go; otherwise the radio controls are hidden
  function stationAt(step: number) {
    const stations = favorites.getters.stations.value
    const i = stationIndex.value
    return i < 0 || stations.length < 2 ? undefined : stations[(i + step + stations.length) % stations.length]
  }

  const previousStation = computed(() => stationAt(-1))
  const nextStation = computed(() => stationAt(1))

  function playStation(step: number) {
    const target = stationAt(step)
    if (target) void actions.playItems('load', { menu: 'favorites', item_id: target.id })
  }

  function previous() {
    if (mode.value === 'podcast') void actions.skip(-15)
    else if (mode.value === 'radio') playStation(-1)
    else void actions.previous()
  }

  function next() {
    if (mode.value === 'podcast') void actions.skip(30)
    else if (mode.value === 'radio') playStation(1)
    else void actions.next()
  }

  return { mode, station, previousStation, nextStation, previous, next }
}
