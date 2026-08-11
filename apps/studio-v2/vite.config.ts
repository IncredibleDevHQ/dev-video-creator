import { defineConfig } from 'vite'

const renderWorker = 'http://127.0.0.1:4319'

export default defineConfig({
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
