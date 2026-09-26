// A sketch reads "ready" only once it has run (R3). The static checks prove
// the bundle is well formed; this plays the exact bundle through the pinned
// Hyperframes player, as the Studio's stage does, in a headless Chrome that
// can reach nothing but the bundle and the pinned runtime. It proves:
// - nothing throws, and every file the composition asks for is in the bundle;
// - the player becomes ready at the manifest's length, and the composition's
//   own timeline registers and animates;
// - a moment sampled again, in another order, shows the same frame;
// - every layer (its elements marked data-sketch-layer) shows during the
//   moments the manifest gives it;
// - a moment whose plan changes objects shows a change in those objects
//   (or, if they are not marked, anywhere on screen). A still beat stays
//   legal: nothing is asked of a moment the plan does not change.
// The proof is kept with the preview, against the bundle's hash. A moment
// that shows two different frames keeps both, where they differ and the
// marked layers drawn at another place (R09 of the project-flow rereview):
// the run's next attempt and the creator look at the same evidence.
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import type { SceneTreatmentV1 } from '../src/planning/scene-treatment'
import { SKETCH_RUNTIME, type SketchFile, type SketchFiles, type SketchManifest, type SketchProof } from '../src/planning/sketch-bundle'

const require = createRequire(import.meta.url)

// The pinned runtime, as the Studio serves it at /runtime/*.
export const RUNTIME_PATHS: Record<string, string> = {
  '/runtime/gsap.min.js': join(dirname(require.resolve('gsap')), 'gsap.min.js'),
  '/runtime/hyperframes.iife.js': join(dirname(require.resolve('@hyperframes/core/package.json')), 'dist', 'hyperframe.runtime.iife.js'),
}
// The pinned player the stage plays sketches in.
const PLAYER_PATH = join(dirname(require.resolve('@hyperframes/player')), 'hyperframes-player.global.js')

// A bundle file as the Studio serves it.
const PREVIEW_TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8' }
export const previewFileBody = (path: string, file: SketchFile) => {
  const extension = path.slice(path.lastIndexOf('.')).toLowerCase()
  return typeof file === 'string'
    ? { body: Buffer.from(file, 'utf8'), contentType: PREVIEW_TYPES[extension] || 'text/plain; charset=utf-8' }
    : { body: Buffer.from(file.base64, 'base64'), contentType: file.contentType }
}

// The bundle's identity: every file, by name, as it is stored.
export const sketchBundleHash = (files: SketchFiles) =>
  createHash('sha256')
    .update(JSON.stringify(Object.keys(files).sort().map(name => [name, files[name]])))
    .digest('hex')

type Region = { left: number; top: number; right: number; bottom: number }
// A moment seeked twice that showed two different frames: both frames, as
// PNG (base64), where they differ and the marked layers drawn at another
// place, in composition pixels.
export type RuntimeEvidence = {
  kind: 'reseek'
  at: number
  pixels: number
  region: Region | null
  layers: Array<{ id: string; first: Region | null; again: Region | null }>
  // The composition's size, the frame the regions are in.
  size: { width: number; height: number }
  frames: { first: string; again: string }
}
export type SketchRuntimeReport = { problems: string[]; warnings: string[]; proof: SketchProof | null; evidence?: RuntimeEvidence[] }

const ORIGIN = 'http://sketch.check'
const HOST_PATH = '/__host.html'
const PLAYER_URL = '/__player.js'
const BUNDLE = '/bundle/'
const READY_WAIT = 15_000
const STEP_WAIT = 10_000
// A frame counts as changed past this many pixels (of a 960-wide frame);
// seeking the same moment twice must stay within it.
const NOISE = 24
const SCAN_STEP = 0.1

