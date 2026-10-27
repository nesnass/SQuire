// Apple's podcast directory is used for finding shows because it needs no API key and returns each show's
// RSS feed, which is all LMS's Podcasts plugin needs to subscribe

export interface DirectoryShow {
  // Missing for a pasted feed, whose title is only known once LMS has read it
  name?: string
  author?: string
  feedUrl: string
  artwork?: string
}

export type PodcastInput = { kind: 'apple'; id: string } | { kind: 'feed'; url: string } | { kind: 'term'; term: string }

interface AppleResult {
  collectionName?: string
  artistName?: string
  feedUrl?: string
  artworkUrl600?: string
  artworkUrl100?: string
}

const API = 'https://itunes.apple.com'

// Apple Podcasts links carry the show id as "id123456"; other links are taken to be RSS feeds
export function parsePodcastInput(input: string): PodcastInput | null {
  const text = input.trim()
  if (!text) return null
  if (/^https?:\/\//i.test(text)) {
    const apple = text.match(/^https?:\/\/podcasts\.apple\.com\/.*\bid(\d+)/i)
    return apple ? { kind: 'apple', id: apple[1] } : { kind: 'feed', url: text }
  }
  return { kind: 'term', term: text }
}

function toShows(results: AppleResult[]): DirectoryShow[] {
  return results.flatMap((r) =>
    r.feedUrl && r.collectionName
      ? [{ name: r.collectionName, author: r.artistName, feedUrl: r.feedUrl, artwork: r.artworkUrl600 ?? r.artworkUrl100 }]
      : [],
  )
}

async function apple(path: string): Promise<DirectoryShow[]> {
  const res = await fetch(`${API}${path}`)
  if (!res.ok) throw new Error(`Podcast directory failed: ${res.status}`)
  const body = (await res.json()) as { results?: AppleResult[] }
  return toShows(body.results ?? [])
}

export function searchDirectory(term: string): Promise<DirectoryShow[]> {
  return apple(`/search?media=podcast&entity=podcast&limit=25&term=${encodeURIComponent(term)}`)
}

export function lookupDirectory(id: string): Promise<DirectoryShow[]> {
  return apple(`/lookup?entity=podcast&id=${encodeURIComponent(id)}`)
}
