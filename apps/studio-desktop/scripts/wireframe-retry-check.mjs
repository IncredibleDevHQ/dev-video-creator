// R01 of the project-flow rereview: a wireframe that was stopped, or whose
// provider failed, is made again from the same article — as it was stored —
// without importing it again, on whichever harness the creator chooses now.
//
// The whole seam is exercised through the app: the studio reads the stored
// source revision from the server's one route for it, starts the story run
// on the harness chosen now, and the server builds the pages. A stub kimi
// plays a story run that runs until it is stopped, then one whose provider
// is out of credits; a stub Claude Code, switched to for the story stage,
// outlines the article. The local file store in a temp directory keeps
// every database out of it.
import { spawn } from 'node:child_process'
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const appDir = fileURLToPath(new URL('..', import.meta.url))
const electronBinary = require('electron')
const root = await mkdtemp(join(tmpdir(), 'studio-wireframe-retry-'))
const binDir = join(root, 'bin')
const controlPath = join(root, 'kimi-mode')
await mkdir(binDir, { recursive: true })
const setKimi = mode => writeFile(controlPath, mode)
await setKimi('hang')

// The outline both stubs write when they outline: two scenes, from the
// article they were given.
const outlineWriter = String.raw`
const writeOutline = () => {
  const inputs = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'motion', 'inputs.json'), 'utf8'))
  if (!inputs.source || typeof inputs.source.text !== 'string' || !inputs.source.text.trim()) return false
  const scenes = [1, 2].map(index => ({ title: 'Scene ' + index, idea: 'How dispatch reaches the experts, part ' + index + '.', kind: 'diagram', seconds: 12, parts: [{ label: 'Token', kind: 'box', detail: 'one token' }], relations: [], narration: 'Tokens travel to their experts.', source: [] }))
  fs.mkdirSync(path.join(process.cwd(), 'story'), { recursive: true })
  fs.writeFileSync(path.join(process.cwd(), 'story', 'outline.json'), JSON.stringify({ title: 'How dispatch reaches the experts', targetSeconds: 24, scenes, glossary: [] }))
  return true
}`
await writeFile(join(binDir, 'kimi'), `#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
if (process.argv.includes('--version')) { console.log('kimi stub 1.0'); process.exit(0) }
${outlineWriter}
const emit = value => process.stdout.write(JSON.stringify(value) + '\\n')
const mode = fs.readFileSync(${JSON.stringify(controlPath)}, 'utf8').trim()
if (mode === 'hang') {
  emit({ role: 'assistant', content: 'Reading the article.' })
  setInterval(() => {}, 1000)
} else if (mode === 'fail') {
  process.stderr.write('stub provider: weekly usage limit reached\\n')
  process.exit(1)
} else {
  emit({ role: 'assistant', content: writeOutline() ? 'Planned 2 scenes.' : 'No article.' })
  process.exit(0)
}
`)
await writeFile(join(binDir, 'claude'), `#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
if (process.argv.includes('--version')) { console.log('9.9.9 (Claude Code stub)'); process.exit(0) }
${outlineWriter}
const emit = value => process.stdout.write(JSON.stringify(value) + '\\n')
emit({ type: 'system', subtype: 'init', session_id: 'stub-story', model: 'stub-cli-default' })
const wrote = writeOutline()
emit({ type: 'result', subtype: wrote ? 'success' : 'error', session_id: 'stub-story', result: wrote ? 'Planned 2 scenes.' : 'No article.' })
process.exit(wrote ? 0 : 1)
`)
await chmod(join(binDir, 'kimi'), 0o755)
await chmod(join(binDir, 'claude'), 0o755)

const ARTICLE = `# How dispatch reaches the experts

A mixture-of-experts layer sends each token to the GPUs that hold its experts. Inside a node the copies travel over NVLink; between nodes they travel over RDMA through the network cards.

The dispatch step splits each batch by destination. Tokens bound for a GPU in the same node are written straight into its memory, while tokens bound for the other node are staged and posted to the network card, which moves them without the GPU stopping its work.

The combine step brings every expert's result back to the GPU that sent the token, in the order the batch expects, so the next layer reads one tensor as if nothing had moved.`

