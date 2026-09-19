// §5.4a object-review receipt provenance: the receipt records which accepted
// asset it covered (source hash) and which skill version's instructions shaped
// it — an artwork or instruction change invalidates the right proof.
// Tool-bundle pattern per narrate-guard-check.mjs (stubbed hidden renderer).
import { build } from 'esbuild'
import { mkdtemp, mkdir, rm, symlink, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const dir = await mkdtemp(join(tmpdir(), 'object-review-'))
const stageCalls = []

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures += 1
}

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><g id="body"><rect x="10" y="10" width="200" height="120"/></g><g id="contents" data-object-clip="fill"><circle cx="60" cy="60" r="18"><animate attributeName="r" values="18;14;18" dur="0.9s" fill="freeze"/></circle></g></svg>'
const KEY = 'aabbccddeeff00112233'

try {
  // The real tool bundle; the hidden renderer is stubbed to a passing review.
  // Layout mirrors production: dist-electron/tools.mjs with ../skills beside it.
  await mkdir(join(dir, 'dist-electron'), { recursive: true })
  await symlink(fileURLToPath(new URL('../skills', import.meta.url)), join(dir, 'skills'), 'dir')
  await build({
    entryPoints: [fileURLToPath(new URL('../src/mcp/explainer-tools.ts', import.meta.url))],
    bundle: true, platform: 'node', format: 'esm', outfile: join(dir, 'dist-electron', 'tools.mjs'),
    plugins: [{ name: 'stub-render-window', setup(b) {
      b.onResolve({ filter: /hidden-window$/ }, () => ({ path: 'window', namespace: 'stub' }))
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: `export const runAtomizer = async name => name === 'reviewObjectClip' ? { errors: [], warnings: [], captures: [], clips: [{ id: 'fill', durationMs: 900 }], fidelity: { kept: 1, total: 1 } } : undefined; export const captureHiddenPage = async () => Buffer.from([]);` }))
    } }],
  })
  const { EXPLAINER_TOOLS } = await import(pathToFileURL(join(dir, 'dist-electron', 'tools.mjs')))
  const reviewTool = EXPLAINER_TOOLS.find(t => t.name === 'explainer_review_object')
  check('explainer_review_object is in the tool set', Boolean(reviewTool))

  const previousFetch = globalThis.fetch
  globalThis.fetch = async (url, options) => {
    const u = String(url)
    if (u.includes('/api/runs/') && u.endsWith('/stages')) {
      stageCalls.push(JSON.parse(options?.body || '{}'))
      return Response.json({ saved: true })
    }
    throw new Error(`Unexpected fixture URL: ${url}`)
  }

  const projectDir = join(dir, 'run-object-review')
  await mkdir(join(projectDir, 'explainer', 'assets'), { recursive: true })
  await writeFile(join(projectDir, 'explainer', 'assets', `${KEY}.json`), JSON.stringify({
    key: KEY, entity: 'tank', accepted: true, svg: SVG, operation: 'animate',
    brief: { entity: 'tank', role: 'tank', parts: [{ id: 'body' }, { id: 'contents' }], style: { family: 'flat', palette: {} } },
    parts: [{ id: 'body' }], viewBox: { width: 400, height: 400 }, url: '/objects/tank.svg', createdAt: '2026-09-19T00:00:00.000Z',
    provenance: { provider: 'quiver', model: 'q', requestId: 'r' },
  }))

  try {
    const result = await reviewTool.call({ projectDir, key: KEY }, { origin: 'http://fixture' })
    check('the isolated review passes the fixture performance', Array.isArray(result.errors) && result.errors.length === 0, JSON.stringify(result.errors))
    const receipt = JSON.parse(await readFile(join(projectDir, 'explainer', 'objects', `${KEY}.review.json`), 'utf8'))
    const expectedHash = createHash('sha256').update(SVG).digest('hex')
    check('the receipt records the covered asset hash', receipt.sourceHash === expectedHash, receipt.sourceHash)
    check('the receipt records the skill version whose instructions shaped it', receipt.skillVersion === '1.0.0', receipt.skillVersion)
    check('the receipt keeps clips, fidelity and timestamp', receipt.clips?.[0]?.id === 'fill' && receipt.fidelity?.kept === 1 && Boolean(receipt.at))
    check('the object-review checkpoint landed', stageCalls.some(c => c.stage === 'object-review' && c.status === 'succeeded'), JSON.stringify(stageCalls))
  } finally {
    globalThis.fetch = previousFetch
  }
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  await rm(dir, { recursive: true, force: true })
}
console.log(failures ? `OBJECT REVIEW CHECK FAIL (${failures})` : 'OBJECT REVIEW CHECK PASS')
process.exitCode = failures ? 1 : 0
