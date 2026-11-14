// Where the current track ends up after a move, so the highlight follows it before LMS confirms
export function movedIndex(current: number, from: number, to: number): number {
  if (current === from) return to
  if (from < current && to >= current) return current - 1
  if (from > current && to <= current) return current + 1
  return current
}

// Stable keys for lists that can hold the same item twice: the id plus which occurrence of it this is
export function occurrenceKeys(ids: (string | number)[]): string[] {
  const seen = new Map<string | number, number>()
  return ids.map((id) => {
    const n = seen.get(id) ?? 0
    seen.set(id, n + 1)
    return `${id}:${n}`
  })
}
