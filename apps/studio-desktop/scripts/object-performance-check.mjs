// Real Chromium clocks, including the same ID prefix used by final composition.
import { build } from 'esbuild'
import puppeteer from 'puppeteer'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
const bundled = await build({ entryPoints: [fileURLToPath(new URL('../../../packages/markdown-composition/src/motion-driver.ts', import.meta.url))], bundle: true, platform: 'browser', format: 'iife', globalName: 'Driver', write: false })
const browser = await puppeteer.launch({ headless: true })
try {
  const page = await browser.newPage()
  await page.setContent('<svg id="stage" viewBox="0 0 400 200"><svg id="scene-a" data-object-clip="move" data-duration-ms="1000"><circle id="moving" cx="0" cy="30" r="8"><animate attributeName="cx" from="0" to="100" dur="1s" fill="freeze"/></circle></svg><svg id="scene-b" data-object-clip="move" data-duration-ms="1000"><circle id="waiting" cx="0" cy="60" r="8"><animate attributeName="cx" from="0" to="100" dur="1s" fill="freeze"/></circle></svg></svg>')
  await page.addScriptTag({ content: bundled.outputFiles[0].text })
  const result = await page.evaluate(() => {
    const driver = Driver.instantiateMotionDriver(document.querySelector('#stage'), { version: 2, steps: [{ actions: [{ op: 'clip', targets: ['a'], startMs: 200, durationMs: 1000, ease: 'settle', value: { from: 0, to: 1000 } }], motionWindowMs: 1400, holdMs: 200 }] }, 'scene')
    const state = () => [document.querySelector('#moving').cx.animVal.value, document.querySelector('#waiting').cx.animVal.value]
    driver.draw(700); const middle = state()
    driver.draw(1500); const end = state()
    driver.draw(0); const rewind = state()
    driver.draw(700); const repeat = state()
    return { middle, end, rewind, repeat }
  })
  assert.deepEqual(result.middle, [50, 0], 'The clip clock is linear and independent; its own authored easing is not eased twice')
  assert.deepEqual(result.end, [100, 0])
  assert.deepEqual(result.rewind, [0, 0])
  assert.deepEqual(result.repeat, result.middle)
  console.log('PASS prefixed SVG performance: exact local timing, independent clocks, settled state, backward seek')
  await page.setContent('<svg id="stage" width="400" height="200" viewBox="0 0 400 200"><g id="actor" transform="translate(100 40) scale(2)"><rect id="body" width="20" height="10"/></g></svg>')
  const placed = await page.evaluate(() => {
    const driver = Driver.instantiateMotionDriver(document.querySelector('#stage'), { version: 2, steps: [{ actions: [{ op: 'move', targets: ['actor'], startMs: 0, durationMs: 1000, value: { dx: 80, dy: 0 } }], motionWindowMs: 1000, holdMs: 200 }] })
    const box = () => { const b = document.querySelector('#body').getBoundingClientRect(); return [b.x, b.y, b.width, b.height] }
    driver.draw(0); const before = box()
    driver.draw(1000); const after = box()
    driver.draw(0); return { before, after, rewind: box() }
  })
  assert.equal(placed.after[0] - placed.before[0], 80)
  assert.deepEqual(placed.after.slice(1), placed.before.slice(1), 'Motion preserves the SVG-authored position and scale')
  assert.deepEqual(placed.rewind, placed.before)
  console.log('PASS authored transforms survive stage movement and backward seeking')

  const atoms = await build({ entryPoints: [fileURLToPath(new URL('../src/mcp/atomizer-entry.ts', import.meta.url))], bundle: true, platform: 'browser', format: 'iife', write: false })
  await page.addScriptTag({ content: atoms.outputFiles[0].text })
  const rich = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" data-scene-mode="explainer"><g id="pump" data-role="node" data-kind="box"><g data-appearance-for="pump" data-appearance-key="library-fixture"><svg id="performance" data-part="performance" data-object-clip="1" data-duration-ms="1000" width="400" height="400"><circle cx="200" cy="200" r="160"><animate attributeName="r" values="160;150;160" dur="1s" fill="freeze"/></circle></svg></g></g></svg>'
  const reviewed = await page.evaluate(async svg => StudioAtomize.reviewExplainer(svg, { version: 1, cast: [{ id: 'pump' }], beats: [{ say: 'The pump compresses the chamber.', events: [{ actor: 'pump.performance', action: 'perform', clip: { fromMs: 0, toMs: 1000, durationMs: 1000 } }] }] }), rich)
  assert.deepEqual(reviewed.errors, [], 'An object made entirely of artwork must remain a valid semantic node with addressable motion parts')
  assert.equal(reviewed.plan.steps[0].actions.find(a => a.op === 'clip').targets[0], 'performance')
  console.log('PASS rectangle-free object: atomization, named part resolution, compiler, production review')
  const positioned = rich.replace('</g></svg>', '</g><g id="packet" data-actor="request" transform="translate(600 40) scale(2)"><rect width="20" height="10"/></g></svg>')
  const arrived = await page.evaluate(async svg => {
    const result = await StudioAtomize.reviewExplainer(svg, { version: 1, cast: [{ id: 'packet' }, { id: 'pump' }], beats: [{ say: 'The packet reaches the pump.', events: [{ actor: 'packet', action: 'appear', atMs: 0 }, { actor: 'packet', action: 'travel', to: 'pump', atMs: 200 }] }] })
    StudioAtomize.explainerFrame(result.durationMs - 1)
    const b = document.getElementById('packet').getBoundingClientRect()
    const point = new DOMPoint(b.x + b.width / 2, b.y + b.height / 2).matrixTransform(document.querySelector('svg').getScreenCTM().inverse())
    return { errors: result.errors, packet: [point.x, point.y], move: result.plan.steps[0].actions.find(a => a.op === 'move').value }
  }, positioned)
  assert.deepEqual(arrived.errors, [])
  assert.deepEqual(arrived.move, { dx: -250, dy: 89 }, 'Travel approaches the target boundary from the transformed start')
  assert.deepEqual(arrived.packet, [370, 139], 'Rendered travel arrives at the computed stage position')
  console.log('PASS transformed actor: scene measurement and rendered travel agree on the destination')
  const quantitySvg = rich.replace('</g></svg>', '<text id="count" data-part="count" x="500" y="200" font-size="30">2</text><g id="tokens" data-part="tokens"><circle id="t1" data-part="tokens-1" cx="500" cy="250" r="20"/><circle id="t2" data-part="tokens-2" cx="550" cy="250" r="20"/></g></g></svg>')
  const counted = await page.evaluate(async svg => {
    const result = await StudioAtomize.reviewExplainer(svg, { version: 1, cast: [{ id: 'pump', quantity: { of: 'tokens', value: 2, max: 2, shownOn: 'pump.count', counted: 'pump.tokens' } }], beats: [{ say: 'One token is consumed.', events: [{ actor: 'pump', action: 'appear', atMs: 0 }, { actor: 'pump', action: 'spend', amount: 1, atMs: 1000 }] }, { say: 'It refills.', events: [{ actor: 'pump', action: 'refill', amount: 1 }] }] })
    StudioAtomize.explainerFrame(result.plan.steps[0].motionWindowMs + result.plan.steps[0].holdMs - 1)
    return { program: result.program, plan: result.plan, errors: result.errors, count: document.querySelector('#count').textContent, remaining: ['t1', 't2'].map(id => document.getElementById(id).style.opacity) }
  }, quantitySvg)
  assert.deepEqual(counted.errors, [])
  if (counted.count !== '1') console.log(JSON.stringify(counted))
  assert.equal(counted.count, '1', 'Numeric scene parts outside imported artwork must update as counts, not scaled text')
  assert.deepEqual(counted.remaining.map(value => value || '1'), ['1', '0'], 'The rendered quantity agrees with the event ledger')
  console.log('PASS scene-owned quantities: numeric label and visible objects stay consistent after a node reveal')

  const wearBundle = await build({ stdin: { contents: 'export {wearAppearance} from "./apps/studio-v2/src/slide-atoms.ts"', resolveDir: fileURLToPath(new URL('../../..', import.meta.url)) }, bundle: true, platform: 'browser', format: 'iife', globalName: 'Artwork', write: false })
  await page.addScriptTag({ content: wearBundle.outputFiles[0].text })
  const reuse = await page.evaluate(() => {
    const base = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><g id="one" data-role="node"><rect x="40" y="100" width="440" height="440"/></g><g id="two" data-role="node"><rect x="700" y="100" width="440" height="440"/></g></svg>'
    const art = { key: 'reused', viewBox: { width: 400, height: 400 }, parts: [{ id: 'shell', element: 'g', as: 'shell' }], svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><defs><linearGradient id="ink"/></defs><g id="shell" fill="url(#ink)"><circle cx="200" cy="200" r="150"><animate attributeName="r" values="150;140;150" dur="1s" fill="freeze"/></circle></g></svg>' }
    const once = Artwork.wearAppearance(base, 'one', art)
    const twice = Artwork.wearAppearance(once, 'two', art)
    const replaced = Artwork.wearAppearance(twice, 'one', art)
    const dom = new DOMParser().parseFromString(replaced, 'image/svg+xml')
    const ids = [...dom.querySelectorAll('[id]')].map(n => n.id)
    return { ids, clocks: [...dom.querySelectorAll('svg[data-object-clip]')].map(n => n.id), references: [...dom.querySelectorAll('[fill]')].map(n => n.getAttribute('fill')).filter(f => f.startsWith('url')) }
  })
  assert.equal(new Set(reuse.ids).size, reuse.ids.length, 'Reusable copies and replacements must not leave duplicate SVG ids')
  assert.deepEqual(reuse.clocks.sort(), ['one-performance', 'two-performance'])
  assert.deepEqual(reuse.references.sort(), ['url(#one-art-ink)', 'url(#two-art-ink)'])
  console.log('PASS library placement: two independent animated copies, local paints, clean replacement')
  const composition = await build({ stdin: { contents: 'export {compileProject, defaultBrand} from "./packages/markdown-composition/src/index.ts"', resolveDir: fileURLToPath(new URL('../../..', import.meta.url)) }, bundle: true, platform: 'browser', format: 'iife', globalName: 'Composition', write: false })
  await page.addScriptTag({ content: composition.outputFiles[0].text })
  const html = await page.evaluate(svg => Composition.compileProject({ version: 1, id: 'full-frame', title: 'Explainer', width: 1920, height: 1080, fps: 30, brand: Composition.defaultBrand, blocks: {}, presenterTracks: {}, notebook: { type: 'doc', content: [{ type: 'scene', attrs: { id: 'mechanism', svg } }] } }).html, rich)
  await page.setViewport({ width: 1920, height: 1080 })
  await page.setJavaScriptEnabled(false)
  await page.setContent(html, { waitUntil: 'domcontentloaded' })
  const frame = await page.evaluate(() => { const b = document.querySelector('.scene > .content').getBoundingClientRect(); return [b.x, b.y, b.width, b.height] })
  assert.deepEqual(frame, [0, 0, 1920, 1080], 'A voice-only explainer fills the output frame, including staged layout CSS')
  console.log('PASS composed explainer: no inherited presentation inset or border')
} finally { await browser.close() }
