// Tracks open sheets so Escape only closes the topmost one
const stack: symbol[] = []

export function pushSheet(): symbol {
  const id = Symbol('sheet')
  stack.push(id)
  return id
}

export function popSheet(id: symbol): void {
  const i = stack.indexOf(id)
  if (i >= 0) stack.splice(i, 1)
}

export function isTopSheet(id: symbol): boolean {
  return stack[stack.length - 1] === id
}
