import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: process.env.PAGES_DIST === 'true'
    ? '/celiacos/dist/'
    : (process.env.GITHUB_ACTIONS ? '/celiacos/' : '/'),
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    watch: {
      usePolling: true, // Esto fuerza la actualización en Windows
      interval: 100,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 100,
      },
    },
    hmr: {
      overlay: true,
    },
    host: true, // Para que lo veas en tu red local
  }
})