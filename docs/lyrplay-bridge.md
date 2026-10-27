# Running inside LyrPlay

[LyrPlay](https://github.com/mtxmiller/LyrPlay) is an iOS LMS player that shows Material Skin in a WKWebView. Squire takes Material's place by being served at the path LyrPlay loads, and by speaking Material's side of LyrPlay's bridge. The bridge is `src/native/lyrplay.ts`.

Keeping the skin inside LyrPlay keeps the player app in the foreground while it is in use. Controlling a backgrounded LyrPlay from Safari is unreliable, because iOS suspends the app when it isn't playing.

## Serving Squire as `/material/`

LyrPlay hardcodes `/material/`, but its web port and SlimProto port are separate settings. A proxy on a spare web port sends `/material/` to Squire and everything else to LMS. Audio (SlimProto, 3483) bypasses it.

On the home server, with `tailscale serve`:

```sh
tailscale serve --bg --http=9002 http://localhost:9000
tailscale serve --bg --http=9002 --set-path=/material http://localhost:9000/squire
```

In LyrPlay: server = the server's Tailscale address, web port `9002`, SlimProto port `3483`.

- Use `--http`: LyrPlay builds `http://` URLs.
- LMS sees proxied requests as coming from localhost. Check this doesn't bypass LMS password or IP rules you rely on.
- `tailscale serve reset` removes the routes.

## URL parameters

LyrPlay loads:

```
/material/?hide=mediaControls&nativePlayer=w&nativeConnectionStatus=w[&topPad=N]
  &appSettings=lmsstream://settings&appSettingsName=iOS%20App%20Settings
```

With iOS Player Focus on, it adds `player=<LyrPlay's name>&single`.

| Param | Squire |
|---|---|
| `nativePlayer=w` | Installs the bridge below |
| `nativeConnectionStatus=w` | Sends connection messages |
| `appSettings`, `appSettingsName` | Shows a settings button on Rooms that navigates to the URL; LyrPlay intercepts it |
| `player` + `single` | Shows only that player's room and keeps it selected |
| `topPad` | Ignored; LyrPlay also sets `--top-pad`, which Squire uses |
| `hide=mediaControls` | Ignored; Squire has no web player |

The settings button is required. LyrPlay hides its own fallback settings button once its page script injects, which it does on any page.

## Skin → LyrPlay

Plain-text messages to `window.webkit.messageHandlers.mskNative.postMessage`:

```
MATERIAL-PLAYER
ID aa:bb:cc:dd:ee:ff
NAME Kitchen
IP 192.168.1.50:34657
```

Sent on load and on every player switch. Only `ID` is required.

```
MATERIAL-CONNETIONSTATUS
CONNECTED true
```

Sent when the server becomes reachable or unreachable. The misspelling is Material's, and LyrPlay matches it literally.

## LyrPlay → skin

LyrPlay calls these globals with `evaluateJavaScript`. Each call is guarded with `typeof`, so a missing global fails silently.

| Global | When LyrPlay calls it | Squire |
|---|---|---|
| `setCurrentPlayer(mac)` | Material switched away from LyrPlay within 10 s of a reconnect | Selects the player; matches case-insensitively |
| `incrementVolume()`, `decrementVolume()` | Phone volume buttons while another player is selected | Steps the active player's volume by 5 |
| `bus.$emit('adjustVolume', up)` | Fallback for the above | Same |
| `bus.$emit('refreshStatus')` | After recovering from the background | Polls now |
| `lmsIsConnected`, `app.cometd`, `app.connectToCometD()` | After a network handover (`MaterialReconnect.swift`) | `connectToCometD` polls now; `lmsIsConnected` stays undefined until the first poll, so the script leaves the page alone during load |
| `--top-pad` CSS variable | On load, rotation, and resume; re-injected if it changes | Top padding uses `var(--top-pad, env(safe-area-inset-top))` |

LyrPlay also sets `window.lyrplayStreamText` (for example `FLAC, 44.1kHz, 16bit, 850kbps`) and `window.lyrplayPlayerId` while it plays. Squire doesn't show them yet.

Its remaining scripts target Material's DOM and globals (`TB_APP_SETTINGS`, `lmsApp`, `.np-bar-tech`) and do nothing here.

## Checking on a phone

1. Rooms shows the settings button, and it opens LyrPlay's settings.
2. Selecting another room, then the phone's volume buttons, changes that room's volume.
3. Toggling airplane mode while LyrPlay plays brings the UI back, with LyrPlay still selected.
4. With Player Focus on, only LyrPlay's room is shown.
