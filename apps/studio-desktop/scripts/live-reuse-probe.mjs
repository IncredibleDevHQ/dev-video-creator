// Post-hoc evaluation of the live rerun's provider spend, with the criterion
// in its honest form. Evidence: the finish receipt's cast keys + the library
// rows' createdAt (run-dir asset records can't carry this — the list op
// copies library records into the run without a reused marker).
import { spawn } from 'node:child_process'
import { mkdtemp, rm, readdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const appDir = fileURLToPath(new URL('..', import.meta.url))
const electronBinary = require('electron')
const runDir = process.argv[2]
if (!runDir) { console.error('usage: node live-reuse-probe.mjs <runDir>'); process.exit(2) }
const root = await mkdtemp(join(tmpdir(), 'studio-reuse-probe-'))
const app = spawn(electronBinary, ['.', '--smoke', '--keep-running'], {
  cwd: appDir,
  env: { ...process.env, STUDIO_ALLOW_MULTI_INSTANCE: '1', STUDIO_DATA_DIR: join(root, 'data'), STUDIO_OUTPUTS_DIR: join(root, 'outputs') },
  stdio: ['ignore', 'pipe', 'inherit'],
})
const origin = await new Promise((resolve, reject) => {
  let buffer = ''
  const timeout = setTimeout(() => reject(new Error('app start timed out')), 90_000)
  app.stdout.on('data', chunk => {
    buffer += chunk
    const match = /STUDIO_ORIGIN (http:\/\/\S+)/.exec(buffer)
    if (match && buffer.includes('SMOKE PASS')) { clearTimeout(timeout); resolve(match[1]) }
  })
  app.once('exit', code => reject(new Error(`app exited (${code})`)))
})
try {
  const { assets: library } = await fetch(`${origin}/api/appearance/library`).then(r => r.json())
  const runStartedAt = Date.parse(JSON.parse(await readFile(join(runDir, 'motion', 'run.json'), 'utf8')).startedAt)
  const receipt = JSON.parse(await readFile(join(runDir, 'explainer', 'receipt.json'), 'utf8'))
  const castKeys = [...new Set(Object.values(receipt.cast || {}).flat().map(entry => String(entry).split(':')[0]))]
  const libraryByKey = new Map(library.map(asset => [asset.key, asset]))
  const reusedFromBefore = castKeys.filter(key => {
    const row = libraryByKey.get(key)
    return row && Date.parse(row.createdAt || '') < runStartedAt
  })
  const names = (await readdir(join(runDir, 'explainer', 'assets'))).filter(n => n.endsWith('.json'))
  const cast = []
  for (const name of names) cast.push(JSON.parse(await readFile(join(runDir, 'explainer', 'assets', name), 'utf8')))
  const freshGenerations = cast.filter(a => a.operation === 'generate' && a.reused === false)
  console.log(`cast keys: ${castKeys.length} (${castKeys.map(k => k.slice(0, 6)).join(', ')})`)
  console.log(`cast objects predating this run: ${reusedFromBefore.length} (${reusedFromBefore.map(k => k.slice(0, 6)).join(', ') || 'none'})`)
  console.log(`fresh generations with explicit no-reuse: ${freshGenerations.length} (${freshGenerations.map(a => a.entity).join(', ') || 'none'})`)
  const ok = reusedFromBefore.length > 0
  console.log(ok ? 'CROSS-RUN REUSE PROVEN LIVE' : 'NO CROSS-RUN REUSE EVIDENCE')
  process.exitCode = ok ? 0 : 1
} finally {
  app.kill('SIGTERM')
  await new Promise(r => setTimeout(r, 500))
  await rm(root, { recursive: true, force: true })
}
