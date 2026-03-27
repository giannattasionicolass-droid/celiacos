import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const pagesMode = process.env.PAGES_DIST === 'true'

export default defineConfig({
  base: pagesMode
    ? '/celiacos/dist/'
    : (process.env.GITHUB_ACTIONS ? '/celiacos/' : '/'),
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: pagesMode ? {
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    } : undefined,
  },
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