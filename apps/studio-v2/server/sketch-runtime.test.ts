import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { SceneTreatmentV1 } from '../src/planning/scene-treatment'
import type { SketchManifest } from '../src/planning/sketch-bundle'
import { sketchBundleHash, verifySketchRuntime } from './sketch-runtime'

// R3 of the scene-review review: a sketch reads ready only once it has run.
// The token-bucket sketch is exactly what Claude Code wrote in the live
// P0–P3 run (docs/reviews/2026-09-25-p0-p3-review-loop-evidence); the
// defective variants are the review's negative probes
// (docs/reviews/2026-09-25-scene-review-ux-evidence/probes), each of which
// passed the static contract and the pinned lint.
const FIXTURE = fileURLToPath(new URL('./fixtures/sketch-runtime/token-bucket/', import.meta.url))
const readTree = (root: string, prefix = ''): Record<string, string> =>
  Object.assign({}, ...readdirSync(join(root, prefix), { withFileTypes: true }).map(entry => {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name
    return entry.isDirectory() ? readTree(root, name) : { [name]: readFileSync(join(root, name), 'utf8') }
  }))
const { 'plan.json': planJson, ...harness } = readTree(FIXTURE)
const plan = JSON.parse(planJson).content as SceneTreatmentV1
const manifest = JSON.parse(harness['manifest.json']) as SketchManifest
// The harness wrote it before layers were marked: mark what draws each
// layer, by element id, and change nothing else.
const MARKS: Record<string, string> = {
  root: 'background', limiter: 'request-rate-limiter', bucket: 'token-bucket', t1: 'token-bucket', t2: 'token-bucket', t3: 'token-bucket', r1: 'token-bucket', r2: 'token-bucket', r3: 'token-bucket',
  drop: 'drip', user: 'user', qA: 'request', qB: 'request', qC: 'request', qD: 'request', qE: 'request', route: 'route-guide', api: 'api',
  b429: 'http-429 http-429-label', count: 'token-count', term: 'term', refill: 'refill-label', panel: 'redis', redisIcon: 'redis', redisLabel: 'redis-label',
  ob1: 'other-buckets', ob2: 'other-buckets', ob3: 'other-buckets', ob4: 'other-buckets', presenter: 'presenter',
}
const marked = (html: string) =>
  Object.entries(MARKS)
    .reduce((out, [id, layer]) => out.replace(`id="${id}"`, `id="${id}" data-sketch-layer="${layer}"`), html)
    .replaceAll('<div class="tag">', '<div class="tag" data-sketch-layer="sketch-annotations">')
    .replaceAll('<div class="narr">', '<div class="narr" data-sketch-layer="sketch-annotations">')
const sketch = { ...harness, 'index.html': marked(harness['index.html']) }
const REGISTRY = 'window.__timelines = window.__timelines || {}'

