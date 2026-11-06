import type { StatusResponse } from './types'

// Longer than a slow stream takes to buffer
const STALL_MS = 15_000

export interface WaitTimes {
  fetchedAt: number
  waitingSince: number | null
}

// LMS keeps mode 'play' until the player reports back, so this alone doesn't mean audio is coming out
export function isWaiting(status: StatusResponse): boolean {
  return status.mode === 'play' && Boolean(status.waitingToPlay)
}

export function waitingSince(status: StatusResponse, previous: number | null, now: number): number | null {
  return isWaiting(status) ? (previous ?? now) : null
}

// Waiting at the very end of a track can't be buffering, so that needs no grace period
export function isStalled(status: StatusResponse, times: WaitTimes): boolean {
  if (!isWaiting(status) || times.waitingSince === null) return false
  const atEnd = Boolean(status.duration) && (status.time ?? 0) >= (status.duration ?? 0)
  return atEnd || times.fetchedAt - times.waitingSince >= STALL_MS
}
