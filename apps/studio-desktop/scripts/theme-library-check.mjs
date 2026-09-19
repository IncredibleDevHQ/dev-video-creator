// D1 theme library check: themes are durable, revisioned and
// port-independent. Save → idempotent re-save → palette edit creates a new
// revision with the old one retained → app restart on a different port still
// lists the theme → a browser-cached theme is imported once → the library UI
// shows the revision badge. Cleans up its fixtures. Pattern per
// notebooks-hierarchy-check.mjs (smoke app + /__eval).
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const appDir = fileURLToPath(new URL('..', import.meta.url))
const electronBinary = require('electron')
const stamp = Date.now().toString(36)
const THEME_ID = `d1-theme-${stamp}`
const BROWSER_THEME_ID = `d1-browser-${stamp}`

const themeFixture = (id, name, accent) => ({
  version: 1,
  id,
  name,
  description: 'D1 check theme',
  source: 'custom',
  brand: { accent, background: '#0b1220', surface: '#111827', text: '#eef3fa', mutedText: '#94a3b8', primary: '#22c55e', secondary: '#3b82f6', codeBackground: '#0f172a' },
})

const startApp = async () => {
  const root = await mkdtemp(join(tmpdir(), 'studio-theme-'))
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
  return { app, origin, root }
}

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures += 1
}
const sleep = ms => new Promise(r => setTimeout(r, ms))
const post = (origin, body) =>
  fetch(`${origin}/api/themes`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json())
const list = origin => fetch(`${origin}/api/themes`).then(r => r.json())

let first
try {
  first = await startApp()
  const saved = await post(first.origin, { theme: themeFixture(THEME_ID, 'D1 check theme', '#f59e0b') })
  check('theme saved at revision 1', saved.saved?.revision === 1 && saved.saved?.unchanged === false, JSON.stringify(saved.saved && { revision: saved.saved.revision }))

  const again = await post(first.origin, { theme: themeFixture(THEME_ID, 'D1 check theme', '#f59e0b') })
  check('identical re-save is a no-op', again.saved?.unchanged === true && again.saved?.revision === 1)

  const edited = await post(first.origin, { theme: themeFixture(THEME_ID, 'D1 check theme', '#10b981') })
  check('palette edit creates revision 2', edited.saved?.revision === 2 && edited.saved?.unchanged === false, JSON.stringify(edited.saved && { revision: edited.saved.revision }))
  const afterEdit = await list(first.origin)
  const record = afterEdit.themes?.find(t => t.id === THEME_ID)
  check(
    'latest revision is the edit, old revision retained',
    record?.revision === 2 && record?.revisions === 2 && record?.theme?.brand?.accent === '#10b981',
    JSON.stringify(record && { revision: record.revision, revisions: record.revisions, accent: record.theme?.brand?.accent }),
  )
} catch (error) {
  check(`first app: ${error.message}`, false)
} finally {
  first?.app.kill('SIGTERM')
  await sleep(500)
  await rm(first?.root || '', { recursive: true, force: true }).catch(() => {})
}

// Restart on a different port: the theme must survive (server-side store).
let second
try {
  second = await startApp()
  const relisted = await list(second.origin)
  const record = relisted.themes?.find(t => t.id === THEME_ID)
  check('theme survives an app restart on a new port', record?.revision === 2 && record?.theme?.name === 'D1 check theme', second.origin)

  // Seed a browser-cached theme, reload, and let the app import it.
  const evaluate = async js => {
    const response = await fetch(`${second.origin}/__eval`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ js: `(${js})()` }),
    })
    const body = await response.json()
    if (!body.ok) throw new Error(body.error || 'eval failed')
    return body.result
  }
  await evaluate(`() => {
    window.localStorage.setItem('incredible-studio-v2-themes', JSON.stringify([${JSON.stringify(themeFixture(BROWSER_THEME_ID, 'D1 browser theme', '#ec4899'))}]))
    window.location.reload()
    return true
  }`)
  let imported = null
  for (let i = 0; i < 40; i += 1) {
    const themes = await list(second.origin).catch(() => null)
    imported = themes?.themes?.find(t => t.id === BROWSER_THEME_ID)
    if (imported) break
    await sleep(500)
  }
  check('browser-cached theme imported into the durable library', Boolean(imported), imported && `revision ${imported.revision}`)

  const badge = await evaluate(`() => {
    const card = document.querySelector('#theme-library-grid [data-theme-id="${THEME_ID}"]')
    return card ? card.querySelector('.theme-card-meta span')?.textContent || '' : null
  }`)
  check('library card shows the revision badge', badge === 'custom · rev 2', String(badge))

  const del1 = await fetch(`${second.origin}/api/themes/${THEME_ID}`, { method: 'DELETE' }).then(r => r.json())
  const del2 = await fetch(`${second.origin}/api/themes/${BROWSER_THEME_ID}`, { method: 'DELETE' }).then(r => r.json())
  check('cleanup', del1.deleted === true && del2.deleted === true, 'both fixture themes deleted')
} catch (error) {
  check(`second app: ${error.message}`, false)
} finally {
  second?.app.kill('SIGTERM')
  await sleep(500)
  await rm(second?.root || '', { recursive: true, force: true }).catch(() => {})
}
console.log(failures ? `THEME LIBRARY CHECK FAIL (${failures})` : 'THEME LIBRARY CHECK PASS')
process.exitCode = failures ? 1 : 0
