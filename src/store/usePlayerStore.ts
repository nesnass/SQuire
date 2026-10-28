import { ref, computed } from 'vue'
import { createStore } from './dev-store'
import { lmsCommand, lmsQuery } from '@/lms/client'
import type { LmsCommand, Player, PlayersResponse, PlayTarget, StatusResponse, SyncGroupsResponse, Track } from '@/lms/types'

const TRACK_TAGS = 'tags:acdlKorITuxN'
const POLL_MS = 2000
const QUEUE_PAGE = 200
const PLAYER_KEY = 'squire.playerId'
// Kept on the server as a player pref so a disabled player stays disabled on every device
const DISABLED_PREF = 'plugin.squire:disabled'
const DISABLED_POLL_MS = 30_000

export interface RoomMember {
  id: string
  name: string
  volume: number
  connected: boolean
}

// A room is a single player or an LMS sync group; synced players share one playlist
export interface Room {
  id: string
  members: RoomMember[]
  label: string
  status?: StatusResponse
  track?: Track
  isPlaying: boolean
  volume: number
}

export interface DisabledPlayer {
  id: string
  name: string
  isPlaying: boolean
}

interface Snapshot {
  status: StatusResponse
  fetchedAt: number
}

function readSavedPlayer(): string | null {
  try {
    return localStorage.getItem(PLAYER_KEY)
  } catch {
    return null
  }
}

function roomLabel(names: string[]): string {
  return names.length > 1 ? `${names[0]} +${names.length - 1}` : (names[0] ?? '')
}

