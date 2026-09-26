// Brand-step reuse check (review finding #10): the source wizard's brand step
// must offer an explicit choice between a saved theme revision, the freshly
// generated directions, and a custom palette — and the bound choice (fonts
// and colours) is what pages, the page-drawing brief and the explainer build
// consume, never a regenerated default. A narrative without a site still gets
// the saved-theme choice. A deliberately customized saved site theme (rev 2
// carries the custom palette and fonts) is picked, then verified through the
// project's notebooks → its wireframe's pages → the presentation's drawing
// brief → build inputs. Pattern per
// wording-preserve-check.mjs (stub kimi on PATH + /__eval); the local file
// store keeps the shared database out of the fixture.
import { spawn } from 'node:child_process'
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const appDir = fileURLToPath(new URL('..', import.meta.url))
const electronBinary = require('electron')
const root = await mkdtemp(join(tmpdir(), 'studio-theme-reuse-'))
const stamp = Date.now().toString(36)
const THEME_ID = `reuse-theme-${stamp}`

// The author's own sentences (Keep my wording is the narrative default).
const SENTENCE_ONE = 'When a service recovers, every client retries at once and the surge knocks it back down.'
const SENTENCE_TWO = 'Jitter spreads those retries across a quiet window, so the service stays alive.'
const NARRATIVE = `# Retry storms\n\n${SENTENCE_ONE}\n\n${SENTENCE_TWO}`

// The deliberately customized saved site theme: revision 2 carries the custom
// palette and the site's fonts. Nothing generated from a read shares these.
const CUSTOM = {
  background: '#0d2137',
  surface: '#12283f',
  text: '#eef7ff',
  mutedText: '#8fb0c9',
  primary: '#ff8800',
  secondary: '#00c2a8',
  accent: '#ff2fb3',
  codeBackground: '#081522',
}
const FONTS = { display: 'Fixture Display', body: 'Fixture Body', mono: 'Fixture Mono', seen: ['Fixture Display', 'Fixture Body', 'Fixture Mono'] }
const themeFixture = (brand, fonts) => ({
  version: 1,
  id: THEME_ID,
  name: 'Fixture Brand',
  description: 'Saved site theme fixture',
  source: 'custom',
  brand,
  ...(fonts ? { fonts } : {}),
})

// A stub kimi on PATH: --version answers, a story-master run plans the
// outline from the run's own inputs (one scene per authored sentence), and
// any other run (page-master, explainer-master) simply ends. No real agent.
const binDir = join(root, 'bin')
await mkdir(binDir, { recursive: true })
await writeFile(
  join(binDir, 'kimi'),
  `#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
if (process.argv.includes('--version')) { console.log('kimi stub 1.0'); process.exit(0) }
const emit = value => process.stdout.write(JSON.stringify(value) + '\\n')
let inputs = null
try { inputs = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'motion', 'inputs.json'), 'utf8')) } catch {}
if (inputs && inputs.source && typeof inputs.source.text === 'string') {
  const body = inputs.source.text.split('\\n').filter(line => line.trim() && !line.trim().startsWith('#')).join(' ')
  const sentences = (body.match(/[^.!?]+[.!?]+/g) || [body]).map(s => s.trim()).filter(Boolean)
  const scenes = sentences.slice(0, 3).map((sentence, index) => ({
    title: 'Scene ' + (index + 1),
    idea: sentence,
    kind: 'diagram',
    seconds: 12,
    parts: [{ label: 'Clients', kind: 'box', detail: 'retrying together' }, { label: 'Service', kind: 'box', detail: 'recovering' }],
    relations: [{ from: 'Clients', to: 'Service', verb: 'sends to' }],
    narration: sentence,
    source: [sentence],
  }))
  fs.mkdirSync(path.join(process.cwd(), 'story'), { recursive: true })
  fs.writeFileSync(path.join(process.cwd(), 'story', 'outline.json'), JSON.stringify({ title: 'Retry storms', targetSeconds: scenes.length * 12, scenes, glossary: [] }))
  fs.writeFileSync(path.join(process.cwd(), 'story', 'receipt.json'), JSON.stringify({ scenes: scenes.length, wordingPolicy: inputs.wordingPolicy || 'preserve' }))
  emit({ role: 'assistant', content: 'Planned ' + scenes.length + ' scenes.' })
} else {
  emit({ role: 'assistant', content: 'stub run' })
}
emit({ role: 'meta', type: 'session.resume_hint', session_id: 'stub-session-reuse' })
process.exit(0)
`,
)
await chmod(join(binDir, 'kimi'), 0o755)

