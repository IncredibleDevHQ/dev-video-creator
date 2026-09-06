import { createServer } from 'node:http'
import { createStudioHandler } from './index'

const HOST = process.env.STUDIO_RENDER_HOST || '127.0.0.1'
const PORT = Number(process.env.STUDIO_RENDER_PORT || 4319)
const SERVE_DIST = process.argv.includes('--serve-dist')

const server = createServer(createStudioHandler())

server.listen(PORT, HOST, () => {
  console.log(`Incredible render worker listening on http://${HOST}:${PORT}`)
  if (SERVE_DIST) console.log('Serving the built studio from the same origin')
})