function usePlayerStore() {
  const players = ref<Player[]>([])
  const syncGroups = ref<string[][]>([])
  const snapshots = ref<Record<string, Snapshot>>({})
  const activeId = ref<string | null>(readSavedPlayer())
  const queue = ref<Track[]>([])
  const error = ref<string | null>(null)
  // null until the first poll settles
  const reachable = ref<boolean | null>(null)
  // A host app can limit the skin to one player, by name
  const focusName = ref<string | null>(null)
  // Players hidden from rooms and never targeted, to avoid playing on the wrong device
  const disabledIds = ref<string[]>([])
  const now = ref(performance.now())

  let queueKey = ''
  let disabledKey = ''
  let disabledAt = 0
  // Polls that started before the latest command are discarded so they can't undo optimistic updates
  let lastMutation = 0
  let started = false

  const focusId = computed(() => players.value.find((p) => p.name === focusName.value)?.playerid ?? null)

  // The host app's own player stays usable even if disabled elsewhere
  function isDisabled(id: string): boolean {
    return id !== focusId.value && disabledIds.value.includes(id)
  }

  const rooms = computed<Room[]>(() => {
    const order = players.value.map((p) => p.playerid)
    const grouped = new Set(syncGroups.value.flat())
    const focus = focusId.value
    const sets = [
      ...syncGroups.value,
      ...order.filter((id) => !grouped.has(id)).map((id) => [id]),
    ]
      .filter((ids) => !focus || ids.includes(focus))
      .map((ids) => ids.filter((id) => !isDisabled(id)))
      .filter((ids) => ids.length)
      .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))

    return sets.map((ids) => {
      const members = ids.map((id) => {
        const player = players.value.find((p) => p.playerid === id)
        const status = snapshots.value[id]?.status
        return {
          id,
          name: player?.name ?? status?.player_name ?? id,
          volume: Math.max(0, status?.['mixer volume'] ?? 0),
          connected: Boolean(player?.connected),
        }
      })
      const status = ids.map((id) => snapshots.value[id]?.status).find(Boolean)
      return {
        id: ids[0],
        members,
        label: roomLabel(members.map((m) => m.name)),
        status,
        track: status?.playlist_loop?.[0],
        isPlaying: status?.mode === 'play',
        volume: Math.max(0, ...members.map((m) => m.volume)),
      }
    })
  })

  const activeRoom = computed(() => rooms.value.find((r) => r.members.some((m) => m.id === activeId.value)))

  const getters = {
    players: computed(() => players.value),
    enabledPlayers: computed(() => players.value.filter((p) => !isDisabled(p.playerid))),
    disabledPlayers: computed<DisabledPlayer[]>(() =>
      players.value
        .filter((p) => isDisabled(p.playerid))
        .map((p) => ({
          id: p.playerid,
          name: p.name,
          isPlaying: snapshots.value[p.playerid]?.status?.mode === 'play',
        })),
    ),
    rooms,
    activeId: computed(() => activeId.value),
    // Plugin menus need a player to answer; any connected one will do before a room is picked
    menuPlayerId: computed(
      () => activeId.value ?? players.value.find((p) => p.connected && !isDisabled(p.playerid))?.playerid ?? null,
    ),
    activeRoom,
    // Active player's name leads, since that's the one the user picked
    activeLabel: computed(() => {
      const room = activeRoom.value
      if (!room) return ''
      const active = room.members.find((m) => m.id === activeId.value)
      return roomLabel([active?.name ?? '', ...room.members.filter((m) => m !== active).map((m) => m.name)])
    }),
    status: computed(() => activeRoom.value?.status),
    queue: computed(() => queue.value),
    error: computed(() => error.value),
    reachable: computed(() => reachable.value),
    anyPlaying: computed(() => rooms.value.some((r) => r.isPlaying)),
    isPlaying: computed(() => activeRoom.value?.isPlaying ?? false),
    currentIndex: computed(() => Number(activeRoom.value?.status?.playlist_cur_index ?? -1)),
    currentTrack: computed(() => activeRoom.value?.track),
    // The Podcasts plugin queues episodes under its own scheme; for those, jumping within the episode beats changing track
    isPodcast: computed(() => Boolean(activeRoom.value?.track?.url?.startsWith('podcast://'))),
    // A live stream: remote with no length. Shows streamed on demand report a duration and keep track controls.
    isRadio: computed(() => {
      const t = activeRoom.value?.track
      return Boolean(t?.remote && !t.url?.startsWith('podcast://') && !activeRoom.value?.status?.duration)
    }),
    duration: computed(() => activeRoom.value?.status?.duration ?? 0),
    position: computed(() => {
      const id = activeRoom.value?.members.find((m) => snapshots.value[m.id])?.id
      const snap = id ? snapshots.value[id] : undefined
      if (!snap) return 0
      const s = snap.status
      const elapsed = s.mode === 'play' ? (now.value - snap.fetchedAt) / 1000 : 0
      const pos = (s.time ?? 0) + elapsed
      return s.duration ? Math.min(pos, s.duration) : pos
    }),
  }

  function patch(ids: string[], update: Partial<StatusResponse>) {
    lastMutation = performance.now()
    for (const id of ids) {
      const snap = snapshots.value[id]
      if (snap) snap.status = { ...snap.status, ...update }
    }
  }

  function memberIds(roomId?: string): string[] {
    const room = roomId ? rooms.value.find((r) => r.id === roomId) : activeRoom.value
    return room?.members.map((m) => m.id) ?? []
  }

  function commandTarget(): string | null {
    return activeId.value
  }

  async function refreshQueue() {
    const id = activeId.value
    const status = activeRoom.value?.status
    if (!id || !status) return
    const key = `${id}:${status.playlist_timestamp}`
    if (key === queueKey) return
    queueKey = key
    const res = await lmsQuery<StatusResponse>(id, ['status', 0, QUEUE_PAGE, TRACK_TAGS])
    if (id === activeId.value) queue.value = res.playlist_loop ?? []
  }

  // Player prefs need a query each, so they're read less often than status; null when skipped
  async function fetchDisabled(ids: string[]): Promise<string[] | null> {
    const key = ids.join(',')
    if (key === disabledKey && performance.now() - disabledAt < DISABLED_POLL_MS) return null
    const flags = await Promise.all(
      ids.map((id) =>
        lmsQuery<{ _p2: string | null }>(id, ['playerpref', DISABLED_PREF, '?'])
          .then((r) => r._p2 === '1')
          .catch(() => isDisabled(id)),
      ),
    )
    disabledKey = key
    disabledAt = performance.now()
    return ids.filter((_, i) => flags[i])
  }

  async function refresh() {
    const startedAt = performance.now()
    try {
      const [pl, sg] = await Promise.all([
        lmsQuery<PlayersResponse>('', ['players', 0, 100]),
        lmsQuery<SyncGroupsResponse>('', ['syncgroups', '?']),
      ])
      reachable.value = true
      const connected = (pl.players_loop ?? []).filter((p) => p.connected)
      const [results, disabled] = await Promise.all([
        Promise.all(
          connected.map((p) =>
            lmsQuery<StatusResponse>(p.playerid, ['status', '-', 1, TRACK_TAGS])
              .then((status) => [p.playerid, status] as const)
              .catch(() => null),
          ),
        ),
        fetchDisabled((pl.players_loop ?? []).map((p) => p.playerid)),
      ])
      if (lastMutation > startedAt) return

      players.value = pl.players_loop ?? []
      if (disabled) disabledIds.value = disabled
      syncGroups.value = (sg.syncgroups_loop ?? []).map((g) => g.sync_members.split(','))
      const fetchedAt = performance.now()
      const next: Record<string, Snapshot> = {}
      for (const r of results) if (r) next[r[0]] = { status: r[1], fetchedAt }
      snapshots.value = next
      error.value = null

      const ids = players.value.map((p) => p.playerid)
      const focus = focusId.value
      if (focus && activeId.value !== focus) {
        actions.selectPlayer(focus)
      } else if (!activeId.value || !ids.includes(activeId.value) || isDisabled(activeId.value)) {
        const usable = connected.filter((p) => !isDisabled(p.playerid))
        actions.selectPlayer(usable.find((p) => p.isplaying)?.playerid ?? usable[0]?.playerid ?? null)
      }
      await refreshQueue()
    } catch (e) {
      reachable.value = false
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  async function send(playerId: string | null, command: LmsCommand, refreshAfter = true) {
    if (!playerId) return
    lastMutation = performance.now()
    await lmsCommand(playerId, command)
    if (refreshAfter) await refresh()
  }

  const actions = {
    refresh,
    focus(name: string) {
      focusName.value = name
    },
    start() {
      if (started) return
      started = true
      void refresh()
      setInterval(() => {
        if (document.visibilityState === 'visible') void refresh()
      }, POLL_MS)
      setInterval(() => (now.value = performance.now()), 250)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void refresh()
      })
    },
    selectPlayer(id: string | null) {
      activeId.value = id
      queue.value = []
      queueKey = ''
      try {
        if (id) localStorage.setItem(PLAYER_KEY, id)
      } catch {
        // storage unavailable (private mode); selection just won't persist
      }
      void refreshQueue()
    },
    togglePlay(roomId?: string) {
      const room = roomId ? rooms.value.find((r) => r.id === roomId) : activeRoom.value
      if (!room) return
      const playing = room.isPlaying
      patch(memberIds(room.id), { mode: playing ? 'pause' : 'play' })
      return send(room.members[0].id, playing ? ['pause', 1] : ['play'])
    },
    next: () => send(commandTarget(), ['playlist', 'index', '+1']),
    previous: () => send(commandTarget(), ['playlist', 'index', '-1']),
    playIndex: (index: number) => send(commandTarget(), ['playlist', 'index', index]),
    seek(seconds: number) {
      patch(memberIds(), { time: seconds })
      return send(commandTarget(), ['time', Math.round(seconds)])
    },
    skip(by: number) {
      const duration = activeRoom.value?.status?.duration ?? 0
      const target = Math.max(0, getters.position.value + by)
      return actions.seek(duration ? Math.min(target, duration) : target)
    },
    setVolume(playerId: string, volume: number) {
      const v = Math.round(volume)
      patch([playerId], { 'mixer volume': v })
      return send(playerId, ['mixer', 'volume', v], false)
    },
    // Nudges the active player, as hardware volume buttons do
    stepVolume(by: number) {
      const id = activeId.value
      if (!id) return
      const current = Math.max(0, snapshots.value[id]?.status?.['mixer volume'] ?? 0)
      return actions.setVolume(id, Math.min(100, Math.max(0, current + by)))
    },
    toggleShuffle() {
      const next = activeRoom.value?.status?.['playlist shuffle'] ? 0 : 1
      patch(memberIds(), { 'playlist shuffle': next })
      return send(commandTarget(), ['playlist', 'shuffle', next])
    },
    // LMS repeat values: 0 off, 1 track, 2 playlist; cycled off → playlist → track
    cycleRepeat() {
      const current = activeRoom.value?.status?.['playlist repeat'] ?? 0
      const next = current === 0 ? 2 : current === 2 ? 1 : 0
      patch(memberIds(), { 'playlist repeat': next })
      return send(commandTarget(), ['playlist', 'repeat', next])
    },
    async pauseAll() {
      const playing = rooms.value.filter((r) => r.isPlaying)
      // Disabled players aren't in rooms, but something else may have started them
      const hidden = getters.disabledPlayers.value.filter((p) => p.isPlaying).map((p) => p.id)
      for (const r of playing) patch(memberIds(r.id), { mode: 'pause' })
      patch(hidden, { mode: 'pause' })
      await Promise.all([...playing.map((r) => r.members[0].id), ...hidden].map((id) => send(id, ['pause', 1], false)))
      await refresh()
    },
    // A disabled player leaves its group and stops, so it can't keep playing out of sight
    async setDisabled(playerId: string, disabled: boolean) {
      const wasPlaying = snapshots.value[playerId]?.status?.mode === 'play'
      const grouped = syncGroups.value.some((g) => g.includes(playerId))
      lastMutation = performance.now()
      disabledIds.value = disabled
        ? [...new Set([...disabledIds.value, playerId])]
        : disabledIds.value.filter((id) => id !== playerId)
      disabledAt = performance.now()
      await lmsCommand(playerId, ['playerpref', DISABLED_PREF, disabled ? 1 : 0])
      if (disabled && grouped) await send(playerId, ['sync', '-'], false)
      if (disabled && wasPlaying) await send(playerId, ['pause', 1], false)
      await refresh()
    },
    async playAll() {
      const ready = rooms.value.filter((r) => r.members[0].connected && (r.status?.playlist_tracks ?? 0) > 0)
      for (const r of ready) patch(memberIds(r.id), { mode: 'play' })
      await Promise.all(ready.map((r) => send(r.members[0].id, ['play'], false)))
      await refresh()
    },
    // load replaces the queue, insert plays next, add appends. Returns false when no room is selected
    async playItems(
      cmd: 'load' | 'insert' | 'add',
      target: PlayTarget,
      opts: { playIndex?: number; shuffle?: boolean } = {},
    ): Promise<boolean> {
      const id = commandTarget()
      if (!id) return false
      if (opts.shuffle !== undefined) {
        patch(memberIds(), { 'playlist shuffle': opts.shuffle ? 1 : 0 })
        await send(id, ['playlist', 'shuffle', opts.shuffle ? 1 : 0], false)
      }
      if (cmd === 'load') patch(memberIds(), { mode: 'play' })
      // Plugin menu items can be streams or feeds rather than library tracks, so their plugin plays them
      if ('menu' in target) {
        await send(id, [target.menu, 'playlist', cmd === 'load' ? 'play' : cmd, `item_id:${target.item_id}`])
        return true
      }
      const params = Object.entries(target).map(([k, v]) => `${k}:${v}`)
      if (opts.playIndex !== undefined) params.push(`play_index:${opts.playIndex}`)
      await send(id, ['playlistcontrol', `cmd:${cmd}`, ...params])
      return true
    },
    // Makes `selected` the set of players in `roomId`'s group. Players are added before others leave,
    // so moving playback to an entirely different set of rooms keeps the playlist
    async applyOutputs(roomId: string, selected: string[]) {
      const current = memberIds(roomId)
      if (!selected.length || !current.length) return
      const anchor = current.find((id) => selected.includes(id)) ?? current[0]
      for (const id of selected.filter((id) => !current.includes(id))) {
        await send(anchor, ['sync', id], false)
      }
      for (const id of current.filter((id) => !selected.includes(id))) {
        await send(id, ['sync', '-'], false)
      }
      if (activeId.value && current.includes(activeId.value) && !selected.includes(activeId.value)) {
        actions.selectPlayer(selected[0])
      }
      await refresh()
    },
  }

  return { getters, actions }
}

export default createStore('player', usePlayerStore)