// The page side, kept as plain JavaScript: code handed to the page must not
// depend on the bundler's helpers.
const CHECK_SCRIPT = String.raw`
(function () {
  var MARK = 'data-sketch-layer'
  var player = document.getElementById('player')
  var frames = {}
  function doc() { try { return player.iframe && player.iframe.contentDocument } catch (error) { return null } }
  function win() { try { return player.iframe && player.iframe.contentWindow } catch (error) { return null } }
  function painted() { return new Promise(function (resolve) { requestAnimationFrame(function () { requestAnimationFrame(resolve) }) }) }
  // A composition's pictures (a creator's take) finish seeking before the
  // frame is read: the frame at a time is the one the take shows there.
  function settled() {
    var composition = doc()
    var videos = composition ? Array.prototype.slice.call(composition.querySelectorAll('video')) : []
    return Promise.all(videos.map(function (video) {
      if (!video.seeking && video.readyState >= 2) return true
      return new Promise(function (resolve) {
        var done = function () { video.removeEventListener('seeked', done); video.removeEventListener('loadeddata', done); resolve(true) }
        video.addEventListener('seeked', done)
        video.addEventListener('loadeddata', done)
        setTimeout(done, 2000)
      })
    }))
  }
  // Shown: laid out, not hidden by it or an ancestor, not transparent, and
  // at least partly inside the composition's frame.
  function shows(element, frame) {
    var opacity = 1
    for (var node = element; node && node.nodeType === 1; node = node.parentElement) {
      var style = node.ownerDocument.defaultView.getComputedStyle(node)
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return null
      opacity *= Number(style.opacity)
      if (opacity < 0.02) return null
    }
    var box = element.getBoundingClientRect()
    if (box.width < 1 && box.height < 1) {
      var inner = element.querySelectorAll('*')
      for (var index = 0; index < inner.length && index < 64; index += 1) {
        var child = inner[index].getBoundingClientRect()
        if (child.width >= 1 || child.height >= 1) { box = child; break }
      }
    }
    var left = Math.max(box.left, frame.left), top = Math.max(box.top, frame.top)
    var right = Math.min(box.right, frame.right), bottom = Math.min(box.bottom, frame.bottom)
    if (right - left < 1 || bottom - top < 1) return null
    return { left: left, top: top, right: right, bottom: bottom }
  }
  // Where each marked layer shows now, in composition pixels.
  function layersNow(ids) {
    var composition = doc()
    var out = {}
    if (!composition) return out
    var root = composition.querySelector('[data-composition-id]')
    var frame = root ? root.getBoundingClientRect() : { left: 0, top: 0, right: 1e9, bottom: 1e9 }
    ids.forEach(function (id) {
      var box = null
      composition.querySelectorAll('[' + MARK + ']').forEach(function (element) {
        if (element.getAttribute(MARK).split(/\s+/).indexOf(id) < 0) return
        var shown = shows(element, frame)
        if (!shown) return
        box = box ? { left: Math.min(box.left, shown.left), top: Math.min(box.top, shown.top), right: Math.max(box.right, shown.right), bottom: Math.max(box.bottom, shown.bottom) } : shown
      })
      out[id] = box
    })
    return out
  }
  function decode(base64) {
    var bytes = Uint8Array.from(atob(base64), function (c) { return c.charCodeAt(0) })
    return createImageBitmap(new Blob([bytes], { type: 'image/png' })).then(function (bitmap) {
      var canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
      var context = canvas.getContext('2d', { willReadFrequently: true })
      context.drawImage(bitmap, 0, 0)
      return context.getImageData(0, 0, bitmap.width, bitmap.height)
    })
  }
  window.__sketch = {
    ready: false,
    state: function (id) {
      var w = win()
      var timelines = (w && w.__timelines) || {}
      var timeline = timelines[id]
      var usable = timeline && typeof timeline.getChildren === 'function' && typeof timeline.duration === 'function'
      return {
        ready: player.ready === true,
        duration: Number(player.duration) || 0,
        runtime: Boolean(w && (w.__player || w.__hf)),
        registered: Boolean(timeline),
        registeredIds: Object.keys(timelines),
        timeline: usable ? { duration: timeline.duration(), tweens: timeline.getChildren(true, true, false).length } : null,
        marked: (function () {
          var composition = doc()
          var ids = []
          if (composition) composition.querySelectorAll('[' + MARK + ']').forEach(function (element) {
            element.getAttribute(MARK).split(/\s+/).forEach(function (id) { if (id && ids.indexOf(id) < 0) ids.push(id) })
          })
          return ids
        })(),
      }
    },
    // Seek as the stage does, wait for the frame to be painted, and say
    // where the marked layers are.
    seek: function (time, ids) {
      player.seek(time)
      return painted().then(settled).then(painted).then(function () { return layersNow(ids) })
    },
    // Where each marked layer shows, at many times, without painting.
    scan: function (times, ids) {
      return times.map(function (time) {
        player.seek(time)
        var now = layersNow(ids)
        var shown = []
        ids.forEach(function (id) { if (now[id]) shown.push(id) })
        return shown
      })
    },
    keep: function (key, base64) { return decode(base64).then(function (image) { frames[key] = image; return true }) },
    // Pixels that differ between two kept frames, inside the given boxes
    // (composition pixels) or over the whole frame.
    diff: function (a, b, boxes, width) {
      var one = frames[a], two = frames[b]
      if (!one || !two || one.width !== two.width || one.height !== two.height) return -1
      var scale = one.width / width
      var areas = boxes && boxes.length ? boxes.map(function (box) {
        return { left: Math.max(0, Math.floor(box.left * scale)), top: Math.max(0, Math.floor(box.top * scale)), right: Math.min(one.width, Math.ceil(box.right * scale)), bottom: Math.min(one.height, Math.ceil(box.bottom * scale)) }
      }) : [{ left: 0, top: 0, right: one.width, bottom: one.height }]
      var seen = new Uint8Array(one.width * one.height)
      var count = 0
      areas.forEach(function (area) {
        for (var y = area.top; y < area.bottom; y += 1) {
          for (var x = area.left; x < area.right; x += 1) {
            var at = y * one.width + x
            if (seen[at]) continue
            seen[at] = 1
            var i = at * 4
            var delta = Math.max(Math.abs(one.data[i] - two.data[i]), Math.abs(one.data[i + 1] - two.data[i + 1]), Math.abs(one.data[i + 2] - two.data[i + 2]))
            if (delta > 24) count += 1
          }
        }
      })
      return count
    },
    // Where two kept frames differ, in composition pixels, and by how many
    // pixels: the evidence of a frame that changed between two seeks.
    where: function (a, b, width) {
      var one = frames[a], two = frames[b]
      if (!one || !two || one.width !== two.width || one.height !== two.height) return null
      var scale = one.width / width
      var count = 0, left = one.width, top = one.height, right = -1, bottom = -1
      for (var y = 0; y < one.height; y += 1) {
        for (var x = 0; x < one.width; x += 1) {
          var i = (y * one.width + x) * 4
          var delta = Math.max(Math.abs(one.data[i] - two.data[i]), Math.abs(one.data[i + 1] - two.data[i + 1]), Math.abs(one.data[i + 2] - two.data[i + 2]))
          if (delta <= 24) continue
          count += 1
          if (x < left) left = x
          if (y < top) top = y
          if (x > right) right = x
          if (y > bottom) bottom = y
        }
      }
      return { pixels: count, region: count ? { left: Math.floor(left / scale), top: Math.floor(top / scale), right: Math.ceil((right + 1) / scale), bottom: Math.ceil((bottom + 1) / scale) } : null }
    },
  }
  player.addEventListener('ready', function () { window.__sketch.ready = true })
})()
`

