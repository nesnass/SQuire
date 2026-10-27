import { computed, watch } from 'vue'
import usePlayerStore from '@/store/usePlayerStore'

// LyrPlay (iOS) embeds the skin in a WKWebView and talks to it in Material's terms:
// URL params, messages to the `mskNative` handler, and calls to Material's global names.
// docs/lyrplay-bridge.md has the full contract.

const VOLUME_STEP = 5

export interface HostParams {
  // nativePlayer=w: report player switches to mskNative
  native: boolean
  // nativeConnectionStatus=w: report the server link to mskNative
  connectionStatus: boolean
  // appSettings: a URL the host intercepts to open its own settings
  settings?: { url: string; name: string }
  // player=<name>&single: show and control only this player
  focusPlayer?: string
}

export function parseHostParams(search: string): HostParams {
  const q = new URLSearchParams(search)
  const settingsUrl = q.get('appSettings')
  return {
    native: q.get('nativePlayer') === 'w',
    connectionStatus: q.get('nativeConnectionStatus') === 'w',
    settings: settingsUrl ? { url: settingsUrl, name: q.get('appSettingsName') || 'App settings' } : undefined,
    focusPlayer: q.has('single') ? q.get('player') || undefined : undefined,
  }
}

export function playerMessage(player: { id: string; name?: string; ip?: string }): string {
  return [
    'MATERIAL-PLAYER',
    `ID ${player.id}`,
    ...(player.name ? [`NAME ${player.name}`] : []),
    ...(player.ip ? [`IP ${player.ip}`] : []),
  ].join('\n')
}

// "CONNETION" is Material's spelling, and LyrPlay matches it literally
export function connectionMessage(connected: boolean): string {
  return `MATERIAL-CONNETIONSTATUS\nCONNECTED ${connected}`
}

interface LegacyApp {
  $children: never[]
  cometd: { clearListeners(): void; disconnect(): void }
  connectToCometD(): void
}

declare global {
  interface Window {
    webkit?: { messageHandlers?: { mskNative?: { postMessage(message: string): void } } }
    setCurrentPlayer?: (id: string) => void
    incrementVolume?: () => void
    decrementVolume?: () => void
    bus?: { $emit(event: string, arg?: unknown): void }
    // LyrPlay's reconnect script (MaterialReconnect.swift) looks these up by Material's names
    lmsIsConnected?: boolean
    app?: LegacyApp
  }
}

// globalThis.location is undefined under the Node test runner
export const host = parseHostParams(globalThis.location?.search ?? '')

export function openHostSettings() {
  // The host cancels this navigation and opens its settings instead
  if (host.settings) window.location.href = host.settings.url
}

function post(message: string) {
  window.webkit?.messageHandlers?.mskNative?.postMessage(message)
}

export function installHostBridge() {
  const { getters, actions } = usePlayerStore()

  if (host.focusPlayer) actions.focus(host.focusPlayer)
  if (!host.native) return

  window.setCurrentPlayer = (id) => {
    const match = getters.players.value.find((p) => p.playerid.toLowerCase() === id.toLowerCase())
    actions.selectPlayer(match?.playerid ?? id.toLowerCase())
  }
  window.incrementVolume = () => void actions.stepVolume(VOLUME_STEP)
  window.decrementVolume = () => void actions.stepVolume(-VOLUME_STEP)
  window.bus = {
    $emit(event, arg) {
      if (event === 'refreshStatus') void actions.refresh()
      else if (event === 'adjustVolume') void actions.stepVolume(arg ? VOLUME_STEP : -VOLUME_STEP)
    },
  }
  // Polling has no long-lived request to cut, so a restart is just an immediate poll
  window.app = {
    $children: [],
    cometd: { clearListeners() {}, disconnect() {} },
    connectToCometD: () => void actions.refresh(),
  }

  // Re-sent when the name and IP arrive with the first poll; LyrPlay treats a repeat as no switch
  const report = computed(() => {
    const id = getters.activeId.value
    if (!id) return null
    const player = getters.players.value.find((p) => p.playerid === id)
    return playerMessage({ id, name: player?.name, ip: player?.ip })
  })
  watch(report, (message) => message && post(message), { immediate: true })

  watch(
    getters.reachable,
    (reachable) => {
      if (reachable === null) return
      window.lmsIsConnected = reachable
      if (host.connectionStatus) post(connectionMessage(reachable))
    },
    { immediate: true },
  )
}
