import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const pagesMode = process.env.PAGES_DIST === 'true'
const appBuildId = new Date().toISOString()

const appVersionPlugin = {
  name: 'app-version-file',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'app-version.json',
      source: JSON.stringify({
        buildId: appBuildId,
        generatedAt: appBuildId,
      }),
    })
  },
}

export default defineConfig({
  base: pagesMode
    ? '/celiacos/'
    : (process.env.GITHUB_ACTIONS ? '/celiacos/' : '/'),
  define: {
    __APP_BUILD_ID__: JSON.stringify(appBuildId),
  },
  plugins: [
    react(),
    tailwindcss(),
    appVersionPlugin,
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['favicon.svg', 'pwa-192.png', 'pwa-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'CeliaShop - Sin TACC',
        short_name: 'CeliaShop',
        description: 'Tienda premium de productos sin TACC. Compra fácil, entrega en Azul.',
        theme_color: '#16a34a',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        categories: ['shopping', 'food'],
        screenshots: [],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fsgssvindtmryytpgmxg\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
    }),
  ],
  build: {},
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