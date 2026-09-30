import { defineConfig } from 'vite'
export default defineConfig({ server: { proxy: { '/api': `http://127.0.0.1:${process.env.MINIMAL_STUDIO_PORT || 4320}`, '/objects': `http://127.0.0.1:${process.env.MINIMAL_STUDIO_PORT || 4320}` } } })