const app = spawn(electronBinary, ['.', '--smoke', '--keep-running'], {
  cwd: appDir,
  env: {
    ...process.env,
    STUDIO_ALLOW_MULTI_INSTANCE: '1',
    PATH: `${binDir}:${process.env.PATH}`,
    STUDIO_DATA_DIR: join(root, 'data'),
    STUDIO_OUTPUTS_DIR: join(root, 'outputs'),
    STUDIO_PERSISTENCE: 'local',
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
const evaluate = async (js, label = '') => {
  const response = await fetch(`${origin}/__eval`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ js: `(${js})()` }),
  })
  const body = await response.json()
  if (!body.ok) throw new Error(`${label || js.slice(0, 50)}: ${body.error || 'eval failed'}`)
  return body.result
}
const sleep = ms => new Promise(r => setTimeout(r, ms))
const waitFor = async (js, label, tries = 90) => {
  for (let i = 0; i < tries; i += 1) {
    const value = await evaluate(js, label).catch(() => null)
    if (value) return value
    await sleep(500)
  }
  return null
}
const projectBody = async id =>
  fetch(`${origin}/api/projects/${encodeURIComponent(id)}`).then(r => r.json()).then(body => body.project || null).catch(() => null)
const runInputs = async route => {
  for (let i = 0; i < 120; i += 1) {
    const runs = await fetch(`${origin}/api/runs`).then(r => r.json()).then(body => body.runs || []).catch(() => [])
    const run = runs.find(candidate => candidate.route === route)
    if (run?.projectDir) {
      const inputs = JSON.parse(await readFile(join(run.projectDir, 'motion', 'inputs.json'), 'utf8').catch(() => 'null'))
      if (inputs) return inputs
    }
    await sleep(500)
  }
  return null
}

