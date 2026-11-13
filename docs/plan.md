# Squire review and plan

Reviewed 2026-11-13 at `2adeb5c`: all of `src/`, the plugin, the LyrPlay bridge, and the running skin at
`farmys-mac-mini.taild5775a.ts.net:9002/squire/`.

The live check was a read-only walk in headless Chromium at 390×844 and 1440×900: every tab, an album, the
action sheet, now playing, queue and output selector. No transport, volume or grouping control was used, so
anything about drag behaviour below comes from the code and is marked **verify on device**. Nothing was tested
in iOS Safari or inside LyrPlay.

## Verdict

The foundation is right and the direction is holding: Squire does look and feel better than Material on a
phone, and the Rooms model is the clearest part of it. The work ahead is mostly three things:

1. A handful of interaction defects in the parts already built (seek, queue, contrast, back navigation).
2. Gaps that break the "don't drop what people rely on" rule — there is no route to anything outside
   albums/artists/playlists/podcasts/radio.
3. Home and Rooms need a second pass now that real content is in them.

Nothing here calls for a rewrite or a new dependency.

## Tech choices

| Choice | Verdict | Notes |
|---|---|---|
| Vue 3 + TS strict + Tailwind 4 + Vite | Keep | 6k lines, typecheck clean, 42 tests pass, 190 KB JS / 29 KB CSS. |
| No router, no Pinia, no UI kit | Keep | `StackView` + `createStore` cover it. See P1.4 for the one thing a router would have given. |
| Greenfield, not a Material fork | Keep | The result justifies it; Material's structure would not have allowed the Rooms model. |
| JSON-RPC polling, not CometD | Keep, tune | See below. |
| Pure logic in `src/lms/` with tests | Keep | `playback.ts`, `sections.ts`, `format.ts` are the right things to have tested. |
| Server-side pref for disabled players | Keep | Correct call: per-device storage would let another phone play to a "disabled" room. |
| LyrPlay bridge as one seam (`src/native/lyrplay.ts`) | Keep | Small, documented, tested. |
| Empty `Plugin.pm` | Change | It should serve `index.html` uncached (P2.5). |
| No lint or CI | Change, lightly | P3.3. |

### Polling

Measured idle: 4 requests every 2 s with two players (`players`, `syncgroups`, one `status` per player), so
`2 + N` per tick. It stops when the page is hidden, aborts stale polls, and survives iOS suspension. That
last part is hard-won and is the reason not to move to CometD now: a long-lived subscription is exactly what
iOS kills, and LyrPlay's reconnect path already assumes a poll.

Tune it instead:

- Drop `syncgroups`. Each `status` response already carries `sync_master` and `sync_slaves`.
- Poll at 2 s only while a room is playing, a sheet is open, or for ~10 s after a command; otherwise 5–10 s.
- `fetchDisabled` sends one `playerpref` query per player every 30 s. Fine at this size; leave it.

Revisit CometD only if changes made on another controller feel slow to show up.

### Delivery

- LMS serves the bundle uncompressed (190 KB; it would be 62 KB gzipped) with a 7-day cache. Only the first
  load over Tailscale pays, so this is not worth solving on its own.
- `index.html` is the real problem: LMS caches it for up to an hour, which is why `build:dev` exists. P2.5.
- `@vue/devtools-api` is in `dependencies` but only `dev-store.ts` uses it, and none of it reaches the
  production bundle. Move it to `devDependencies`.

## Features

What's built is a coherent set and the scoping calls were sound: Library holds what the user chose, "find
more" lives next to each collection, Search is library-only, stations are favourites presented as Library.
Podcast transport (15/30 s skip) and radio transport (step through saved stations) are details Material
doesn't have, and they are the kind of thing that makes the direction credible.

Missing, in order of how likely each is to send someone back to Material:

| Gap | Cost | Plan |
|---|---|---|
| Queue editing: remove, reorder, clear | Low — `EditableTrackList` already does this for playlists | P1.2 |
| Apps (streaming services and other plugin menus) | Low — `MenuView` already renders any plugin menu; `apps` lists them like `radios` | P2.1 |
| Genres, years, folders, random mix | Low–medium | P2.1 |
| Go to album / artist from now playing | Low | P1.3 |
| Sleep timer, power, per-player settings | Low for sleep/power; settings are large | P2.2 (sleep and power only) |
| A way out to Material for everything else | Trivial | P2.1 |

Not planned: server settings, player settings beyond sleep/power, library rescans, lyrics, a light theme.
The escape hatch covers them until someone misses one.

## UX and UI

