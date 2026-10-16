import { defineConfig } from 'vite'
const engine = `http://127.0.0.1:${process.env.MINIMAL_STUDIO_PORT || 4320}`
// The voice socket is under /api, so its upgrade is passed on too.
export default defineConfig({
  server: {
    proxy: { '/api': { target: engine, ws: true }, '/objects': engine }
  }
})
