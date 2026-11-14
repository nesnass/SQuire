// Back (browser button, Android back, iOS edge swipe) closes the topmost thing the user can see: the top sheet,
// else the top level of the current tab. Tabs are not history entries.
//
// History holds at most one entry of ours above the page's own, present while anything closable is open.
// One entry per layer would have to be kept in step with history.back(), which completes later and would race
// with a layer opened in the same tick (an action sheet handing over to a confirm sheet).

export interface Layer {
  close: () => void
  // Stack levels in a hidden tab stay open but must not be closed by Back
  active: () => boolean
}

export interface HistoryApi {
  readonly state: unknown
  pushState(data: unknown, unused: string): void
  back(): void
}

export function createHistory(history: HistoryApi, target: Pick<Window, 'addEventListener'>) {
  const layers: Layer[] = []
  // Whether our entry is the current one; a reload can land on it with nothing open
  let armed = Boolean((history.state as { squire?: unknown } | null)?.squire)
  // A popstate we caused by removing our entry; it must not close anything
  let unwinding = false
  let scheduled = false

  function topActive(): Layer | undefined {
    for (let i = layers.length - 1; i >= 0; i--) if (layers[i].active()) return layers[i]
    return undefined
  }

  function sync() {
    const wanted = Boolean(topActive())
    if (wanted && !armed) {
      history.pushState({ squire: 1 }, '')
      armed = true
    } else if (!wanted && armed && !unwinding) {
      unwinding = true
      history.back()
    }
  }

  // Deferred so a layer closing and another opening in the same tick reuse the entry
  function scheduleSync() {
    if (scheduled) return
    scheduled = true
    queueMicrotask(() => {
      scheduled = false
      sync()
    })
  }

  target.addEventListener('popstate', () => {
    armed = false
    if (unwinding) unwinding = false
    else topActive()?.close()
    scheduleSync()
  })

  // Landed on our entry after a reload, with nothing open yet
  if (armed) scheduleSync()

  return {
    // Returns the release to call when the layer closes by other means (a Back button, a drag, Escape)
    open(layer: Layer): () => void {
      layers.push(layer)
      scheduleSync()
      return () => {
        const i = layers.indexOf(layer)
        if (i < 0) return
        layers.splice(i, 1)
        scheduleSync()
      }
    },
    // After a tab switch, which changes which stack levels are active
    sync: scheduleSync,
  }
}

const shared = typeof window === 'undefined' ? null : createHistory(window.history, window)

export function openLayer(layer: Layer): () => void {
  return shared?.open(layer) ?? (() => undefined)
}

export function syncLayers(): void {
  shared?.sync()
}
