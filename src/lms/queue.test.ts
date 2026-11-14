import { describe, expect, it } from 'vitest'
import { movedIndex, occurrenceKeys } from './queue'

describe('movedIndex', () => {
  it('follows the current track when it is the one moved', () => {
    expect(movedIndex(2, 2, 5)).toBe(5)
  })
  it('shifts up when a track from above moves below it', () => {
    expect(movedIndex(3, 1, 4)).toBe(2)
    expect(movedIndex(3, 1, 3)).toBe(2)
  })
  it('shifts down when a track from below moves above it', () => {
    expect(movedIndex(3, 5, 0)).toBe(4)
    expect(movedIndex(3, 5, 3)).toBe(4)
  })
  it('stays when the move happens entirely on one side', () => {
    expect(movedIndex(3, 0, 2)).toBe(3)
    expect(movedIndex(3, 4, 6)).toBe(3)
  })
})

describe('occurrenceKeys', () => {
  it('numbers repeats of the same id', () => {
    expect(occurrenceKeys([7, 8, 7, 7])).toEqual(['7:0', '8:0', '7:1', '7:2'])
  })
})