// A small scene of three moments: the box appears, holds, then slides.
const COMPOSITION = 'sketch-runtime-test'
const small = (script: string, extra = ''): Record<string, string> => ({
  'index.html': `<!doctype html><html><head><meta charset="utf-8"><script src="/runtime/gsap.min.js"></script><script src="/runtime/hyperframes.iife.js"></script>
<style>html,body{margin:0;background:#101018}#root{position:relative;width:100%;height:100%;overflow:hidden;background:#101018}.clip{position:absolute;inset:0}#box{position:absolute;left:200px;top:400px;width:240px;height:240px;background:#635bff}#title{position:absolute;left:120px;top:90px;color:#fff;font:600 64px system-ui}</style></head><body>
<div id="root" data-composition-id="${COMPOSITION}" data-start="0" data-width="1920" data-height="1080" data-duration="6">
<div id="stage" class="clip" data-start="0" data-duration="6" data-track-index="0"><div id="title" data-sketch-layer="title">Tokens</div><div id="box" data-sketch-layer="box"></div>${extra}</div>
</div><script>${REGISTRY}
const tl = gsap.timeline({ paused: true })
${script}
window.__timelines["${COMPOSITION}"] = tl</script></body></html>`,
  'manifest.json': JSON.stringify(smallManifest),
})
const smallManifest: SketchManifest = {
  version: 1, scene: 's1', plan: { record: 'plan-1', revision: 1 },
  composition: { id: COMPOSITION, width: 1920, height: 1080, fps: 30, duration: 6 }, runtime: { hyperframes: '0.7.106' },
  moments: [{ id: 'm1', title: 'Enter', start: 0, end: 2, estimated: true }, { id: 'm2', title: 'Hold', start: 2, end: 4, estimated: true }, { id: 'm3', title: 'Slide', start: 4, end: 6, estimated: true }],
  layers: [{ id: 'title', kind: 'text', label: 'Tokens', moments: ['m1', 'm2', 'm3'] }, { id: 'box', kind: 'object', label: 'The box', moments: ['m1', 'm2', 'm3'] }],
  provisional: ['Timing is estimated'],
}
// m2 changes nothing: a still beat the product must allow.
const smallPlan = { moments: [{ id: 'm1', objects: { change: 'the box appears', actors: ['box'] } }, { id: 'm2', objects: null }, { id: 'm3', objects: { change: 'the box slides right', actors: ['box'] } }] } as unknown as SceneTreatmentV1
const ENTER = "tl.fromTo('#box', { opacity: 0 }, { opacity: 1, duration: 1 }, 0.2)"
const SLIDE = "tl.to('#box', { x: 700, duration: 1 }, 4.3)"