### Works well

- **Rooms.** Cards with art, track, play and volume read at a glance. Selected ring plus pill is unambiguous.
  Proportional group volume with per-room expansion is the right model.
- **Mini player leads with the room name.** This is the best single decision in the UI for a multi-room
  system; it answers "where will this play?" on every screen.
- **Now playing.** Good hierarchy, stable layout across track/podcast/radio modes, quality line is unobtrusive.
- **Output selector.** Checkboxes plus one Done suits LMS, where each sync change is slow.
- **Toasts name the room** ("Playing on WiiM Amp Lounge"), which closes the loop the mini player opens.
- **Sheets.** Focus is moved in and restored, Escape closes only the top sheet, reduced motion is respected.
- **Touch targets** are 44 px or more nearly everywhere.

### Defects

1. **Seek slider fights the clock** (`NowPlayingSheet.vue`, **verify on device**). `:value` is bound to a
   position that ticks every 250 ms and the handler is `@change` only, so a slow drag is likely to have the
   thumb pulled back under the finger, and the time labels don't follow the drag. `VolumeSlider` already
   solves this with a local value held during the drag.
2. **Queue count is wrong past 200 tracks** (`QueueSheet.vue`). The header shows `queue.length`, which is
   capped by `QUEUE_PAGE`; the rest of the queue can't be reached. `playlist_tracks` has the real total.
3. **Contrast fails WCAG AA.** `text-neutral-500` is used 30 times for real content: inactive tab labels,
   album line and quality line in now playing, queue durations, empty states. It is 4.2:1 on `neutral-950`
   and 3.8:1 on `neutral-900`; AA needs 4.5:1. `neutral-400` passes everywhere.
4. **Back does nothing.** No history integration, so the browser back button, Android back and the iOS edge
   swipe in a home-screen app either do nothing or leave Squire. A reload always lands on Rooms at the top.
5. **Selecting a room is a hidden target** (`RoomCard.vue`). Only the art-and-title strip selects; the card
   has four other targets around it. Tapping anywhere that isn't a control should select.
6. **"Pods"** in the Library switcher. Five segments is the limit of that control and the abbreviation
   shows it; adding Genres or Apps would break it outright.

### Design changes

- **Home is a long list of lists.** Favourites are unbounded full-width rows, and every playlist (up to 500)
  is repeated from Library at the bottom. Make favourites a compact two-column grid capped at six or eight
  with "Show all", and drop the playlists section or cap it the same way. Home should fit in about two
  screens.
- **Rooms as the landing tab** suits a multi-room home but is a page with one card under LyrPlay's Player
  Focus or with a single player. Remember the last tab; default to Home when only one room is visible.
- **Stack navigation has no motion and no swipe back.** Levels swap instantly. A short slide and working
  back gestures would do more for "feels native" than any other single change. Comes with P1.4.
- **Unreachable state.** The red banner appears but everything under it stays live with stale data. Dim the
  content and offer Retry; over Tailscale on mobile data this state is routine, not exceptional.
- **Desktop is the phone layout stretched.** At 1440 px the tab bar spans the window and the mini player is
  a full-width strip. Fine for mobile-first, but a `lg:` layout with a side rail and a persistent
  now-playing/queue column is cheap because the views are already independent. P3.1.

## Plan

### P1 — fix what's built

| # | Change | Files |
|---|---|---|
| 1.1 | Seek: hold a local value while dragging, update the time labels from it, send on release | `NowPlayingSheet.vue` |
| 1.2 | Queue: real total, load more past 200, remove / reorder / clear by reusing `EditableTrackList` | `QueueSheet.vue`, `usePlayerStore.ts` |
| 1.3 | Now playing: tap artist or album to go there (closes the sheet, pushes onto the Library stack) | `NowPlayingSheet.vue`, `App.vue`, `nav.ts` |
| 1.4 | History: stack levels and sheets become history entries, so back closes the top one. Slide transition in `StackView` | new `history.ts`, `StackView.vue`, `BottomSheet.vue`, `App.vue` |
| 1.5 | Contrast: replace `text-neutral-500` on content with `text-neutral-400`; keep 500/600 for decorative icons only | 30 sites |
| 1.6 | Room card: whole card selects | `RoomCard.vue` |

### P2 — close the gaps