const app = spawn(electronBinary, ['.', '--smoke', '--keep-running'], {
  cwd: appDir,
  env: { ...process.env, PATH: `${binDir}:${process.env.PATH}`, STUDIO_CLAUDE_BIN: join(binDir, 'claude'), STUDIO_ALLOW_MULTI_INSTANCE: '1', STUDIO_DATA_DIR: join(root, 'data'), STUDIO_OUTPUTS_DIR: join(root, 'outputs'), STUDIO_PERSISTENCE: 'local', STUDIO_ENABLE_TEST_HOOKS: '1' },
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
const evaluate = async (js, label = '') => {
  const response = await fetch(`${origin}/__eval`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ js: `(${js})()` }) })
  const body = await response.json()
  if (!body.ok) throw new Error(`${label || js.slice(0, 50)}: ${body.error || 'eval failed'}`)
  return body.result
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const waitFor = async (js, label, tries = 90) => {
  for (let i = 0; i < tries; i += 1) {
    const value = await evaluate(js, label).catch(() => null)
    if (value) return value
    await sleep(500)
  }
  return null
}
const capture = async name => {
  if (!process.env.WIREFRAME_RETRY_CAPTURE_DIR) return
  const response = await fetch(`${origin}/__capture`).catch(() => null)
  if (response?.ok) await writeFile(join(process.env.WIREFRAME_RETRY_CAPTURE_DIR, `${name}.png`), Buffer.from(await response.arrayBuffer()))
}
const api = path => fetch(`${origin}${path}`).then(response => response.json())
const storyRuns = async () => (await api('/api/runs')).runs.filter(run => run.skill === 'story-master').sort((a, b) => String(a.startedAt || a.createdAt).localeCompare(String(b.startedAt || b.createdAt)))
const inputsOf = async run => JSON.parse(await readFile(join(run.projectDir, 'motion', 'inputs.json'), 'utf8').catch(() => '{}'))
const banner = `() => { const box = document.getElementById('notebook-build-status'); if (!box || box.hidden) return null; const action = document.getElementById('notebook-build-action'); const settings = document.getElementById('notebook-build-settings'); return { text: document.getElementById('notebook-build-text').textContent, error: box.classList.contains('is-error'), action: action.hidden ? '' : action.textContent, settings: !settings.hidden, kind: document.body.dataset.notebookKind } }`
const bannerSays = (pattern, label, tries = 90) => waitFor(`() => { const seen = (${banner})(); return seen && ${pattern}.test(seen.text) ? seen : null }`, label, tries)

