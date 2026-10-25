import { existsSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The local live demo (task 156): the dev and preview servers forward /live to the pipeline's live server
// (node doomclock/pipeline/world/live.ts serve). The production build has no proxy, so /live is a 404 there
// and the browser never reaches MiroFish; scripts/check-inert.mjs checks the bundle after every build.
const live = { '/live': { target: process.env.LIVE_URL ?? 'http://127.0.0.1:5055', changeOrigin: true } }

export default defineConfig({
  plugins: [react()],
  server: { proxy: live },
  preview: { proxy: live },
  // The app chunk stays small; globe.gl + three.js (about 1.9 MB) is its own lazy chunk that
  // loads beside the data, so this limit only covers that one chunk.
  build: { chunkSizeWarningLimit: 2000 },
  // True once the recorder has written real futures. Until then the app skips the probes for them
  // (each missing file is a red 404 in the console) and loads the labelled stand-ins directly.
  define: { __RECORDED__: JSON.stringify(existsSync(new URL('public/cache/futures.json', import.meta.url))) },
})