| # | Change | Files |
|---|---|---|
| 2.1 | Library "More": Genres, Years, Folders, Random mix, Apps, and "Open classic skin". Replace the segmented control with a scrolling row so labels are whole | `BrowseView.vue`, `library.ts`, `nav.ts`, new views |
| 2.2 | Room menu: sleep timer and power, next to Disable | `RoomCard.vue`, `usePlayerStore.ts` |
| 2.3 | Home: favourites grid with cap, drop or cap playlists | `HomeView.vue` |
| 2.4 | Landing tab: remember last; Home under Player Focus | `App.vue` |
| 2.5 | Serve `index.html` with `Cache-Control: no-cache` from the plugin, then remove `build:dev` and the README caveat. Needs a spike: confirm a plugin page handler can override the skin's cached template | `Plugin.pm`, `package.json`, `README.md` |
| 2.6 | Polling: drop `syncgroups`, adaptive interval | `usePlayerStore.ts` |
| 2.7 | Unreachable: dim content, Retry button | `App.vue` |

### P3 — later

| # | Change |
|---|---|
| 3.1 | `lg:` layout: side rail, persistent now-playing and queue column |
| 3.2 | Volume sliders inside the output selector, as WiiM Home and Sonos do |
| 3.3 | `oxlint` plus a GitHub Action running `typecheck` and `test`; move `@vue/devtools-api` to `devDependencies` |
| 3.4 | Show `window.lyrplayStreamText` in now playing when LyrPlay is the active player |
| 3.5 | If Squire is to be shared: plugin icon, `repo.xml`, a release build |

### Suggested order

1.1, 1.5 and 1.6 first: each is under an hour and all three are visible daily. Then 1.2 and 1.4, which are
the two that most change how the app feels. Then 2.1, which is what stops a return trip to Material.

## Specs

Items 1.1, 1.5 and 1.6 need no more than their row above. Commands marked ✓ were run read-only against the
server (LMS 9.1.1) on 2026-11-13; commands marked ✗ change state and were not run.

### 1.2 Queue editing

Store (`usePlayerStore.ts`):

- `queueTotal` getter = `status.playlist_tracks`. The header shows this, not `queue.length`.
- `loadMoreQueue()`: `status <queue.length> 200 <TRACK_TAGS>` ✓ (paging by start index works), appended.
- `refreshQueue` refetches `max(200, queue.length)` rows when `playlist_timestamp` changes, so a long queue
  that was scrolled doesn't collapse back to 200.
- `removeFromQueue(index)` → `playlist delete <index>` ✗
- `moveInQueue(from, to)` → `playlist move <from> <to>` ✗
- `clearQueue()` → `playlist clear` ✗
- Each edit updates `queue` at once (splice, then renumber `playlist index`), sets `lastMutation`, and clears
  `queueKey` so the next poll reconciles. Edits are chained one at a time, as `PlaylistView.edit` does. On
  failure: toast "Couldn't update the queue", refetch.

`EditableTrackList.vue` is tied to `LibraryTrack` and keys rows by `t.id`. A queue holds `Track`s, and the
same song can be in it twice. Change its prop to `rows: { key: string; title: string; subtitle?: string;
art?: string }[]`. `PlaylistView` maps its tracks to rows; the queue builds `key` from the track id plus its
occurrence number, so keys survive a reorder.

`QueueSheet.vue`:

- Header: "Queue · N tracks" from `queueTotal`, and an Edit/Done toggle styled as in `PlaylistView`.
  "Save as playlist" and a new "Clear" move into a ⋯ action sheet to make room.
- Edit mode swaps the list for `EditableTrackList`. The sheet's scroller needs `data-scroller` for
  edge-scrolling during a drag.
- Clear asks through `ConfirmSheet` ("Clear the queue on {room}?" / "Clear queue"); LMS has no undo.
- `LoadMore` at the bottom while `queue.length < queueTotal`.

Done when: a 250-track queue shows "250 tracks" and its last track can be reached; remove, drag, arrow-key
reorder and clear each show at once and still hold after the next poll; removing the playing track moves
playback on without the sheet losing its place.

### 1.3 Go to album or artist from now playing

- Add `s` and `e` to `TRACK_TAGS` in the store; add `artist_id?: string | number` and
  `album_id?: string | number` to `Track`. `artist_id` can be a comma-separated list; use the first.
- `StackView` exposes `push(route)` next to `reselect`.
- `NowPlayingSheet` emits `go: [route: Route]`. The artist and album lines become buttons only when their id
  is present (remote streams have none). The ⋯ sheet gains "Go to album" and "Go to artist" under the same
  condition.
- `App.vue` on `go`: close now playing, set `tab = 'browse'`, wait a tick for the stack to mount, then
  `stacks.browse.push(route)`. `AlbumView` already fills in an album given only id and title.

