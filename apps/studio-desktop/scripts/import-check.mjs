// Import SVG pages check: imports REAL ppt-master example pages through
// window.importSvgPages in the running app and verifies slide blocks appear,
// sanitised and titled, and the project persists.
// Usage: node scripts/import-check.mjs
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const appDir = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(import.meta.url)
const electronBinary = require('electron')

const SVG_BASE =
  'https://hugohe3.github.io/ppt-master-examples/examples/ppt169_attention_is_all_you_need/svg_final'
const PAGES = ['05_architecture.svg', '06_scaled_dot_product.svg', '07_multi_head.svg']

const results = []
const step = async (name, fn) => {
  try {
    const value = await fn()
    results.push([name, 'PASS', value])
  } catch (error) {
    results.push([name, 'FAIL', String(error && error.message ? error.message : error).slice(0, 220)])
  }
}
const j = async (base, p, init) => {
  const r = await fetch(base + p, init)
  const t = await r.text()
  let b
  try { b = JSON.parse(t) } catch { b = t }
  if (!r.ok) throw new Error(p + ' → ' + r.status + ' ' + String(b && b.error || b).slice(0, 120))
  return b
}

const root = await mkdtemp(join(tmpdir(), 'studio-import-'))
const dataDir = join(root, 'data')
const id = `import-${Date.now()}`
const app = spawn(electronBinary, ['.', '--smoke', '--keep-running'], {
  cwd: appDir,
  env: { ...process.env, STUDIO_ALLOW_MULTI_INSTANCE: '1', STUDIO_DATA_DIR: dataDir, STUDIO_ENABLE_TEST_HOOKS: '1' },
  stdio: ['ignore', 'pipe', 'inherit'],
})
const origin = await new Promise((resolve, reject) => {
  let buffer = ''
  const timeout = setTimeout(() => reject(new Error('app start timed out')), 90_000)
  app.stdout.on('data', chunk => {
    process.stdout.write(chunk)
    buffer += chunk.toString()
    const match = buffer.match(/STUDIO_ORIGIN (\S+)/)
    if (buffer.includes('SMOKE PASS') && match) { clearTimeout(timeout); resolve(match[1]) }
    if (buffer.includes('SMOKE FAIL')) { clearTimeout(timeout); reject(new Error('smoke failed')) }
  })
  app.once('exit', code => reject(new Error(`app exited (${code})`)))
})
const stopApp = async () => {
  if (app.exitCode !== null) return
  app.kill('SIGTERM')
  await new Promise(resolve => app.once('exit', resolve))
}
const evalInWindow = async js => {
  const response = await j(origin, '/__eval', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ js }),
  })
  if (!response.ok) throw new Error(response.error || 'eval failed')
  return response.result
}
const waitFor = async (js, timeoutMs = 30_000) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const value = await evalInWindow(js)
    if (value) return value
    await new Promise(resolve => setTimeout(resolve, 400))
  }
  throw new Error(`waitFor timed out: ${js.slice(0, 80)}`)
}

let pages
await step('fetch real ppt-master example SVGs', async () => {
  pages = await Promise.all(
    PAGES.map(async name => {
      const response = await fetch(`${SVG_BASE}/${name}`)
      if (!response.ok) throw new Error(`${name} → ${response.status}`)
      return { name, text: await response.text() }
    }),
  )
  if (!pages.every(page => page.text.includes('data-pptx-page-role'))) {
    throw new Error('fetched pages lack the ppt-master markers')
  }
  return pages.map(page => `${page.name} (${page.text.length}b)`).join(', ')
})

try {
  let summary
  await step('importSvgPages imports all pages as slide blocks', async () => {
    const project = {
      version: 1, id, title: 'Import check',
      notebook: { type: 'doc', content: [
        { type: 'heading', attrs: { id: 'blk-h1', level: 1 }, content: [{ type: 'text', text: 'Attention deck' }] },
      ] },
      fps: 30, width: 1920, height: 1080, blocks: {}, presenterTracks: {}, recordedBlocks: {}, brand: {}, theme: {},
    }
    await j(origin, '/api/projects/' + id, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(project) })
    await evalInWindow(`localStorage.setItem('incredible-studio-v2-active-project', '${id}'); location.href = '/studio'`)
    await waitFor(`!!document.querySelector('#editor .ProseMirror, #editor [contenteditable="true"]')`)
    // Inject a hostile copy of one page to prove the sanitiser.
    const hostile = {
      name: '99_evil.svg',
      text: pages[0].text.replace('<defs>', '<defs><script>alert(1)</script><foreignObject><div>x</div></foreignObject>') + '',
    }
    summary = await evalInWindow(`window.importSvgPages(${JSON.stringify([...pages, hostile].map(page => ({ name: page.name, text: page.text })))})`)
    if (summary.imported.length !== 4 || summary.failed.length !== 0) {
      throw new Error(JSON.stringify(summary).slice(0, 160))
    }
    return `${summary.imported.length} imported, 0 failed`
  })
  await step('a non-SVG file fails cleanly', async () => {
    const bad = await evalInWindow(`window.importSvgPages([{ name: 'notes.txt', text: 'not an svg' }])`)
    if (bad.failed.length !== 1) throw new Error(JSON.stringify(bad))
    return `failed: ${bad.failed[0].error}`
  })
  await step('slide blocks in the editor with titles from filenames', async () => {
    const figures = await waitFor(`[...document.querySelectorAll('#editor figure[data-block-type="slide"]')].length`)
    if (figures !== 4) throw new Error(`${figures} slide figures`)
    const titles = await evalInWindow(`[...document.querySelectorAll('#editor figure[data-block-type="slide"] strong')].map(el => el.textContent).join(' | ')`)
    if (!titles.includes('05 Architecture')) throw new Error(titles)
    return titles
  })
  await step('project persisted with sanitised svg attrs', async () => {
    // The studio saves through a debounced database sync — poll for it.
    let slides = []
    const deadline = Date.now() + 15_000
    while (Date.now() < deadline) {
      const { project } = await j(origin, '/api/projects/' + id)
      slides = (project.notebook?.content || []).filter(node => node.type === 'slide')
      if (slides.length === 4) break
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    if (slides.length !== 4) throw new Error(`${slides.length} slide nodes saved`)
    for (const slide of slides) {
      const svg = String(slide.attrs.svg || '')
      if (!svg.includes('<svg')) throw new Error('missing svg')
      if (/<script|<foreignObject|javascript:/i.test(svg)) throw new Error('unsanitised content in ' + slide.attrs.title)
      if (slide.attrs.structureApproved !== false) throw new Error('structureApproved should default false')
    }
    const titles = slides.map(slide => slide.attrs.title).join(' | ')
    return `${slides.length} slides saved, sanitised (${titles.slice(0, 80)})`
  })
  await step('cleanup', async () => {
    await j(origin, '/api/projects/' + id, { method: 'DELETE' })
    return 'test notebook deleted'
  })
} finally {
  await stopApp()
  for (const [name, status, value] of results) {
    console.log(`${status}  ${name}  ${typeof value === 'string' ? value : JSON.stringify(value)}`)
  }
  const failures = results.filter(result => result[1] === 'FAIL').length
  console.log(failures ? `IMPORT CHECK FAIL (${failures})` : 'IMPORT CHECK PASS')
  await rm(root, { recursive: true, force: true })
  process.exit(failures ? 1 : 0)
}
