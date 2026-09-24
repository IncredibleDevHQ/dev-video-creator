// Issue #15 (P2): an object review receipt used to pass finish/export on
// existence alone — a different source hash, an obsolete skill version, and
// no clips or frames all went through. The receipt now binds the exact
// embedded performance revision per scene (clip subtrees + clip ids) plus the
// current asset hash and skill version, and readExplainer validates that
// binding: editing a clip or embedding another revision makes the review
// stale until re-reviewed. Tool-bundle pattern per object-review-check.mjs
// (dist-electron layout + skills symlink, stubbed renderer).
import { build } from 'esbuild'
import { mkdtemp, mkdir, rm, symlink, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const skillText = await readFile(new URL('../skills/explainer-master/SKILL.md', import.meta.url), 'utf8')
const expectedSkillVersion = /^ {2}version:\s*["']?([^"'\n]+)/m.exec(skillText)?.[1]?.trim()
const dir = await mkdtemp(join(tmpdir(), 'object-review-binding-'))
const projectDir = join(dir, 'run-binding')
const previousFetch = globalThis.fetch

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures += 1
}

const KEY = 'aabbccddeeff00112233'
const ASSET_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><svg id="performance" data-object-clip="1" data-duration-ms="900" width="400" height="400"><circle cx="60" cy="60" r="18"><animate attributeName="r" values="18;14;18" dur="0.9s" fill="freeze"/></circle></svg></svg>'
const sceneSvgWith = clip => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" data-scene-mode="explainer"><g id="tank" data-role="node"><g data-appearance-for="tank" data-appearance-key="${KEY}"><svg id="tank-performance" data-object-clip="1" data-duration-ms="900" width="400" height="400"><circle cx="60" cy="60" r="18"><animate attributeName="r" values="${clip}" dur="0.9s" fill="freeze"/></circle></svg></g></g></svg>`
const SCENE_SVG = sceneSvgWith('18;14;18')

try {
  // The real tool bundle; the hidden renderer is stubbed to a passing review.
  await mkdir(join(dir, 'dist-electron'), { recursive: true })
  await symlink(fileURLToPath(new URL('../skills', import.meta.url)), join(dir, 'skills'), 'dir')
  await build({
    entryPoints: [fileURLToPath(new URL('../src/mcp/explainer-tools.ts', import.meta.url))],
    bundle: true, platform: 'node', format: 'esm', outfile: join(dir, 'dist-electron', 'tools.mjs'),
    plugins: [{ name: 'stub-render-window', setup(b) {
      b.onResolve({ filter: /hidden-window$/ }, () => ({ path: 'window', namespace: 'stub' }))
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: `export const runAtomizer = async name => name === 'reviewObjectClip' ? { errors: [], warnings: [], captures: [{ clipId: 'performance', atMs: 0, label: 'rest' }, { clipId: 'performance', atMs: 450, label: 'action' }, { clipId: 'performance', atMs: 899, label: 'settle' }], clips: [{ id: 'performance', durationMs: 900 }], fidelity: { kept: 1, total: 1 } } : undefined; export const captureHiddenPage = async () => Buffer.from([]);` }))
    } }],
  })
  const { EXPLAINER_TOOLS } = await import(pathToFileURL(join(dir, 'dist-electron', 'tools.mjs')))
  const tool = name => EXPLAINER_TOOLS.find(t => t.name === name)
  const context = { origin: 'http://fixture' }
  const stable = value => JSON.stringify(value, (_k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v)
  const hashOf = (svg, program) => createHash('sha256').update(svg).update(stable(program)).digest('hex')
  const save = (name, value) => writeFile(join(projectDir, name), JSON.stringify(value))
  const receiptPath = join(projectDir, 'explainer', 'objects', `${KEY}.review.json`)

  // The run: one scene embedding the accepted object with a performing clip.
  const program = { version: 1, cast: [{ id: 'tank' }], beats: [{ say: 'The tank fills on cue.', events: [] }] }
  const writeScene = async svg => {
    await writeFile(join(projectDir, 'explainer', 'scene.svg'), svg)
    await save('explainer/scene.program.json', program)
    await save('explainer/scene.proof.json', { hash: hashOf(svg, program), errors: [], warnings: [], frames: [{ atMs: 0, path: 'review.png' }], program, plan: { version: 2, steps: [{ motionWindowMs: 100, holdMs: 1900, actions: [] }] }, windows: [], durationMs: 2000 })
    await save('explainer/scene.narration.json', { hash: hashOf(svg, program), audioUrl: 'http://fixture/scene.mp3' })
  }
  await mkdir(join(projectDir, 'explainer', 'assets'), { recursive: true })
  await mkdir(join(projectDir, 'motion'), { recursive: true })
  await writeScene(SCENE_SVG)
  await save('explainer/story.json', { scenes: [{ id: 'scene', file: 'scene', title: 'Tank', question: 'Why?', answer: 'It fills.', review: 'States checked.', assets: [KEY] }] })
  await save('motion/inputs.json', { projectId: 'video', scenes: [{ id: 'scene', svg: 'wireframe', script: '' }] })
  await save(`explainer/assets/${KEY}.json`, { key: KEY, entity: 'tank', accepted: true, svg: ASSET_SVG, operation: 'animate' })

  let project = {
    version: 1, id: 'video', title: 'Binding fixture', derivedFrom: { notebook: 'base' },
    notebook: { type: 'doc', content: [{ type: 'scene', attrs: { id: 'scene', svg: 'wireframe', script: '' } }] },
    fps: 30, width: 1920, height: 1080,
    blocks: { scene: { nodeId: 'scene', durationMs: 6000 } },
    presenterTracks: {}, recordedBlocks: {},
  }
  let putCalls = 0
  globalThis.fetch = async (url, options) => {
    const u = String(url)
    if (u.endsWith('/api/review-fonts')) return Response.json({ css: '', shipped: [], substituted: {} })
    if (u.endsWith('/api/takes/clear')) return Response.json({ cleared: true })
    if (u.endsWith('/api/projects/video')) {
      if (options?.method === 'PUT') { putCalls += 1; project = JSON.parse(options.body).project || JSON.parse(options.body) }
      return Response.json({ project })
    }
    if (u.endsWith('/api/preview')) return Response.json({})
    if (u.endsWith('/api/appearance/verify-cast')) return Response.json({ ok: true, cast: [{ key: KEY, status: 'verified', tokensFound: 1, tokensTotal: 1 }] })
    if (u.includes('/api/runs/') && u.endsWith('/stages')) return Response.json({ saved: true })
    throw new Error(`Unexpected fixture URL: ${url}`)
  }
  const finish = () => tool('explainer_finish').call({ projectDir }, context)
  const refusalOf = promise => promise.then(() => '', error => String(error?.message || error))

  // A review written before the object is embedded binds nothing.
  const reviewed = await tool('explainer_review_object').call({ projectDir, key: KEY }, context)
  check('the isolated review passes the fixture performance', reviewed.errors.length === 0, JSON.stringify(reviewed.errors))
  const receipt = JSON.parse(await readFile(receiptPath, 'utf8'))
  check('the receipt binds the scene\'s embedded performance revision', receipt.performances?.length === 1 && receipt.performances[0].scene === 'scene' && /^[0-9a-f]{64}$/.test(receipt.performances[0].hash), JSON.stringify(receipt.performances))
  check('the binding names the performed clip ids', JSON.stringify(receipt.performances?.[0]?.clips) === '["tank-performance"]', JSON.stringify(receipt.performances?.[0]?.clips))
  check('the receipt keeps the asset hash, skill version, clips and frames', receipt.sourceHash === createHash('sha256').update(ASSET_SVG).digest('hex') && receipt.skillVersion === expectedSkillVersion && receipt.clips?.length === 1 && receipt.frames?.length === 3)

  const applied = await finish()
  check('a bound receipt lets the finish through', applied?.projectId === 'video' && putCalls === 1, JSON.stringify(applied).slice(0, 100))

  // The probe: a clip edit inside the scene (re-previewed, so the proof is
  // current) makes the review stale until the object is re-reviewed.
  await writeScene(sceneSvgWith('18;4;18'))
  const clipRefusal = await refusalOf(finish())
  check('a modified clip makes the review stale', /embedded performance changed/.test(clipRefusal), clipRefusal.slice(0, 130))
  check('the stale finish wrote nothing', putCalls === 1, `putCalls=${putCalls}`)
  await tool('explainer_review_object').call({ projectDir, key: KEY }, context)
  const reviewedAgain = await finish()
  check('re-reviewing binds the edited performance and the finish proceeds', reviewedAgain?.projectId === 'video' && putCalls === 2)

  // Another artwork revision under the same key: the source hash no longer
  // matches the receipt.
  const assetPath = join(projectDir, 'explainer', 'assets', `${KEY}.json`)
  const originalAsset = await readFile(assetPath, 'utf8')
  await save(`explainer/assets/${KEY}.json`, { key: KEY, entity: 'tank', accepted: true, svg: ASSET_SVG.replace('r="18"', 'r="24"'), operation: 'animate' })
  const revisionRefusal = await refusalOf(finish())
  check('another artwork revision makes the review stale', /different revision/.test(revisionRefusal) && putCalls === 2, revisionRefusal.slice(0, 130))
  await writeFile(assetPath, originalAsset)

  // The rest of the probe's tampered receipt: obsolete instructions, and no
  // clips or frames.
  const soundReceipt = await readFile(receiptPath, 'utf8')
  const tampered = JSON.parse(soundReceipt)
  tampered.skillVersion = '0.0.0-obsolete'
  await writeFile(receiptPath, JSON.stringify(tampered))
  const skillRefusal = await refusalOf(finish())
  check('an obsolete skill version makes the review stale', /predates the current review instructions/.test(skillRefusal) && putCalls === 2, skillRefusal.slice(0, 130))
  const bare = JSON.parse(soundReceipt)
  delete bare.performances
  bare.clips = []
  bare.frames = []
  await writeFile(receiptPath, JSON.stringify(bare))
  const bareRefusal = await refusalOf(finish())
  check('a receipt with no binding, clips or frames is refused', /embedded performance changed/.test(bareRefusal) && putCalls === 2, bareRefusal.slice(0, 130))
  await writeFile(receiptPath, soundReceipt)
  const restored = await finish()
  check('the sound receipt finishes again', restored?.projectId === 'video' && putCalls === 3)
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  globalThis.fetch = previousFetch
  await rm(dir, { recursive: true, force: true })
}
console.log(failures ? `OBJECT REVIEW BINDING CHECK FAIL (${failures})` : 'OBJECT REVIEW BINDING CHECK PASS')
process.exitCode = failures ? 1 : 0
