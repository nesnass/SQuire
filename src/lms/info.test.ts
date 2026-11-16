import { describe, expect, it } from 'vitest'
import { paragraphs } from './info'

describe('paragraphs', () => {
  it('joins wrapped lines and splits on blank lines', () => {
    const text = 'Queen are a British rock band formed in\nLondon in 1970.\n\nTheir earliest works\nwere progressive.'
    expect(paragraphs(text)).toEqual([
      { text: 'Queen are a British rock band formed in London in 1970.', heading: false },
      { text: 'Their earliest works were progressive.', heading: false },
    ])
  })
  it('marks underlined headings and drops the underline', () => {
    expect(paragraphs('Awards\n------\n\nMany.')).toEqual([
      { text: 'Awards', heading: true },
      { text: 'Many.', heading: false },
    ])
  })
  it('handles carriage returns and skips empty blocks', () => {
    expect(paragraphs('One\r\n\r\n\r\n\r\nTwo\r\n')).toEqual([
      { text: 'One', heading: false },
      { text: 'Two', heading: false },
    ])
  })
})
