import { defineConfig as zdefiniujKonfiguracje } from 'vitest/config';
import obslugaReacta from '@vitejs/plugin-react';
import { VitePWA as pwa } from 'vite-plugin-pwa';

export default zdefiniujKonfiguracje({
  plugins: [
    obslugaReacta(),
    pwa({
      registerType: 'prompt',
      includeAssets: ['ikona.svg', 'ikona-192.png', 'ikona-512.png'],
      manifest: {
        id: '/',
        name: 'Quizomat',
        short_name: 'Quizomat',
        description: 'Prywatne narzędzie wspomagające decyzje projektowe.',
        lang: 'pl',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#164c3b',
        background_color: '#f5f7f4',
        icons: [
          {
            src: 'ikona-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'ikona-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'ikona-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./testy/przygotowanie.ts'],
    include: ['testy/**/*.test.{ts,tsx}'],
    clearMocks: true,
  },
});