try {
  await fetch(`${origin}/api/settings/harness`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ default: { harness: 'kimi', model: null } }) })
  await evaluate(`() => { window.location.assign('/studio'); return true }`, 'open studio')
  check('studio booted', Boolean(await waitFor(`() => Boolean(document.querySelector('#editor .ProseMirror'))`, 'boot')))

  // The article, pasted and read; the brand chosen; the project made — its
  // story run on Kimi.
  await evaluate(`() => { window.__source.open('narrative'); return true }`, 'open source')
  await evaluate(`() => { const field = document.getElementById('source-narrative'); field.value = ${JSON.stringify(ARTICLE)}; field.dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('source-read').click(); return true }`, 'read')
  await waitFor(`() => !document.getElementById('source-step-brand').hidden && !window.__source.state().busy && !document.getElementById('source-to-outline').disabled ? true : null`, 'brand step', 120)
  const snapshot = await evaluate(`() => window.__source.state().snapshot.id`, 'snapshot')
  await evaluate(`() => { document.getElementById('source-to-outline').click(); return true }`, 'create the project')
  const text = await waitFor(`() => document.body.dataset.notebookKind === 'text' && document.querySelectorAll('#notebook-switch .notebook-switch-tab').length === 4 ? localStorage.getItem('incredible-studio-v2-active-project') : null`, 'the text opens', 120)
  check('the project opens on its text while Kimi outlines it', Boolean(text))
  const textNotebook = (await api(`/api/projects/${encodeURIComponent(text)}`)).project
  const container = textNotebook?.container?.id
  const wireframeOf = async () => {
    const view = await api(`/api/containers/${encodeURIComponent(container)}`)
    const rows = (view.notebooks || []).filter(entry => entry.kind === 'wireframe')
    return { rows, notebook: rows[0] ? (await api(`/api/projects/${encodeURIComponent(rows[0].id)}`)).project : null }
  }

  // R02 of the project-flow rereview: the text says what the project is
  // made from and what is being made, after its notice has gone — and opens
  // it from there.
  const strip = await waitFor(`() => { const strip = document.getElementById('project-strip'); const job = strip?.querySelector('.project-strip-job[data-kind="wireframe"]'); return strip && !strip.hidden && job ? { source: document.getElementById('project-strip-source').textContent, brand: document.getElementById('project-strip-brand').hidden ? '' : document.getElementById('project-strip-brand').textContent, job: job.textContent } : null }`, 'project strip', 40)
  check('the text shows the project\'s source and brand, and the wireframe being made', /^Source How dispatch reaches the experts/.test(strip?.source || '') && strip.job === 'Wireframe: being made', JSON.stringify(strip))

  // Stopped while it is outlined — opened from the strip.
  await evaluate(`() => { setTimeout(() => document.querySelector('#project-strip .project-strip-job[data-kind="wireframe"]').click(), 0); return true }`, 'open the wireframe from the strip')
  const running = await bannerSays('/is outlining/', 'running banner')
  check('the wireframe says Kimi is outlining it, and can be stopped', running?.kind === 'wireframe' && /^Kimi\b/.test(running.text) && running.action === 'Stop' && !running.settings, JSON.stringify(running))
  // R02: a wireframe being made is the job, where its pages will be — never
  // an empty notebook's starter — and nothing is offered that would refuse
  // for lack of pages.
  const building = await evaluate(`() => {
    const visible = element => Boolean(element) && element.getClientRects().length > 0
    const panel = document.getElementById('notebook-build-status')
    const next = document.getElementById('next-step')
    return { starter: visible(document.getElementById('notebook-start')), heading: document.getElementById('notebook-build-heading').textContent, meta: document.getElementById('notebook-build-meta').textContent, placeholders: visible(document.getElementById('notebook-build-pages')), panelFirst: panel.getBoundingClientRect().top < document.getElementById('editor').getBoundingClientRect().top, next: visible(next) ? { label: next.textContent, disabled: next.disabled, title: next.title } : null }
  }`, 'building state')
  check('a wireframe being made shows its job and its pages to come, never an empty notebook\'s starter', !building.starter && building.heading === 'Making the wireframe' && /^Kimi\b.* · \d+s|:\d\d/.test(building.meta) && building.placeholders && building.panelFirst, JSON.stringify(building))
  check('Design presentation waits for the pages, and says why', building.next?.label === 'Design presentation' && building.next.disabled && /still being made/.test(building.next.title), JSON.stringify(building.next))
  await capture('01-outlining')
  const first = await wireframeOf()
  check('its build is the first attempt, on Kimi, at the stored article', first.notebook?.build?.attempts === 1 && Boolean(first.notebook.build.attempt) && first.notebook.build.harness === 'kimi' && first.notebook.build.sourceRevision === snapshot, JSON.stringify(first.notebook?.build && { attempts: first.notebook.build.attempts, attempt: first.notebook.build.attempt, harness: first.notebook.build.harness, sourceRevision: first.notebook.build.sourceRevision }))
  await evaluate(`() => { document.getElementById('notebook-build-action').click(); return true }`, 'stop')
  const stopped = await bannerSays('/It was stopped/', 'stopped banner', 120)
  check('stopped, it says so and offers to make it again', stopped?.error === true && stopped.action === 'Make it again' && stopped.settings, JSON.stringify(stopped))
  await capture('02-stopped')

  // Made again — its provider now out of credits.
  await setKimi('fail')
  await evaluate(`() => { document.getElementById('notebook-build-action').click(); return true }`, 'make it again (kimi)')
  const quota = await bannerSays('/usage limit/', 'provider failure banner', 120)
  check('made again, the story run starts on the stored article — never "could not be found" — and the provider\'s failure is said with what to do', quota?.error === true && /^The wireframe could not be made: The story run failed: .*weekly usage limit reached\. Retry after restoring Kimi credits, or switch harness or model\.$/.test(quota.text) && quota.action === 'Make it again' && quota.settings, JSON.stringify(quota))
  await capture('03-provider-failed')
  const second = await wireframeOf()
  check('the second attempt is its own, on the same article', second.notebook?.build?.attempts === 2 && second.notebook.build.attempt !== first.notebook.build.attempt && second.notebook.build.sourceRevision === snapshot && second.notebook.build.failure?.recovery?.length === 2, JSON.stringify(second.notebook?.build && { attempts: second.notebook.build.attempts, attempt: second.notebook.build.attempt, failure: second.notebook.build.failure }))

  // The creator switches the story stage to Claude Code, from AI settings.
  await evaluate(`() => { document.getElementById('notebook-build-settings').click(); return true }`, 'open AI settings')
  const settingsOpen = await waitFor(`() => document.getElementById('ai-settings-dialog')?.open ? true : null`, 'AI settings', 20)
  check('AI settings opens from the failed wireframe, to switch provider', Boolean(settingsOpen))
  await evaluate(`() => { document.getElementById('ai-settings-dialog').close(); return true }`, 'close AI settings')
  await fetch(`${origin}/api/settings/harness`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stages: { story: { harness: 'claude-code', model: null } } }) })
  await evaluate(`() => { document.getElementById('notebook-build-action').click(); return true }`, 'make it again (claude code)')
  const made = await waitFor(`() => { const status = document.querySelector('#notebook-switch [data-kind="wireframe"] small')?.textContent || ''; const box = document.getElementById('notebook-build-status'); return status === '2 pages' && box.hidden && document.querySelectorAll('#editor .notebook-scene-block').length === 2 ? { status, toast: document.getElementById('toast')?.textContent || '' } : null }`, 'wireframe made', 120)
  check('made again on Claude Code, its pages land in the same wireframe, without importing again', Boolean(made), JSON.stringify(made))
  await capture('04-made')

  const third = await wireframeOf()
  const runs = await storyRuns()
  const given = await Promise.all(runs.map(inputsOf))
  const revision = await fetch(`${origin}/api/source/revisions/${encodeURIComponent(snapshot)}`).then(response => response.json())
  check('the project holds one wireframe, made — no second import, no second wireframe', third.rows.length === 1 && third.rows[0].id === first.rows[0].id && !third.notebook.build && third.notebook.notebook.content.filter(node => node.type === 'scene').length === 2, JSON.stringify({ wireframes: third.rows.length, build: third.notebook?.build || null }))
  check('three story runs — Kimi stopped, Kimi out of credits, Claude Code — each given the article as stored', runs.length === 3 && JSON.stringify(runs.map(run => run.adapter)) === '["kimi","kimi","claude-code"]' && JSON.stringify(runs.map(run => run.status)) === '["cancelled","error","done"]' && given.every(inputs => inputs.source?.text === revision.revision?.content?.text), JSON.stringify(runs.map((run, index) => ({ adapter: run.adapter, status: run.status, characters: String(given[index].source?.text || '').length }))))
  check('the stored source revision is served once, as { revision }, its article under content', Object.keys(revision).join() === 'revision' && revision.revision.content.text.includes('The dispatch step splits each batch by destination.'), JSON.stringify(Object.keys(revision)))
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  app.kill('SIGTERM')
  await sleep(500)
  await rm(root, { recursive: true, force: true })
}
console.log(failures ? `WIREFRAME RETRY CHECK FAIL (${failures})` : 'WIREFRAME RETRY CHECK PASS')
process.exitCode = failures ? 1 : 0
