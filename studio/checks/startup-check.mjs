// Launch the real development entrypoint against a fresh, disposable local store.
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
const port = () =>
  new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const value = server.address().port
      server.close((error) => (error ? reject(error) : resolve(value)))
    })
  })
const data = await mkdtemp(join(tmpdir(), 'studio-startup-')),
  web = await port(),
  engine = await port()
const env = {
  ...process.env,
  MINIMAL_STUDIO_PERSISTENCE: 'local',
  MINIMAL_STUDIO_DATA_DIR: data,
  MINIMAL_STUDIO_WEB_PORT: String(web),
  MINIMAL_STUDIO_PORT: String(engine)
}
// Never inherit a developer's configured remote store into this check.
for (const key of Object.keys(env))
  if (
    key.startsWith('MINIMAL_STUDIO_S3_') ||
    key === 'MINIMAL_STUDIO_DATABASE_URL'
  )
    delete env[key]
const child = spawn(process.execPath, ['scripts/dev.mjs'], {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  env,
  stdio: ['ignore', 'pipe', 'pipe']
})
let output = ''
for (const stream of [child.stdout, child.stderr])
  stream.on('data', (chunk) => {
    output = (output + chunk).slice(-8000)
  })
let exited = false
const done = once(child, 'exit').then(() => {
  exited = true
})
try {
  const deadline = Date.now() + 45000
  let ready = false
  while (Date.now() < deadline && !exited) {
    try {
      const response = await fetch(`http://127.0.0.1:${web}/api/projects`, {
        signal: AbortSignal.timeout(1500)
      })
      if (response.ok) {
        const notebooks = await response.json()
        if (!Array.isArray(notebooks) || notebooks.length)
          throw new Error('Expected an empty disposable notebook store')
        ready = true
        break
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  if (!ready)
    throw new Error(`Studio did not start within 45 seconds.\n${output}`)
  const page = await fetch(`http://127.0.0.1:${web}/`, {
    signal: AbortSignal.timeout(3000)
  })
  if (!page.ok || !(await page.text()).includes('Incredible Studio'))
    throw new Error('The frontend did not serve its entry document')
  console.log(
    'PASS real launcher, frontend document, API proxy and empty local store; no model or device calls.'
  )
} finally {
  child.kill('SIGTERM')
  await Promise.race([
    done,
    new Promise((resolve) => setTimeout(resolve, 5000))
  ])
  if (!exited) {
    child.kill('SIGKILL')
    await done
  }
  await rm(data, { recursive: true, force: true })
}
