import { describe, expect, it } from 'vitest'
import { createHistory, type Layer } from './history'

// A browser history where back() lands later, as it does in a browser
function fakeBrowser(initialState: unknown = null) {
  const entries: unknown[] = [initialState]
  let index = 0
  let listener: (() => void) | null = null
  const history = {
    get state() {
      return entries[index]
    },
    pushState(data: unknown, _unused?: string) {
      entries.splice(index + 1, Infinity, data)
      index++
    },
    back() {
      setTimeout(() => {
        if (index === 0) return
        index--
        listener?.()
      })
    },
  }
  const target = {
    addEventListener: (_: string, fn: () => void) => {
      listener = fn
    },
  } as unknown as Pick<Window, 'addEventListener'>
  return { history, target, depth: () => index }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

function layer(active = true) {
  const l = { closed: 0, active, release: () => undefined as void }
  const def: Layer = {
    close: () => {
      l.closed++
      l.release()
    },
    active: () => l.active,
  }
  return { l, def }
}

describe('history layers', () => {
  it('adds one entry however many layers are open', async () => {
    const b = fakeBrowser()
    const h = createHistory(b.history, b.target)
    h.open(layer().def)
    h.open(layer().def)
    await settle()
    expect(b.depth()).toBe(1)
  })

  it('back closes only the top layer and keeps an entry for the rest', async () => {
    const b = fakeBrowser()
    const h = createHistory(b.history, b.target)
    const lower = layer()
    const upper = layer()
    lower.l.release = h.open(lower.def)
    upper.l.release = h.open(upper.def)
    await settle()
    b.history.back()
    await settle()
    await settle()
    expect([lower.l.closed, upper.l.closed]).toEqual([0, 1])
    expect(b.depth()).toBe(1)
  })

  it('removes its entry when the last layer closes from the UI', async () => {
    const b = fakeBrowser()
    const h = createHistory(b.history, b.target)
    const release = h.open(layer().def)
    await settle()
    release()
    await settle()
    await settle()
    expect(b.depth()).toBe(0)
  })

  it('keeps the entry when a layer hands over to another in the same tick', async () => {
    const b = fakeBrowser()
    const h = createHistory(b.history, b.target)
    const release = h.open(layer().def)
    await settle()
    release()
    const next = layer()
    next.l.release = h.open(next.def)
    await settle()
    await settle()
    expect(b.depth()).toBe(1)
    b.history.back()
    await settle()
    expect(next.l.closed).toBe(1)
  })

  it('skips layers that are not active, such as a hidden tab', async () => {
    const b = fakeBrowser()
    const h = createHistory(b.history, b.target)
    const hidden = layer(false)
    h.open(hidden.def)
    await settle()
    expect(b.depth()).toBe(0)
    hidden.l.active = true
    h.sync()
    await settle()
    expect(b.depth()).toBe(1)
  })

  it('does nothing on a stray back with nothing open', async () => {
    const b = fakeBrowser()
    createHistory(b.history, b.target)
    b.history.pushState({ other: 1 }, '')
    b.history.back()
    await settle()
    expect(b.depth()).toBe(0)
  })

  it('drops an entry left over from before a reload', async () => {
    const b = fakeBrowser({ squire: 1 })
    const h = createHistory(b.history, b.target)
    b.history.pushState({ squire: 1 }, '')
    h.sync()
    await settle()
    await settle()
    expect(b.depth()).toBe(0)
  })
})
