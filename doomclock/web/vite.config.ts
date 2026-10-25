import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // The app chunk stays small; globe.gl + three.js (about 1.9 MB) is its own lazy chunk that
  // loads beside the data, so this limit only covers that one chunk.
  build: { chunkSizeWarningLimit: 2000 },
})
