import { lmsCommand, lmsQuery } from './client'
import type { Page } from './library'
import type { JiveItemsResponse, MenuItem, MenuItemsResponse, RadiosResponse } from './types'

export interface Episode {
  id: string
  title: string
  // Date and length as LMS formats them, e.g. "Wednesday, October 21, 2026 (44:43)"
  detail?: string
  image?: string
}

export interface RadioSource {
  menu: string
  name: string
  icon?: string
}

// Plugin menus are built per player, so every query names one
export async function fetchMenu(
  playerId: string,
  menu: string,
  opts: { itemId?: string; search?: string; start?: number; n?: number } = {},
): Promise<Page<MenuItem> & { title?: string }> {
  const command: (string | number)[] = [menu, 'items', opts.start ?? 0, opts.n ?? 200, 'want_url:1']
  if (opts.itemId) command.push(`item_id:${opts.itemId}`)
  if (opts.search) command.push(`search:${opts.search}`)
  const res = await lmsQuery<MenuItemsResponse>(playerId, command)
  // Some plugins pad menus with nameless placeholder entries
  const items = (res.loop_loop ?? []).filter((i) => i.name || i.title)
  return { items, count: res.count, title: res.title }
}

export function splitJiveText(text: string): { title: string; detail?: string } {
  const [title, ...rest] = text.split('\n')
  return { title, detail: rest.join(' · ') || undefined }
}

// The Jive format is used here because it includes each episode's date and length in the list itself
export async function fetchEpisodes(playerId: string, showId: string, start: number, n: number): Promise<Page<Episode>> {
  const res = await lmsQuery<JiveItemsResponse>(playerId, ['podcasts', 'items', start, n, `item_id:${showId}`, 'menu:1'])
  const items = (res.item_loop ?? []).flatMap((i) => {
    const id = i.params?.item_id
    return id ? [{ id, image: i.icon, ...splitJiveText(i.text) }] : []
  })
  return { items, count: res.count }
}

export async function fetchRadioSources(): Promise<RadioSource[]> {
  const res = await lmsQuery<RadiosResponse>('', ['radios', 0, 100])
  return (res.radioss_loop ?? [])
    .filter((r) => r.type === 'xmlbrowser')
    .map((r) => ({ menu: r.cmd, name: r.name.trim(), icon: r.icon }))
}

export function subscribePodcast(feedUrl: string, name: string): Promise<void> {
  return lmsCommand('', ['podcasts', 'addshow', feedUrl, name])
}

export function unsubscribePodcast(feedUrl: string): Promise<void> {
  return lmsCommand('', ['podcasts', 'delshow', feedUrl])
}

export interface PodcastHome {
  // Subscriptions are the entries that carry a feed url
  shows: MenuItem[]
  // The plugin's own lists, such as new episodes and recently played
  lists: MenuItem[]
}

export async function fetchPodcastHome(playerId: string): Promise<PodcastHome> {
  const { items } = await fetchMenu(playerId, 'podcasts')
  return {
    shows: items.filter((i) => i.url),
    lists: items.filter((i) => !i.url && i.type !== 'search' && i.hasitems),
  }
}

// Menu item ids are "<parent>.<position>", e.g. "66c82454.0.3" is entry 3 of folder "66c82454.0"
export function splitItemId(id: string): { parent?: string; index: number } {
  const dot = id.lastIndexOf('.')
  return dot < 0 ? { index: Number(id) } : { parent: id.slice(0, dot), index: Number(id.slice(dot + 1)) }
}

// Only the Jive format carries an item's favourite details, so the one item is fetched again in that format
export async function fetchFavoriteDetails(
  playerId: string,
  menu: string,
  itemId: string,
): Promise<{ url: string; title: string; icon?: string } | undefined> {
  const { parent, index } = splitItemId(itemId)
  if (!Number.isInteger(index)) return undefined
  const command: (string | number)[] = [menu, 'items', index, 1, 'menu:1']
  if (parent) command.push(`item_id:${parent}`)
  const res = await lmsQuery<JiveItemsResponse>(playerId, command)
  const preset = res.item_loop?.[0]?.presetParams
  return preset?.favorites_url && preset.favorites_title
    ? { url: preset.favorites_url, title: preset.favorites_title, icon: preset.icon }
    : undefined
}