const hostPage = (width: number, height: number, viewport: { width: number; height: number }) => `<!doctype html>
<html><head><meta charset="utf-8">
<style>html,body{margin:0;padding:0;background:#000;overflow:hidden}hyperframes-player{display:block;width:${viewport.width}px;height:${viewport.height}px}</style>
<script src="${PLAYER_URL}"></script>
</head><body>
<hyperframes-player id="player" width="${width}" height="${height}" src="${BUNDLE}index.html"></hyperframes-player>
<script>${CHECK_SCRIPT}</script>
</body></html>`

class SketchTimeout extends Error {}
const within = async <T>(promise: Promise<T>, ms: number, what: string): Promise<T> => {
  let timer: NodeJS.Timeout | undefined
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new SketchTimeout(what)), ms) })])
  } finally {
    clearTimeout(timer)
  }
}

const seconds = (value: number) => `${Number(value.toFixed(2))}s`
const quoted = (text: string, limit = 160) => {
  const clean = text.replace(/\s+/g, ' ').trim()
  return `"${clean.length > limit ? `${clean.slice(0, limit - 1)}…` : clean}"`
}

// When to look at each moment: just after it starts, a third and two
// thirds in, and near its end — never at the composition's exact end.
const samplesOf = (moment: SketchManifest['moments'][number], last: number) => {
  const span = moment.end - moment.start
  return [Math.min(0.1, span * 0.05), span / 3, (span * 2) / 3, span * 0.92].map(offset => Math.min(last, Number((moment.start + offset).toFixed(3))))
}

