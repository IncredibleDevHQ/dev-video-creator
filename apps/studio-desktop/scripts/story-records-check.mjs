// D2 story-records check: narratives persist as immutable revisions under
// their wording policy (policy is part of the identity), and an outline
// becomes a durable explanation model with stable, collision-free ids.
// UI: the wording segment defaults to preserve for narratives and draft for
// links, and stays changeable. Pattern per theme-library-check.mjs.
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const appDir = fileURLToPath(new URL('..', import.meta.url))
const electronBinary = require('electron')
const root = await mkdtemp(join(tmpdir(), 'studio-story-'))
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

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures += 1
}
const post = (path, body) =>
  fetch(`${origin}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(async r => ({ status: r.status, body: await r.json() }))
const evaluate = async js => {
  const response = await fetch(`${origin}/__eval`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ js: `(${js})()` }) })
  const body = await response.json()
  if (!body.ok) throw new Error(body.error || 'eval failed')
  return body.result
}
const sleep = ms => new Promise(r => setTimeout(r, ms))

const NARRATIVE = '# Our deploys broke on Fridays\n\nWe shipped every Friday, and every Friday something small caught fire.\n\nThe fix was not courage; it was a smaller blast radius.'
const OUTLINE = {
  title: 'Friday deploys',
  targetSeconds: 60,
  scenes: [
    { title: 'The fire', idea: 'Friday deploys kept failing.', kind: 'diagram', seconds: 25, parts: [{ label: 'Deploy', kind: 'box', detail: 'weekly' }, { label: 'Pager', kind: 'box', detail: 'loud' }], relations: [{ from: 'Deploy', to: 'Pager', verb: 'triggers' }], narration: 'We shipped every Friday and something caught fire.', source: [] },
    { title: 'The fire', idea: 'Duplicate title, different scene.', kind: 'list', seconds: 20, parts: [{ label: 'Deploy', kind: 'box', detail: 'smaller now' }], relations: [], narration: 'The fix was a smaller blast radius.', source: [] },
  ],
  glossary: [],
}

try {
  const read1 = await post('/api/source/read', { narrative: NARRATIVE, wordingPolicy: 'preserve' })
  check('narrative read returns source + narrative revisions', Boolean(read1.body.snapshot?.id && read1.body.narrative?.id), JSON.stringify({ snapshot: read1.body.snapshot?.id, narrative: read1.body.narrative?.id }))

  const read2 = await post('/api/source/read', { narrative: NARRATIVE, wordingPolicy: 'assist' })
  check('wording policy is part of narrative identity', read2.body.narrative?.id && read2.body.narrative.id !== read1.body.narrative.id && read2.body.snapshot?.id === read1.body.snapshot?.id, `${read1.body.narrative?.id} vs ${read2.body.narrative?.id}`)

  const model1 = await post('/api/story/model', { outline: OUTLINE, sourceRevisionId: read1.body.snapshot.id, narrativeRevisionId: read1.body.narrative.id })
  const scenes = model1.body.model?.scenes || []
  const objects = model1.body.model?.objects || []
  const relations = model1.body.model?.relations || []
  check('explanation model persisted with an id', Boolean(model1.body.model?.id), model1.body.model?.id)
  check('duplicate titles get distinct scene ids', scenes.length === 2 && scenes[0].id !== scenes[1].id, scenes.map(s => s.id).join(' | '))
  check('the shared object keeps one identity across scenes', objects.find(o => o.label === 'Deploy')?.scenes?.length === 2, JSON.stringify(objects.map(o => o.id)))
  check('relations resolve to object ids', relations.length === 1 && /^obj-/.test(relations[0]?.from || '') && /^obj-/.test(relations[0]?.to || ''))
  const model2 = await post('/api/story/model', { outline: OUTLINE })
  check('the same outline resolves to the same model record', model2.body.model?.id === model1.body.model?.id)

  // UI: wording policy segment defaults and stays changeable.
  await evaluate(`() => { window.location.assign('/studio'); return true }`)
  let uiReady = false
  for (let i = 0; i < 40; i += 1) {
    uiReady = await evaluate(`() => Boolean(document.getElementById('create-explainer') && !document.getElementById('app').hidden)`, 'ui boot').catch(() => false)
    if (uiReady) break
    await sleep(500)
  }
  check('studio UI booted for the wording check', uiReady)
  const wording = await evaluate(`async () => {
    document.getElementById('create-explainer').click()
    await new Promise(r => setTimeout(r, 200))
    document.querySelector('#create-explainer-paths [data-delivery="human"]').click()
    await new Promise(r => setTimeout(r, 200))
    document.querySelector('#create-explainer-materials [data-material="narrative"]').click()
    await new Promise(r => setTimeout(r, 400))
    const active = document.querySelector('#source-wording-segment [data-wording].active')?.getAttribute('data-wording') || ''
    document.querySelector('#source-wording-segment [data-wording="assist"]').click()
    const switched = document.querySelector('#source-wording-segment [data-wording="assist"]').classList.contains('active')
    document.getElementById('source-dialog').close()
    return { active, switched }
  }`, 'wording segment')
  check('narrative defaults to "Keep my wording" and stays changeable', wording.active === 'preserve' && wording.switched === true, JSON.stringify(wording))
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  app.kill('SIGTERM')
  await sleep(500)
  await rm(root, { recursive: true, force: true })
}
console.log(failures ? `STORY RECORDS CHECK FAIL (${failures})` : 'STORY RECORDS CHECK PASS')
process.exitCode = failures ? 1 : 0
