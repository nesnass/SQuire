import { inject, type InjectionKey } from 'vue'
import type { Album, MenuItem, Playlist } from '@/lms/types'

export type Route =
  | { kind: 'artist'; id: number; name: string }
  | { kind: 'album'; album: Album }
  | { kind: 'playlist'; playlist: Playlist }
  | { kind: 'favorites'; id: string; name: string }
  | { kind: 'podcast'; show: MenuItem }
  | { kind: 'podcastSearch' }
  | { kind: 'radioSources' }
  // Any plugin menu level, e.g. a radio directory or the podcast plugin's own lists
  | { kind: 'menu'; menu: string; title: string; itemId?: string; search?: string }

export interface Nav {
  push(route: Route): void
  pop(): void
}

export const NAV: InjectionKey<Nav> = Symbol('nav')

export function useNav(): Nav {
  const nav = inject(NAV)
  if (!nav) throw new Error('useNav() used outside a StackView')
  return nav
}

// Smooth scrolling over a long distance is motion some people need to avoid
export function scrollBehavior(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
}