describe('playing a sketch before it reads ready', () => {
  it('plays the harness\'s token-bucket sketch and keeps the proof against its bundle', async () => {
    const report = await verifySketchRuntime(sketch, manifest, plan)
    expect(report.problems).toEqual([])
    const proof = report.proof!
    expect(proof).toMatchObject({ version: 1, bundle: sketchBundleHash(sketch), runtime: '0.7.106', duration: 24 })
    expect(proof.timeline.tweens).toBeGreaterThan(50)
    expect(proof.loaded).toEqual(expect.arrayContaining(['index.html', 'assets/user.svg', '/runtime/gsap.min.js', '/runtime/hyperframes.iife.js']))
    // Four frames of every moment, and the same frames when sought again.
    expect(proof.frames).toHaveLength(manifest.moments.length * 4)
    expect(new Set(proof.frames.map(frame => frame.frame)).size).toBeGreaterThan(20)
    expect(proof.reseeks.length).toBeGreaterThanOrEqual(3)
    expect(proof.reseeks.every(item => item.same)).toBe(true)
    // Every layer showed in the moments it declares; the 429 only in m4.
    for (const layer of manifest.layers.filter(item => item.kind !== 'camera')) {
      expect(proof.layers.find(item => item.id === layer.id)?.moments, layer.id).toEqual(expect.arrayContaining(layer.moments))
    }
    expect(proof.layers.find(item => item.id === 'http-429')?.moments).toEqual(['m4'])
    // Each moment the plan changes showed that change in its actors.
    expect(proof.changes.map(change => change.moment)).toEqual(['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'])
    expect(proof.changes.every(change => change.within === 'actors' && change.pixels > 24)).toBe(true)
  }, 60_000)

  it('refuses the review\'s three defective variants, each for its own reason', async () => {
    const bodies = [...sketch['index.html'].matchAll(/<script>\s*([\s\S]*?)<\/script>/g)]
    expect(bodies).toHaveLength(1)
    const throwing = await verifySketchRuntime({ ...sketch, 'index.html': sketch['index.html'].replace(REGISTRY, `${REGISTRY}\n  throw new Error('negative gate probe: timeline cannot initialize');`) }, manifest, plan)
    expect(throwing.proof).toBeNull()
    expect(throwing.problems).toEqual(expect.arrayContaining([
      expect.stringMatching(/throws in the pinned player: "Error: negative gate probe: timeline cannot initialize"/),
      expect.stringMatching(/window\.__timelines\["sketch-.+"\] is never registered/),
    ]))
    const missing = await verifySketchRuntime({ ...sketch, 'index.html': sketch['index.html'].replace('src="assets/user.svg"', 'src="assets/negative-probe-missing-user.svg"') }, manifest, plan)
    expect(missing.problems).toEqual([expect.stringMatching(/asks for "assets\/negative-probe-missing-user\.svg", which is not in the sketch/)])
    const empty = await verifySketchRuntime({ ...sketch, 'index.html': sketch['index.html'].replace(bodies[0][0], `<script>\n  ${REGISTRY}\n  const tl = gsap.timeline({ paused: true })\n  window.__timelines["${manifest.composition.id}"] = tl\n</script>`) }, manifest, plan)
    expect(empty.problems).toEqual([expect.stringMatching(/The registered timeline animates nothing \(0 tweens\)/)])
  }, 60_000)

  it('asks for what draws each layer to be marked, and checks each shows in its moments', async () => {
    const unmarked = await verifySketchRuntime(harness, manifest, plan)
    expect(unmarked.problems).toEqual([expect.stringMatching(/^Layers "background", "request-rate-limiter", .* have no element marked data-sketch-layer/)])
    // The 429 badge never shows: its layers are missing from m4.
    const hidden = await verifySketchRuntime({ ...sketch, 'index.html': sketch['index.html'].replace('</style>', '#b429 { display: none !important; }</style>') }, manifest, plan)
    expect(hidden.problems).toEqual([
      expect.stringMatching(/^Layer "http-429" takes part in m4 \(10\.5s–13\.5s\), but nothing marked data-sketch-layer="http-429" shows then/),
      expect.stringMatching(/^Layer "http-429-label" takes part in m4/),
    ])
  }, 60_000)

  it('allows a still beat, and refuses a planned change that never shows', async () => {
    const good = await verifySketchRuntime(small(`${ENTER}\n${SLIDE}`), smallManifest, smallPlan)
    expect(good.problems).toEqual([])
    // Nothing moves in m2, and nothing is asked of it.
    expect(good.proof!.changes.map(change => change.moment)).toEqual(['m1', 'm3'])
    const stuck = await verifySketchRuntime(small(ENTER), smallManifest, smallPlan)
    expect(stuck.problems).toEqual([expect.stringMatching(/^m3 "Slide": the plan changes box \("the box slides right"\), but none of them changes on screen from 3\.84s to 5\.84s/)])
  }, 60_000)

  it('refuses frames that depend on when they were drawn, and anything from outside', async () => {
    // Animated by a timer, not the timeline: each seek finds it elsewhere.
    const drifting = await verifySketchRuntime(small(`${ENTER}\n${SLIDE}\nlet n = 0\nsetInterval(() => { n += 1; document.getElementById('title').style.transform = 'translateX(' + n * 3 + 'px)' }, 16)`), smallManifest, smallPlan)
    expect(drifting.problems).toEqual(expect.arrayContaining([expect.stringMatching(/^Seeking to [\d.]+s twice shows two different frames/)]))
    const outside = await verifySketchRuntime(small(`${ENTER}\n${SLIDE}`, '<img src="//example.com/logo.png" alt="">'), smallManifest, smallPlan)
    expect(outside.problems).toEqual([expect.stringMatching(/reaches outside the sketch for http:\/\/example\.com\/logo\.png/)])
  }, 60_000)

  it('gives up on a script that never returns, instead of waiting on it', async () => {
    const started = Date.now()
    const hung = await verifySketchRuntime(small('while (true) {}'), smallManifest, smallPlan, { wait: 3_000 })
    expect(hung.problems).toEqual([expect.stringMatching(/did not answer in the pinned player/)])
    expect(Date.now() - started).toBeLessThan(20_000)
  }, 30_000)
})
