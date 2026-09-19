// Live story-master proof (D2): the local Kimi harness plans an outline from
// a creator's narrative under the preserve wording policy, writes it into the
// run directory, and the product validates + models it through /api/story/
// model. Spends a small Kimi run by design; not in the deterministic suite.
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const appDir = fileURLToPath(new URL('..', import.meta.url))
const electronBinary = require('electron')
const root = await mkdtemp(join(tmpdir(), 'studio-story-live-'))
const app = spawn(electronBinary, ['.', '--smoke', '--keep-running'], {
  cwd: appDir,
  env: {
    ...process.env,
    STUDIO_ALLOW_MULTI_INSTANCE: '1',
    STUDIO_DATA_DIR: join(root, 'data'),
    STUDIO_OUTPUTS_DIR: join(root, 'outputs'),
    STUDIO_ENABLE_TEST_HOOKS: '1',
  },
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
const sleep = ms => new Promise(r => setTimeout(r, ms))
const evaluate = async js => {
  const response = await fetch(`${origin}/__eval`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ js: `(${js})()` }) })
  const body = await response.json()
  if (!body.ok) throw new Error(body.error || 'eval failed')
  return body.result
}
let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures += 1
}

const NARRATIVE = `Our Friday deploys kept breaking things. Every week we shipped a batch, and every week the same small fire. The fix was not more careful reviews; it was making each deploy smaller, so one bad change could not take the evening down. Feature flags turned big releases into boring ones.`
const PROJECT_ID = `story-live-${Date.now().toString(36)}`
try {
  await fetch(`${origin}/api/projects/${PROJECT_ID}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ version: 1, id: PROJECT_ID, title: 'Story live proof', notebook: { type: 'doc', content: [] }, fps: 30, width: 1920, height: 1080, blocks: {}, presenterTracks: {}, recordedBlocks: {}, brand: {}, theme: {} }) })
  const run = await evaluate(`async () => {
    const run = await window.studioDesktop.harness.run({ adapter: 'kimi', skill: 'story-master', route: 'Plan Story', projectId: '${PROJECT_ID}',
      inputs: { source: { title: 'Smaller deploys', site: '', text: ${JSON.stringify(NARRATIVE)}, words: 56 }, wordingPolicy: 'preserve', targetSeconds: 60, model: 'kimi-code/k3', effort: 'high', autonomous: true } })
    return { id: run.id, projectDir: run.projectDir }
  }`)
  console.log(`run started: ${run.id}`)
  let status = 'running'
  for (let i = 0; i < 200 && ['running', 'gate'].includes(status); i += 1) {
    await sleep(6_000)
    status = (await evaluate(`async () => window.studioDesktop.harness.list()`)).find(r => r.id === run.id)?.status || 'error'
  }
  check('the story run finished', status === 'done', status)
  const artefacts = await evaluate(`async () => window.studioDesktop.harness.artefacts('${run.id}')`)
  const outline = artefacts?.story?.outline
  check('the harness wrote a valid outline', Array.isArray(outline?.scenes) && outline.scenes.length >= 3, `${outline?.scenes?.length || 0} scenes`)
  const preserve = (outline?.scenes || []).some(scene => NARRATIVE.includes(String(scene.narration || '').split(/[.!?]/)[0].slice(0, 30).trim()))
  check('preserve policy: narration carries the author’s sentences', preserve)
  const modeled = await fetch(`${origin}/api/story/model`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ outline, projectId: PROJECT_ID }) }).then(r => r.json())
  check('the product validates and models the outline', Boolean(modeled.model?.id), modeled.model?.id)
  const receipt = artefacts?.story?.receipt
  check('the story receipt records the wording policy', receipt?.wordingPolicy === 'preserve', JSON.stringify(receipt || null))
  await fetch(`${origin}/api/projects/${PROJECT_ID}`, { method: 'DELETE' })
  check('cleanup', true)
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  app.kill('SIGTERM')
  await sleep(500)
  await rm(root, { recursive: true, force: true })
}
console.log(failures ? `STORY LIVE CHECK FAIL (${failures})` : 'STORY LIVE CHECK PASS')
process.exitCode = failures ? 1 : 0