Done when: tapping the album line of a library track lands on that album in Library with Back returning to
wherever Library was; radio and podcast items show plain text.

### 1.4 History

Rule: **back closes the topmost thing the user can see** — the top sheet, else the top level of the current
tab's stack. At a tab's root, back leaves Squire as it does today. Tabs are not history entries.

`src/components/history.ts` holds an ordered list of layers `{ close: () => void }` and mirrors it in
browser history:

- `openLayer(close)`: `history.pushState({ squire: depth }, '')` (same URL), append the layer.
- `closeLayers(n = 1)`: `history.go(-n)`. Every close goes through here, including the Back button in
  `BackHeader`, sheet close/drag/backdrop/Escape, and `reselect`.
- One `popstate` listener: read the target depth from `event.state?.squire ?? 0` and call `close` on each
  layer above it, newest first. This is the only place a layer is actually closed, so UI back and browser
  back cannot diverge.
- `suspend(n)` / `resume(layers)` for tab switches: leaving a tab with `n` levels open does `history.go(-n)`
  with closing suppressed, then pushes one entry per level of the tab being entered. Sheets are modal, so
  none can be open during a switch.

`StackView` calls `openLayer` in `push` and `closeLayers` in `pop`/`reselect`; the array mutation moves into
the layer's `close`. `BottomSheet` calls `openLayer` on mount; its `close()` becomes `closeLayers()` and the
existing leave animation runs from the layer's `close`. The Escape handler and `sheetStack.ts` go away,
since history order now says which sheet is on top.

Keep the layer list a pure module with tests for: open/close order, `go(-n)` closing n layers, suspend and
resume across a tab switch, and a stray `popstate` with nothing open.

Transition: levels in `StackView` slide in from the right over 200 ms and out the same way, with
`motion-reduce:duration-0`, using the same `Transition` classes approach as `BottomSheet`.

No custom edge-swipe. Safari and a home-screen app already map the edge swipe to history back, and a second
gesture would fight it.

Check on a phone before merging:

- In LyrPlay, sheets and stack levels still open and close; Back in the header works; the settings button
  still opens LyrPlay's settings; airplane-mode recovery still returns to the same place.
- Whether LyrPlay's web view gives an edge swipe. If not, that is a LyrPlay setting to raise upstream.
- Reloading mid-stack lands on the tab root with back leaving the app (stale entries must not close nothing
  repeatedly: on load, `history.replaceState({ squire: 0 }, '')`).

Done when: browser back, Android back and the iOS edge swipe each close exactly one sheet or level; back
never changes tab; the four LyrPlay checks in `docs/lyrplay-bridge.md` still pass.

### 2.1 Library "More"

Switcher: a horizontally scrolling row of the existing pill buttons with full labels —
Albums, Artists, Playlists, Podcasts, Radio, More. Drop the `short` label mechanism.

More shows a plain list of rows (icon, label, chevron):

| Row | Opens | LMS |
|---|---|---|
| Genres | List of 134 genres → albums in that genre | `genres 0 N` ✓, `albums … genre_id:<id>` ✓ |
| Years | Years newest first → albums of that year | `years 0 N` ✓, `albums … year:<y>` ✓ |
| Folders | The two music folders → subfolders and tracks | `musicfolder 0 N tags:dcu [folder_id:<id>]` ✓ |
| Random mix | Action sheet: Songs, Albums, Artists, Stop | `randomplay tracks\|albums\|contributors\|disable` ✗ (`can randomplay ?` ✓ = 1) |
| Apps | One row per app except Podcasts, opening `MenuView` | `apps 0 100` ✓ — this server has only "Sounds & Effects" |
| Open classic skin | Navigates to `/material/` | Hidden when `host.native`, or when the page is itself served from `/material/` |

Code:

- `library.ts`: `fetchGenres`, `fetchYears`, `fetchFolder(folderId?)`; `fetchAlbums` takes `genreId` and
  `year`.
- `types.ts`: `PlayTarget` gains `{ genre_id }`, `{ year }`, `{ folder_id }`. These go through the existing
  `playlistcontrol` path unchanged ✗ — confirm each plays before wiring its Play button.
- `nav.ts`: routes `genres`, `years`, `albumList { title, genreId?, year? }`, `folder { id?, name }`.
- Views: `FacetListView` (one component for genres and years), `AlbumListView` (the Albums grid plus
  `PlayBar`, taking a filter), `FolderView` (folder rows push; track rows play by `track_id`).
- Random mix shows as active from `status.randomplay` ✓; the sheet then leads with Stop.
- Hide Random mix when `can randomplay ?` is 0, and Apps when the list is empty after removing Podcasts.

