import { existsSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // The app chunk stays small; globe.gl + three.js (about 1.9 MB) is its own lazy chunk that
  // loads beside the data, so this limit only covers that one chunk.
  build: { chunkSizeWarningLimit: 2000 },
  // True once the recorder has written real futures. Until then the app skips the probes for them
  // (each missing file is a red 404 in the console) and loads the labelled stand-ins directly.
  define: { __RECORDED__: JSON.stringify(existsSync(new URL('public/cache/futures.json', import.meta.url))) },
})
