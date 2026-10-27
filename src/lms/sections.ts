import type { LetterIndex } from './types'

export interface LetterSection {
  letter: string
  // Position of the section's first item in the full list
  start: number
  count: number
}

export interface SectionGroup<T> {
  section: LetterSection | null
  items: T[]
}

// Digits and symbols are folded into '#', as iOS does, so the rail stays short; LMS lists them before letters
export function letterSections(index: LetterIndex | undefined): LetterSection[] {
  const sections: LetterSection[] = []
  let start = 0
  for (const [key, count] of index ?? []) {
    const letter = /^\p{L}/u.test(key) ? key.toLocaleUpperCase() : '#'
    const last = sections.at(-1)
    if (last?.letter === letter) last.count += count
    else sections.push({ letter, start, count })
    start += count
  }
  return sections
}

// Splits the items loaded so far into their sections; without an index everything is one unlabelled group
export function groupBySection<T>(items: T[], sections: LetterSection[]): SectionGroup<T>[] {
  if (!sections.length) return items.length ? [{ section: null, items }] : []
  return sections
    .filter((s) => s.start < items.length)
    .map((s) => ({ section: s, items: items.slice(s.start, s.start + s.count) }))
}
