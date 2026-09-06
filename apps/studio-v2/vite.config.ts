import { defineConfig } from 'vite'

const renderWorker = 'http://127.0.0.1:4319'

export default defineConfig({
  // The worker serves uploaded media at /assets/*; emitting the bundle under
  // static/ keeps the built app routable with --serve-dist.
  build: { assetsDir: 'static' },
  server: {
    proxy: {
      '/api': renderWorker,
      '/assets': renderWorker,
      '/outputs': renderWorker,
      '/previews': renderWorker,
      '/runtime': renderWorker,
    },
  },
})
