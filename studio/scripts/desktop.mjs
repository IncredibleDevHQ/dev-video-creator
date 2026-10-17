import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import electron from 'electron'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const smoke = process.argv.includes('--smoke')
const temporary = smoke
  ? await mkdtemp(join(tmpdir(), 'studio-desktop-smoke-'))
  : null
const env = { ...process.env, STUDIO_NODE_PATH: process.execPath }
delete env.ELECTRON_RUN_AS_NODE
if (temporary) {
  Object.assign(env, {
    MINIMAL_STUDIO_DATA_DIR: temporary,
    MINIMAL_STUDIO_PERSISTENCE: 'local',
    VITEST: 'desktop-smoke',
    MINIMAL_STUDIO_ALLOW_LIVE_HARNESS: '0',
    OPENAI_API_KEY: '',
    FISH_AUDIO_API_KEY: ''
  })
}
const child = spawn(
  electron,
  [
    fileURLToPath(new URL('../desktop/main.cjs', import.meta.url)),
    ...process.argv.slice(2)
  ],
  { env, stdio: 'inherit' }
)
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => child.kill(signal))
child.on('error', (error) => {
  console.error(error.message)
  process.exitCode = 1
})
child.on('exit', async (code) => {
  if (temporary) await rm(temporary, { recursive: true, force: true })
  process.exitCode = code ?? 1
})
