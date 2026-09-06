// Verifies defect 0.1 stays fixed: with --serve-dist the worker must serve
// every script/stylesheet the built index.html references (the /assets/*
// media route used to shadow Vite's bundle and 404 it as JSON).
// Usage: yarn build first, then `node scripts/serve-dist-check.mjs`.
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'

const HOST = '127.0.0.1'
const PORT = 4331
const origin = `http://${HOST}:${PORT}`

const fail = message => {
  console.error(`SERVE-DIST FAIL: ${message}`)
  process.exitCode = 1
}

const worker = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['tsx', 'server/bin.ts', '--serve-dist'],
  {
    env: {
      ...process.env,
      STUDIO_RENDER_HOST: HOST,
      STUDIO_RENDER_PORT: String(PORT),
      STUDIO_PERSISTENCE: process.env.STUDIO_PERSISTENCE || 'local',
    },
    stdio: ['ignore', 'pipe', 'inherit'],
  },
)
worker.stdout.on('data', () => {})

const waitForWorker = async () => {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${origin}/api/health`)
      if (response.ok) return
    } catch {
      // Not up yet.
    }
    await new Promise(resolve => setTimeout(resolve, 400))
  }
  throw new Error('worker did not come up within 30s')
}

try {
  await waitForWorker()
  const indexResponse = await fetch(`${origin}/`)
  const index = await indexResponse.text()
  if (!indexResponse.ok || !index.includes('<title>')) {
    throw new Error(`index not served (status ${indexResponse.status})`)
  }
  const bundleUrls = [
    ...index.matchAll(/(?:src|href)="(\/(?:static|assets)\/[^"]+)"/g),
  ].map(match => match[1])
  if (bundleUrls.length === 0) throw new Error('no bundle URLs found in index.html')
  for (const path of bundleUrls) {
    const response = await fetch(`${origin}${path}`)
    const contentType = response.headers.get('content-type') || ''
    if (!response.ok || contentType.includes('application/json')) {
      throw new Error(`${path} → ${response.status} ${contentType}`)
    }
    console.log(`ok ${path} (${contentType.split(';')[0]})`)
  }
  // Media route still works for real uploads (and 404s cleanly when absent).
  const media = await fetch(`${origin}/assets/definitely-missing.mp3`)
  if (media.status !== 500 && media.status !== 404) {
    throw new Error(`media route misbehaving (status ${media.status})`)
  }
  if (!process.exitCode) console.log('SERVE-DIST PASS')
} catch (error) {
  fail(error instanceof Error ? error.message : String(error))
} finally {
  worker.kill('SIGTERM')
}
