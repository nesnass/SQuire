import { describe, expect, it } from 'vitest'
import { isStalled, isWaiting, waitingSince } from './playback'
import type { StatusResponse } from './types'

const waiting: StatusResponse = { mode: 'play', waitingToPlay: 1, time: 12, duration: 200 }

describe('isWaiting', () => {
  it('needs both play mode and the waiting flag', () => {
    expect(isWaiting(waiting)).toBe(true)
    expect(isWaiting({ mode: 'play', time: 12 })).toBe(false)
    expect(isWaiting({ mode: 'pause', waitingToPlay: 1 })).toBe(false)
  })
})

describe('waitingSince', () => {
  it('starts when waiting begins and holds until it ends', () => {
    expect(waitingSince(waiting, null, 100)).toBe(100)
    expect(waitingSince(waiting, 100, 500)).toBe(100)
    expect(waitingSince({ mode: 'play' }, 100, 500)).toBeNull()
  })
})

describe('isStalled', () => {
  it('allows a player time to buffer', () => {
    expect(isStalled(waiting, { fetchedAt: 14_999, waitingSince: 0 })).toBe(false)
  })

  it('gives up on a player that never starts', () => {
    expect(isStalled(waiting, { fetchedAt: 15_000, waitingSince: 0 })).toBe(true)
  })

  it('needs no grace period at the end of a track', () => {
    const ended: StatusResponse = { ...waiting, time: 231.533, duration: 231.533 }
    expect(isStalled(ended, { fetchedAt: 100, waitingSince: 100 })).toBe(true)
  })

  it('ignores a player that is really playing, even at the end of a track', () => {
    const ending: StatusResponse = { mode: 'play', time: 200, duration: 200 }
    expect(isStalled(ending, { fetchedAt: 100_000, waitingSince: null })).toBe(false)
  })

  it('does not treat a stream with no length as ended', () => {
    const stream: StatusResponse = { mode: 'play', waitingToPlay: 1, time: 5 }
    expect(isStalled(stream, { fetchedAt: 100, waitingSince: 100 })).toBe(false)
  })
})
