import { describe, expect, it } from 'vitest'
import { appearsOn, creditedOnly } from './credits'

const artist = (id: number, name = `A${id}`) => ({ id, artist: name })

describe('creditedOnly', () => {
  it('drops anyone who is also an album artist, and the blank-tag placeholder', () => {
    const composers = [artist(1), artist(2), artist(3, '<?>'), artist(4)]
    expect(creditedOnly(composers, [artist(2), artist(9)]).map((a) => a.id)).toEqual([1, 4])
  })
})

describe('appearsOn', () => {
  it('keeps albums that are not the artist own, in order', () => {
    expect(appearsOn([{ id: 5 }, { id: 6 }, { id: 7 }], [{ id: 6 }])).toEqual([{ id: 5 }, { id: 7 }])
  })
})