try {
  // The saved theme: revision 1 plain, revision 2 the deliberate
  // customization (palette + fonts) a creator saves from the theme library.
  const firstSave = await fetch(`${origin}/api/themes`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ theme: themeFixture({ ...CUSTOM, accent: '#111111' }, null), site: 'fixture.example' }),
  }).then(r => r.json())
  check('the theme saves at revision 1', firstSave.saved?.revision === 1, JSON.stringify(firstSave.saved || null))
  const customized = await fetch(`${origin}/api/themes`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ theme: themeFixture(CUSTOM, FONTS) }),
  }).then(r => r.json())
  check('the deliberate customization is revision 2', customized.saved?.revision === 2, JSON.stringify(customized.saved || null))

  // Boot the studio UI on a fresh notebook.
  await evaluate(`() => { window.localStorage.setItem('studio.codingAgent', 'kimi'); window.location.assign('/studio'); return true }`, 'open studio')
  const booted = await waitFor(`() => Boolean(document.getElementById('app') && !document.getElementById('app').hidden && document.querySelector('#editor .ProseMirror'))`, 'boot')
  check('studio booted on a fresh notebook', Boolean(booted))

  // Generate automatically → My own narrative (no brand website: no site).
  await evaluate(`() => { document.getElementById('create-explainer').click(); return true }`, 'open chooser')
  await sleep(300)
  await evaluate(`() => { document.querySelector('#create-explainer-paths [data-delivery="generated"]').click(); return true }`, 'choose generated')
  await sleep(200)
  await evaluate(`() => { document.querySelector('#create-explainer-materials [data-material="narrative"]').click(); return true }`, 'own narrative')
  const dialogOpen = await waitFor(`() => document.getElementById('source-dialog')?.open === true`, 'source dialog')
  check('the source flow opens for the narrative', Boolean(dialogOpen))

  await evaluate(`() => { const box = document.getElementById('source-narrative'); box.value = ${JSON.stringify(NARRATIVE)}; document.getElementById('source-read').click(); return true }`, 'read')
  const brandStep = await waitFor(`() => !document.getElementById('source-step-brand')?.hidden`, 'brand step')
  check('the narrative is read', Boolean(brandStep))

  // The brand step's explicit choices: a saved theme revision (offered even
  // without a site), the freshly generated directions, a custom palette.
  const choices = await evaluate(`() => ({
    savedCards: [...document.querySelectorAll('#source-saved-themes [data-theme-id]')].map(card => ({ id: card.dataset.themeId, text: card.textContent || '', picked: card.classList.contains('is-picked') })),
    directions: document.querySelectorAll('#source-directions .source-direction').length,
    customColors: document.querySelectorAll('#source-custom-palette input[type="color"]').length,
  })`, 'brand choices')
  const savedCard = choices?.savedCards?.find(card => card.id === THEME_ID)
  check('the saved theme revision is offered even without a site', Boolean(savedCard), JSON.stringify(choices?.savedCards || null))
  check('the offered revision is the customized one', Boolean(savedCard && savedCard.text.includes('Fixture Brand') && savedCard.text.includes('rev 2')), savedCard?.text || '')
  check('the freshly generated directions are still offered', choices?.directions === 3, String(choices?.directions))
  check('a custom palette can be entered', (choices?.customColors || 0) >= 4, String(choices?.customColors))

  await evaluate(`() => { document.querySelector('#source-saved-themes [data-theme-id="${THEME_ID}"]')?.click(); return true }`, 'pick saved theme')
  const picked = await evaluate(`() => ({
    picked: document.querySelector('#source-saved-themes [data-theme-id="${THEME_ID}"]')?.classList.contains('is-picked') === true,
    directionsPicked: [...document.querySelectorAll('#source-directions .source-direction')].some(card => card.classList.contains('is-picked')),
  })`, 'picked state')
  check('picking the saved theme binds it (no direction stays picked)', picked?.picked === true && picked?.directionsPicked === false, JSON.stringify(picked))

  // The project opens on its text; its wireframe is drawn in the bound
  // brand, in the background.
  await evaluate(`() => { document.getElementById('source-to-outline').click(); return true }`, 'create the project')
  const textOpen = await waitFor(`() => document.getElementById('source-dialog')?.open === false && document.body.dataset.notebookKind === 'text' ? window.localStorage.getItem('incredible-studio-v2-active-project') : null`, 'text open', 120)
  check('the project opens on its text', Boolean(textOpen), String(textOpen))
  await waitFor(`() => document.querySelector('#notebook-switch [data-kind="wireframe"] small')?.textContent === '2 pages' ? true : null`, 'wireframe made', 120)
  await evaluate(`() => { setTimeout(() => document.querySelector('#notebook-switch [data-kind="wireframe"]').click(), 0); return true }`, 'open the wireframe')
  const finished = await waitFor(`() => document.body.dataset.notebookKind === 'wireframe' && document.querySelectorAll('#editor .notebook-scene-block').length === 2 ? window.localStorage.getItem('incredible-studio-v2-active-project') : null`, 'wireframe open', 120)
  check('its wireframe is made with both scenes', Boolean(finished), String(finished))

  const saved = finished ? await projectBody(finished) : null
  const sceneSvgs = (saved?.notebook?.content || []).filter(node => node.type === 'scene').map(node => String(node.attrs?.svg || ''))
  const text = textOpen ? await projectBody(textOpen) : null
  check(
    'the saved theme revision is bound to the project, not a regenerated direction',
    saved?.theme?.id === THEME_ID && text?.theme?.id === THEME_ID && !String(saved?.theme?.id || '').startsWith('generated-'),
    String(saved?.theme?.id || ''),
  )
  check(
    'the project brand is the customized palette',
    saved?.brand?.accent === CUSTOM.accent && saved?.brand?.background === CUSTOM.background && saved?.brand?.primary === CUSTOM.primary,
    JSON.stringify({ accent: saved?.brand?.accent, background: saved?.brand?.background, primary: saved?.brand?.primary }),
  )
  check(
    'every wireframe page carries the custom colours and fonts',
    sceneSvgs.length === 2 && sceneSvgs.every(svg => svg.includes(CUSTOM.accent) && svg.includes(CUSTOM.background) && svg.includes(FONTS.display)),
    sceneSvgs.map(svg => `${svg.includes(FONTS.display) ? 'font ok' : 'FONT MISSING'} ${svg.includes(CUSTOM.accent) ? 'accent ok' : 'ACCENT MISSING'}`).join(' | '),
  )

  // Designing the presentation: the drawing run's brand brief carries the
  // bound theme, fonts too.
  await waitFor(`() => document.getElementById('next-step').textContent === 'Design presentation' && !document.getElementById('next-step').hidden ? true : null`, 'design offered', 60)
  await evaluate(`() => { setTimeout(() => document.getElementById('next-step').click(), 0); return true }`, 'design presentation')
  const drawInputs = await runInputs('Draw Pages')
  check(
    'the drawing brief carries the saved theme palette',
    drawInputs?.brand?.palette?.accent === CUSTOM.accent && drawInputs?.brand?.palette?.ground === CUSTOM.background,
    JSON.stringify(drawInputs?.brand?.palette || null),
  )
  check('the drawing brief carries the saved theme fonts', drawInputs?.brand?.fonts?.display === FONTS.display, JSON.stringify(drawInputs?.brand?.fonts || null))
  await waitFor(`() => document.body.dataset.notebookKind === 'presentation' ? true : null`, 'presentation open', 120)

  // Build: the fork navigates into the video notebook and resumes there; the
  // run's inputs (what object briefs are built from) carry the bound brand.
  await evaluate(`() => { document.getElementById('build-explainer').click(); return true }`, 'build')
  const buildInputs = await runInputs('Build Explainer')
  check('the build dispatches an explainer run', Boolean(buildInputs))
  check(
    'the build inputs carry the bound theme colours',
    buildInputs?.brand?.accent === CUSTOM.accent && buildInputs?.brand?.background === CUSTOM.background,
    JSON.stringify(buildInputs?.brand || null).slice(0, 200),
  )

  // Cleanup: the fixture theme and every notebook this run touched.
  await fetch(`${origin}/api/themes/${THEME_ID}`, { method: 'DELETE' }).catch(() => {})
  const projects = await fetch(`${origin}/api/projects`).then(r => r.json()).then(body => (Array.isArray(body) ? body : body.projects) || []).catch(() => [])
  for (const entry of projects) {
    await fetch(`${origin}/api/projects/${encodeURIComponent(entry.id)}`, { method: 'DELETE' }).catch(() => {})
  }
  check('cleanup', true, `fixture theme and ${projects.length} notebooks deleted`)
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  app.kill('SIGTERM')
  await sleep(500)
  await rm(root, { recursive: true, force: true })
}
console.log(failures ? `SOURCE THEME REUSE CHECK FAIL (${failures})` : 'SOURCE THEME REUSE CHECK PASS')
process.exitCode = failures ? 1 : 0
