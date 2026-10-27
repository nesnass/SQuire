import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

const LMS_URL = process.env.LMS_URL ?? 'http://100.93.75.65:9000'

// LMS serves a skin from /<skin-dir-name>/, so the build base must match plugin/Squire/HTML/squire
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/squire/' : '/',
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // LMS sends no CORS headers; proxying keeps dev requests same-origin like the deployed skin
    proxy: Object.fromEntries(
      ['/jsonrpc.js', '/music', '/imageproxy', '/plugins', '/html'].map((path) => [path, { target: LMS_URL, changeOrigin: true }]),
    ),
  },
  build: {
    outDir: 'plugin/Squire/HTML/squire',
    emptyOutDir: true,
  },
}))