type Box = { left: number; top: number; right: number; bottom: number }
// A layer drawn at the same place, give or take a pixel.
const sameBox = (a: Box | null, b: Box | null) =>
  a === b || Boolean(a && b && Math.abs(a.left - b.left) <= 1 && Math.abs(a.top - b.top) <= 1 && Math.abs(a.right - b.right) <= 1 && Math.abs(a.bottom - b.bottom) <= 1)
const boxText = (box: Box) => `x ${Math.round(box.left)}–${Math.round(box.right)}, y ${Math.round(box.top)}–${Math.round(box.bottom)}`

// Plays the bundle and reports what it does. Throws only when the check
// itself cannot run (no browser); a sketch that misbehaves gets problems.
export const verifySketchRuntime = async (files: SketchFiles, manifest: SketchManifest, plan: SceneTreatmentV1 | null, options: { wait?: number } = {}): Promise<SketchRuntimeReport> => {
  const wait = options.wait ?? READY_WAIT
  const problems: string[] = []
  const warnings: string[] = []
  const composition = manifest.composition
  const scale = Math.min(1, 960 / composition.width)
  const viewport = { width: Math.round(composition.width * scale), height: Math.round(composition.height * scale) }
  const player = await readFile(PLAYER_PATH, 'utf8')
  const runtime = Object.fromEntries(await Promise.all(Object.entries(RUNTIME_PATHS).map(async ([path, file]) => [path, await readFile(file)] as const)))
  const host = hostPage(composition.width, composition.height, viewport)

  const errors: string[] = []
  const missing = new Set<string>()
  const outside = new Set<string>()
  const loaded = new Set<string>()
  const { default: puppeteer } = await import('puppeteer')
  // The host app owns SIGTERM/SIGINT: puppeteer's own handlers would
  // swallow the app's quit while a browser is open.
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--hide-scrollbars', '--force-color-profile=srgb', '--mute-audio'], handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false })
  try {
    const page = await browser.newPage()
    await page.setViewport({ ...viewport, deviceScaleFactor: 1 })
    await page.setRequestInterception(true)
    page.on('request', request => {
      const address = request.url()
      if (address.startsWith('data:') || address.startsWith('blob:') || address === 'about:blank') return void request.continue()
      const url = new URL(address)
      if (url.origin !== ORIGIN) {
        outside.add(address)
        return void request.abort('blockedbyclient')
      }
      const path = decodeURIComponent(url.pathname)
      if (path === HOST_PATH) return void request.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: host })
      if (path === PLAYER_URL) return void request.respond({ status: 200, contentType: 'text/javascript; charset=utf-8', body: player })
      // The browser's own ask for the host page's icon, not the sketch's.
      if (path === '/favicon.ico') return void request.respond({ status: 204, body: '' })
      if (runtime[path]) {
        loaded.add(path)
        return void request.respond({ status: 200, contentType: 'text/javascript; charset=utf-8', body: runtime[path] })
      }
      const name = path.startsWith(BUNDLE) ? path.slice(BUNDLE.length) : ''
      const file = name ? files[name] : undefined
      if (file === undefined) {
        missing.add(name || path)
        return void request.respond({ status: 404, contentType: 'text/plain; charset=utf-8', body: 'not in the sketch' })
      }
      loaded.add(name)
      const { body, contentType } = previewFileBody(name, file)
      return void request.respond({ status: 200, contentType, body })
    })
    page.on('pageerror', error => errors.push(error instanceof Error ? `${error.name}: ${error.message}` : String(error)))
    page.on('console', message => {
      if (message.type() !== 'error') return
      const text = message.text()
      // A missing file is reported by name, not by the browser's line.
      if (/^Failed to load resource/i.test(text)) return
      errors.push(text)
    })

    await within(page.goto(`${ORIGIN}${HOST_PATH}`, { waitUntil: 'load', timeout: 0 }), wait, 'the page to load')
    const ready = await within(page.waitForFunction('window.__sketch && window.__sketch.ready === true', { timeout: wait, polling: 100 }).then(() => true, () => false), wait + 2_000, 'the player to be ready')
    const state = await within(page.evaluate(`window.__sketch.state(${JSON.stringify(composition.id)})`), STEP_WAIT, 'the player state') as {
      ready: boolean; duration: number; runtime: boolean; registered: boolean; registeredIds: string[]; timeline: { duration: number; tweens: number } | null; marked: string[]
    }

    // What went wrong while it loaded, by name.
    for (const error of [...new Set(errors)]) problems.push(`The sketch throws in the pinned player: ${quoted(error)}. Nothing after the throw runs; fix the script so it runs to the end.`)
    for (const name of missing) problems.push(`The composition asks for "${name}", which is not in the sketch. Add the file under sketch/ or point at one that is (relative to index.html).`)
    for (const address of outside) {
      problems.push(/hyperframe\.runtime/.test(address)
        ? 'The player had to fetch the Hyperframes runtime from the internet: index.html must load /runtime/hyperframes.iife.js itself, before the timeline registers.'
        : `The composition reaches outside the sketch for ${address}. A preview uses nothing outside itself.`)
    }
    if (!state.registered) {
      problems.push(`window.__timelines["${composition.id}"] is never registered when index.html runs${state.registeredIds.length ? ` (registered: ${state.registeredIds.join(', ')})` : ''} — the script stops before the registration or registers another id.`)
    } else if (!state.timeline) {
      problems.push(`window.__timelines["${composition.id}"] is not a GSAP timeline.`)
    } else if (state.timeline.tweens === 0) {
      problems.push('The registered timeline animates nothing (0 tweens). A sketch shows the plan\'s progression in motion: tween what each moment changes.')
    }
    if (!ready) {
      problems.push(`The sketch never became ready in the pinned player (waited ${wait / 1000}s)${state.runtime ? '' : ': the Hyperframes runtime never started'}.`)
      return { problems: [...new Set(problems)], warnings, proof: null }
    }

    // Every layer but the camera is marked on what draws it, so the product
    // can tell whether it shows in its moments.
    const layerIds = manifest.layers.filter(layer => layer.kind !== 'camera').map(layer => layer.id)
    const marked = layerIds.filter(id => state.marked.includes(id))
    const unmarked = layerIds.filter(id => !marked.includes(id))
    if (unmarked.length) problems.push(`${unmarked.length === 1 ? 'Layer' : 'Layers'} ${unmarked.map(id => `"${id}"`).join(', ')} ${unmarked.length === 1 ? 'has' : 'have'} no element marked data-sketch-layer="<layer id>" in the composition. Mark what draws each layer (several elements may share a mark), so the product can check it shows in its moments.`)
    const strays = state.marked.filter(id => !manifest.layers.some(layer => layer.id === id))
    if (strays.length) warnings.push(`data-sketch-layer names ${strays.map(id => `"${id}"`).join(', ')}, which manifest.layers does not declare.`)
    if (Math.abs(state.duration - composition.duration) > 0.1) problems.push(`The player reads the sketch as ${seconds(state.duration)} long, but manifest.composition.duration is ${seconds(composition.duration)}. Make the root's data-duration, the timeline and the manifest agree.`)
    if (state.timeline && state.timeline.duration > composition.duration + 0.1) warnings.push(`The timeline runs to ${seconds(state.timeline.duration)}, past the composition's ${seconds(composition.duration)}: what happens after the end never shows.`)
    if (problems.length) return { problems: [...new Set(problems)], warnings, proof: null }
    const last = Math.max(0, Math.min(state.duration, composition.duration) - 1 / Math.max(1, composition.fps))

    // Frames, taken latest first so every seek goes backwards.
    const samples = manifest.moments.flatMap(moment => samplesOf(moment, last).map(at => ({ at, moment: moment.id })))
    const frames: SketchProof['frames'] = []
    const boxesAt = new Map<number, Record<string, Box | null>>()
    const keyOf = (at: number) => `t${at}`
    const capture = async (at: number, key: string) => {
      const boxes = (await within(page.evaluate(`window.__sketch.seek(${at}, ${JSON.stringify(marked)})`), STEP_WAIT, `the frame at ${seconds(at)}`)) as Record<string, Box | null>
      const shot = (await within(page.screenshot({ type: 'png', encoding: 'base64', optimizeForSpeed: true }), STEP_WAIT, `the frame at ${seconds(at)}`)) as string
      await within(page.evaluate(`window.__sketch.keep(${JSON.stringify(key)}, ${JSON.stringify(shot)})`), STEP_WAIT, 'the frame to decode')
      return { boxes, shot, hash: createHash('sha256').update(shot).digest('hex').slice(0, 16) }
    }
    // The moments seeked again, forwards, once every frame is taken; their
    // first frames are kept, as evidence should the second differ.
    const again = [...new Set([samples[1], samples[Math.floor(samples.length / 2)], samples[samples.length - 2]].filter(Boolean).map(sample => sample.at))].sort((a, b) => a - b)
    const shotsAt = new Map<number, string>()
    const hashes = new Map<number, string>()
    for (const sample of [...samples].sort((a, b) => b.at - a.at)) {
      if (hashes.has(sample.at)) continue
      const { boxes, hash, shot } = await capture(sample.at, keyOf(sample.at))
      boxesAt.set(sample.at, boxes)
      hashes.set(sample.at, hash)
      if (again.includes(sample.at)) shotsAt.set(sample.at, shot)
    }
    for (const sample of samples) frames.push({ at: sample.at, moment: sample.moment, frame: hashes.get(sample.at) || '' })
    const diff = async (a: string, b: string, boxes: Box[] = []) =>
      Number(await within(page.evaluate(`window.__sketch.diff(${JSON.stringify(a)}, ${JSON.stringify(b)}, ${JSON.stringify(boxes)}, ${composition.width})`), STEP_WAIT, 'two frames to compare'))

    // The same moment again, reached from elsewhere, forwards this time. Two
    // different frames are kept with where they differ and the marked
    // layers drawn at another place.
    const reseeks: SketchProof['reseeks'] = []
    const evidence: RuntimeEvidence[] = []
    for (const at of again) {
      const second = await capture(at, `again-${at}`)
      const pixels = second.hash === hashes.get(at) ? 0 : await diff(keyOf(at), `again-${at}`)
      const same = pixels >= 0 && pixels <= NOISE
      reseeks.push({ at, same })
      if (same) continue
      const found = (await within(page.evaluate(`window.__sketch.where(${JSON.stringify(keyOf(at))}, ${JSON.stringify(`again-${at}`)}, ${composition.width})`), STEP_WAIT, 'where two frames differ')) as { pixels: number; region: Region | null } | null
      const firstBoxes = boxesAt.get(at) || {}
      const moved = marked
        .map(id => ({ id, first: firstBoxes[id] || null, again: second.boxes[id] || null }))
        .filter(layer => !sameBox(layer.first, layer.again))
      const region = found?.region || null
      evidence.push({ kind: 'reseek', at, pixels, region, layers: moved, size: { width: composition.width, height: composition.height }, frames: { first: shotsAt.get(at) || '', again: second.shot } })
      const where = region ? `, within ${boxText(region)}` : ''
      const layers = moved.length ? ` ${moved.slice(0, 3).map(layer => `Layer "${layer.id}" is ${layer.first ? `at ${boxText(layer.first)}` : 'not shown'} the first time and ${layer.again ? `at ${boxText(layer.again)}` : 'not shown'} the second.`).join(' ')}` : ''
      problems.push(`Seeking to ${seconds(at)} twice shows two different frames (${pixels} pixels differ${where}).${layers} Something depends on the order of seeks or on playback — every seek must show the same frame. Both frames are kept with this check.`)
    }

    // Every layer shows during the moments it takes part in.
    const layers: SketchProof['layers'] = []
    const times: number[] = []
    let shown: string[][] = []
    if (marked.length) {
      for (let at = 0; at <= last + 1e-9; at += SCAN_STEP) times.push(Number(at.toFixed(3)))
      shown = (await within(page.evaluate(`window.__sketch.scan(${JSON.stringify(times)}, ${JSON.stringify(marked)})`), STEP_WAIT * 3, 'the layers to be scanned')) as string[][]
      for (const layer of manifest.layers.filter(item => marked.includes(item.id))) {
        const showsIn: string[] = []
        for (const moment of manifest.moments) {
          const inside = times.map((at, index) => ({ at, index })).filter(({ at }) => at >= moment.start && at < moment.end)
          const seen = inside.some(({ index }) => shown[index]?.includes(layer.id)) || samplesOf(moment, last).some(at => boxesAt.get(at)?.[layer.id])
          if (seen) showsIn.push(moment.id)
          else if (layer.moments.includes(moment.id)) problems.push(`Layer "${layer.id}" takes part in ${moment.id} (${seconds(moment.start)}–${seconds(moment.end)}), but nothing marked data-sketch-layer="${layer.id}" shows then. Show it in its moments, or correct manifest.layers.`)
        }
        layers.push({ id: layer.id, moments: showsIn })
      }
    }

    // A moment the plan changes shows the change: in its actors where they
    // are marked, otherwise somewhere in the frame.
    const changes: SketchProof['changes'] = []
    const planMoments = new Map((plan?.moments || []).map(moment => [moment.id, moment]))
    for (const [index, moment] of manifest.moments.entries()) {
      const planned = planMoments.get(moment.id)
      if (!planned?.objects?.change) continue
      const times = [...(index > 0 ? [samplesOf(manifest.moments[index - 1], last).at(-1)!] : []), ...samplesOf(moment, last)]
      const actors = (planned.objects.actors || []).filter(id => marked.includes(id))
      const boxes = actors.flatMap(id => times.map(at => boxesAt.get(at)?.[id]).filter((box): box is Box => Boolean(box)))
      let pixels = 0
      for (const at of times.slice(1)) {
        if (hashes.get(at) !== hashes.get(times[0])) pixels = Math.max(pixels, await diff(keyOf(times[0]), keyOf(at), boxes))
      }
      const where: 'actors' | 'frame' = boxes.length ? 'actors' : 'frame'
      changes.push({ moment: moment.id, within: where, pixels })
      if (pixels <= NOISE) {
        problems.push(where === 'actors'
          ? `${moment.id} "${moment.title}": the plan changes ${actors.join(', ')} (${quoted(planned.objects.change, 120)}), but none of them changes on screen from ${seconds(times[0])} to ${seconds(times.at(-1)!)}. Show the change as it happens.`
          : `${moment.id} "${moment.title}": the plan changes objects here (${quoted(planned.objects.change, 120)}), but the frame stays the same from ${seconds(times[0])} to ${seconds(times.at(-1)!)}. Show the change as it happens.`)
      }
    }

    // The mechanism's clock (R11): each counted change shows in its layers
    // when the schedule says it happens, and each pause is shown while it
    // holds the clock.
    const schedule = manifest.schedule
    const scheduled: NonNullable<SketchProof['schedule']> = { events: [], pauses: [] }
    if (schedule) {
      for (const [index, event] of (schedule.events || []).entries()) {
        const before = Math.max(0, Math.min(last, event.at - 0.3))
        const after = Math.max(0, Math.min(last, event.at + 0.3))
        const one = await capture(before, `event-${index}-before`)
        const two = await capture(after, `event-${index}-after`)
        const boxes = (event.layers || []).filter(id => marked.includes(id)).flatMap(id => [one.boxes[id], two.boxes[id]]).filter((box): box is Box => Boolean(box))
        const pixels = one.hash === two.hash ? 0 : await diff(`event-${index}-before`, `event-${index}-after`, boxes)
        scheduled.events.push({ at: event.at, pixels })
        if (pixels <= NOISE) problems.push(`The schedule's ${event.change} at ${seconds(event.at)} (${event.moment}) shows no change in ${(event.layers || []).join(', ') || 'the frame'} from ${seconds(before)} to ${seconds(after)}. Show each counted change on screen when the schedule says it happens.`)
      }
      for (const pause of schedule.pauses || []) {
        const inside = times.map((at, index) => ({ at, index })).filter(({ at }) => at >= pause.start && at < pause.end)
        const unseen = inside.filter(({ index }) => !shown[index]?.includes(pause.shown)).map(({ at }) => at)
        if (!marked.includes(pause.shown) || unseen.length) {
          problems.push(`The pause from ${seconds(pause.start)} to ${seconds(pause.end)} holds the clock, but layer "${pause.shown}" does not show throughout it${unseen.length ? ` (not at ${unseen.slice(0, 3).map(seconds).join(', ')}${unseen.length > 3 ? '…' : ''})` : ''}. Tell the viewer the clock is held for as long as it is.`)
        } else scheduled.pauses.push({ start: pause.start, end: pause.end, shown: pause.shown })
      }
    }

    const proof: SketchProof = {
      version: 1,
      bundle: sketchBundleHash(files),
      runtime: SKETCH_RUNTIME.hyperframes,
      checkedAt: new Date().toISOString(),
      duration: state.duration,
      timeline: state.timeline!,
      loaded: [...loaded].sort(),
      frames,
      reseeks,
      layers,
      changes,
      ...(schedule ? { schedule: scheduled } : {}),
    }
    return { problems: [...new Set(problems)], warnings, proof: problems.length ? null : proof, ...(evidence.length ? { evidence } : {}) }
  } catch (error) {
    if (error instanceof SketchTimeout) return { problems: [...new Set([...problems, `The sketch did not answer in the pinned player while waiting for ${error.message}: a script may never finish. Keep the composition's scripts short and free of loops that wait.`])], warnings, proof: null }
    throw error
  } finally {
    await browser.close().catch(() => browser.process()?.kill('SIGKILL'))
  }
}