Done when: every row opens without error on this server; a genre and a year each list the right albums and
their Play button plays them; Folders reaches a track three levels down and plays it; the switcher shows
whole labels at 390 px.

### 2.2 Sleep and power

In the room ⋯ sheet, above Disable:

- **Sleep timer…** opens a second action sheet: 15, 30, 45, 60, 90 minutes, End of track, Off. Sends
  `sleep <seconds>` ✗ to every member (`sleep ?` ✓ reads it); End of track is `duration − position`, hidden
  for radio. While set, `status.will_sleep_in` drives a "Sleeps in 23 min" line on the card and the row
  reads "Sleep timer · 23 min".
- **Turn off / Turn on** sends `power 0|1` ✗ to every member. Shown only when the player reports
  `canpoweroff` ✓ (already in the `players` response; add it to `Player`).
- A room with `status.power === 0` shows "Off" in place of the track line, hides play and volume, and offers
  a Turn on button. `playAll` skips it.

Done when: a 15-minute timer shows its countdown on the card and survives a reload; Off clears it; a
powered-off room is visibly off and comes back with one tap.

### 2.3 Home

- Favourites: two-column grid of compact tiles (48 px art, name on up to two lines, ⋯ button kept; tap plays or opens a
  folder). First 8 only; a "Show all" link appears past 8 and pushes the
  full list. `FavoritesFolderView` gains an optional `id` so it can list the top level.
- Remove the Playlists section; Library has it.
- Order stays Favourites, Podcasts, Albums.

Done when: with 2 favourites and with 20, Home is at most about two screens at 390×844, and nothing that was
reachable from Home needs more than one extra tap.

### 2.4 Landing tab

`tab` starts as the value saved under `squire.tab`, else `'home'` when `host.focusPlayer` is set, else
`'rooms'`. Save on every change. No change after the first poll, so the tab never moves under the user.

Done when: a reload returns to the same tab; a first open under Player Focus lands on Home.

### 2.5 Uncached `index.html` (spike, half a day)

Measured: `/squire/index.html` is sent with no `Cache-Control`, `Expires`, `ETag` or `Last-Modified`;
hashed assets get `max-age=604800`.

1. Find which cache is stale after a build: `pnpm build`, then `curl` the page at once and compare the
   asset names with the new build. If `curl` is fresh, the browser is caching on heuristics and a header
   fixes it; if `curl` is stale, LMS is holding the template in memory.
2. Try a raw handler in `Plugin.pm` (`Slim::Web::Pages->addRawFunction`) for `squire/` and
   `squire/index.html` that reads the file from disk and sends `Cache-Control: no-cache`.
3. Confirm the proxied `/material/` path gets the same treatment.

Exit: either a build is live on the next reload with no LMS restart — then delete `build:dev` and the README
paragraph — or a note in the README saying why not, and `build:dev` stays.

### 2.6 Polling

- Replace the fixed `setInterval(…, POLL_MS)` with a 1 s ticker that polls when the time since the last
  refresh started is at least the current interval.
- Interval is 2 s when any room is playing or waiting, when now playing, the queue or the output selector is
  open, or within 10 s of `lastMutation`; otherwise 8 s. Hidden pages still don't poll, and becoming visible
  still refreshes at once.
- `syncgroups`: first group two players and check that `status` returns `sync_master` and `sync_slaves` (no
  group existed on 2026-11-13, so this is unconfirmed). If it does, build `syncGroups` from the status
  responses and drop the request. If not, keep it and fetch it only on the slow cadence.

Done when: idle with nothing playing sends at most `1 + N` requests per 8 s; a play started from another
controller shows within 8 s, and within 2 s once anything is playing; the stall and iOS-resume behaviour in
`playback.test.ts` and the bridge checks are unchanged.

### 2.7 Unreachable state

When `reachable === false`: the banner reads "Can't reach the server" with a Retry button that calls
`actions.refresh()`; transport, volume and grouping controls are disabled; `main` drops to 60 % opacity but
stays scrollable so loaded lists can still be read. All of it lifts on the next successful poll.

Done when: with the server stopped, the state shows within 12 s (three timeouts), no control appears to
work, and Retry or the next poll restores everything without a reload.

## Open questions

- Is Squire for this household only, or meant to be published? That decides P3.5.
- Does anyone use it on a desktop or tablet? If not, P3.1 can be dropped.

Answered by the server: no streaming plugins are installed (`apps` lists only Sounds & Effects and
Podcasts), so Apps stays a single row in More.
