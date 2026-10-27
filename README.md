# Squire

A mobile-first web skin for Lyrion Music Server (LMS), built with Vue 3, TypeScript and Tailwind.

## Development

```sh
pnpm install
LMS_URL=http://<host>:9000 pnpm dev   # defaults to http://100.93.75.65:9000
pnpm test
```

The dev server proxies `/jsonrpc.js`, `/music`, `/imageproxy`, `/plugins` and `/html` to `LMS_URL`.

## Installing on LMS

`pnpm build` writes the skin to `plugin/Squire/HTML/squire`. Copy `plugin/Squire` into the LMS `Plugins` directory, restart LMS, and open `http://<host>:9000/squire/`.

To use Squire inside the LyrPlay iOS app, see [docs/lyrplay-bridge.md](docs/lyrplay-bridge.md).
