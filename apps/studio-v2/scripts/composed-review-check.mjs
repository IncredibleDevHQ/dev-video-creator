import assert from 'node:assert/strict'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { build } from 'esbuild'
import puppeteer from 'puppeteer'
const require = createRequire(import.meta.url)
const root = new URL('../../../', import.meta.url).pathname
const out = process.env.STUDIO_REPAIR_EVIDENCE || '/tmp/studio-composed-review'
await mkdir(out, { recursive: true })
const bundle = await build({ stdin: { contents: `export * from './apps/studio-v2/src/explainer-review';export * from './apps/studio-v2/src/composed-review';export * from './apps/studio-v2/src/slide-atoms';export * from './apps/studio-v2/src/scene-program';export * from './packages/markdown-composition/src/index';`, resolveDir: root }, bundle: true, platform: 'browser', format: 'iife', globalName: 'Probe', write: false })
const browser = await puppeteer.launch({ headless: true })
try {
  const page = await browser.newPage(); await page.setViewport({ width: 1600, height: 900 })
  await page.setContent('<html><body></body></html>'); await page.addScriptTag({ content: bundle.outputFiles[0].text })
  const svg = await readFile(new URL('./fixtures/python-rig.svg', import.meta.url), 'utf8')
  const program = JSON.parse(await readFile(new URL('./fixtures/python-rig.program.json', import.meta.url), 'utf8'))
  const gsapSource = await readFile(require.resolve('gsap/dist/gsap.min.js'), 'utf8')
  page.on('pageerror', error => console.error('PAGE ERROR', error.message))
  const result = await page.evaluate(async ({svg, program, gsapSource}) => {
    const result = await Probe.reviewExplainer(svg, program, { gsapSource })
    const sample = () => Array.from(document.querySelector('iframe').contentDocument.querySelectorAll('path[transform]')).map(node => { const b = node.getBoundingClientRect();return { id: node.id, x:b.x,y:b.y,width:b.width,height:b.height,box:getComputedStyle(node).transformBox } })
    Probe.explainerFrame(17242); const first = sample()
    Probe.explainerFrame(0); Probe.explainerFrame(17242); const repeated = sample()
    return { errors:result.errors,warnings:result.warnings,first,repeated,manifest: result.renderManifest }
  }, { svg, program, gsapSource })
  assert.deepEqual(result.errors, [], 'real Python candidate has no structural review errors')
  assert.deepEqual(result.first,result.repeated,'backward seek reconstructs identical geometry')
  assert.ok(result.first.length > 0,'real Python transform-bearing fixture exercised')
  assert.ok(result.first.every(node => node.box !== 'fill-box'),'source geometry keeps authored transform reference boxes')
  await page.screenshot({ path: `${out}/python-composed.png` })
  await writeFile(`${out}/python-composition.html`, (await page.evaluate(() => document.querySelector('iframe').contentDocument.documentElement.outerHTML)))
  const occlusion = await page.evaluate(() => {
    const doc = document.querySelector('iframe').contentDocument
    const label = doc.querySelector('.slide-svg text')
    const box = label.getBoundingClientRect()
    const camera = doc.createElement('div');camera.className='camera';camera.style.cssText=`position:fixed!important;opacity:1!important;visibility:visible!important;display:block!important;left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px;transform:none;`
    doc.body.append(camera)
    const result = Probe.seekComposedReview(17242).readability
    const debug = {chain:Array.from((function*(node){for(;node;node=node.parentElement)yield node})(label)).map(node=>({tag:node.tagName,opacity:doc.defaultView.getComputedStyle(node).opacity,display:doc.defaultView.getComputedStyle(node).display,visibility:doc.defaultView.getComputedStyle(node).visibility})),text:label.textContent,box:{x:box.x,y:box.y,width:box.width,height:box.height},camera:camera.getBoundingClientRect().toJSON(),opacity:getComputedStyle(camera).opacity,readability:result};camera.remove();return debug
  })
  assert.ok(occlusion.readability.some(issue=>issue.includes('presenter covers label')),'composed review detects a presenter covering a factual label: '+JSON.stringify(occlusion))
  const port = await page.evaluate(async ({svg,gsapSource}) => {
    const program = {version:1,cast:[{id:'req'},{id:'worker'}],beats:[{say:'A request arrives.',events:[{id:'arrival',actor:'req',action:'travel',to:'worker.inbox'}]}]}
    const result = await Probe.reviewExplainer(svg,program,{gsapSource})
    return { errors:result.errors,moves:result.plan.steps[0].actions.filter(a=>a.op==='move') }
  },{svg,gsapSource})
  assert.equal(port.moves.length,1,'named-part travel produces a real move')
  const paint = await page.evaluate(() => {
    const base='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><g id="one"><rect x="100" y="100" width="360" height="340" fill="transparent"/></g></svg>'
    const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="20 20 360 340" fill="none" style="stroke:#a67df2"><path id="outline" d="M 30 30 H 300 V 280 H 30 Z" stroke-width="10"/></svg>'
    const embedded=Probe.wearAppearance(base,'one',{svg,key:'probe',parts:[{id:'outline',element:'path'}],viewBox:{width:360,height:340}})
    const div=document.createElement('div');div.innerHTML=Probe.prepareSlideSvg(embedded,'repeat');document.body.append(div)
    const node=div.querySelector('path'); const fill=getComputedStyle(node).fill, stroke=getComputedStyle(node).stroke
    div.remove();return {fill,stroke,embedded}
  })
  assert.equal(paint.fill,'none');assert.equal(paint.stroke,'rgb(166, 125, 242)')
  const parentMotion = await page.evaluate(() => {
    const host = document.createElement('div')
    host.innerHTML = '<svg viewBox="0 0 1280 720" width="1280" height="720"><g id="parent" transform="translate(20 30) scale(2)"><circle id="child" cx="100" cy="100" r="10"/></g></svg>'
    document.body.append(host)
    const root = host.querySelector('svg'), child = host.querySelector('#child')
    const plan = { version: 2, steps: [{ motionWindowMs: 400, holdMs: 0, actions: [{ op: 'resize', targets: ['parent'], startMs: 0, durationMs: 100, value: { from: 1, to: 2 } }, { op: 'move', targets: ['child'], startMs: 200, durationMs: 100, value: { dx: 100, dy: 0 } }] }] }
    const driver = Probe.instantiateMotionDriver(root, plan)
    const center = () => { const b=child.getBoundingClientRect(); return {x:b.x+b.width/2,y:b.y+b.height/2} }
    driver.draw(150); const before=center(); driver.draw(350); const after=center()
    driver.draw(0);driver.draw(350);const repeated=center()
    host.remove();return { before, after, repeated }
  })
  assert.ok(Math.abs(parentMotion.after.x-parentMotion.before.x-100)<1,'child travels 100 scene pixels under a resized authored parent: '+JSON.stringify(parentMotion))
  assert.deepEqual(parentMotion.after,parentMotion.repeated,'parent resizing reconstructs on backward seek')
  const envoySvg = await readFile(new URL('./fixtures/envoy.svg', import.meta.url),'utf8')
  const envoyProgram = JSON.parse(await readFile(new URL('./fixtures/envoy.program.json', import.meta.url),'utf8'))
  const envoy = await page.evaluate(({svg,program}) => {
    const atoms = Probe.atomizeSlideSvg(svg)
    program.scheduling=2;program.clock='take';program.beats=[program.beats[1]]
    program.beats[0].events.filter(event=>event.id.startsWith('herd-')).forEach(event=>{event.anchor='arrival';event.durationMs=500})
    const result=Probe.compileSceneProgram(Probe.sanitizeSceneProgram(program,atoms.units),atoms.units,{viewBox:atoms.viewBox})
    return { duration:result.plan.steps[0].motionWindowMs+result.plan.steps[0].holdMs, arrivals:result.schedule.filter(event=>event.id.startsWith('herd-')).map(event=>event.arrival),diagnostics:result.diagnostics }
  },{svg:envoySvg,program:envoyProgram})
  assert.equal(envoy.duration,4380,'real Envoy beat stays on measured speech')
  assert.deepEqual(envoy.arrivals,[600,690,780,870,960,1050,1140,1230],'real burst retains authored 630ms spread')
  assert.deepEqual(envoy.diagnostics,[],'no hidden truncation or dependency padding')
  await writeFile(`${out}/envoy-schedule.json`,JSON.stringify(envoy,null,2))
  await writeFile(`${out}/results.json`,JSON.stringify({python:result,port,paint},null,2))
  console.log('COMPOSED REVIEW CHECK PASS: real Python rig, backward seek, named port travel, inherited paint and viewport')
} finally { await browser.close() }
