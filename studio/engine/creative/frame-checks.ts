// The settled-frame check: the orchestrator's contract, held at the build.
// Each moment's last frame is played in a real browser on the pinned
// runtime and measured. Words on an object, two labels on each other,
// anything visible cut by the frame's edge, and a box with nothing in it are
// refused before a build is accepted, each with what to move.
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { RUNTIME_PATHS } from '../../render/runtime'
import type { SketchFiles } from '../../render/types'

export type FrameBox = {
  left: number
  top: number
  right: number
  bottom: number
}
export type FrameText = {
  text: string
  box: FrameBox
  layer: string | null
  /** Part of a defect the scene shows on purpose (data-intentional). */
  intentional?: boolean
}
export type FrameShape = {
  tag: string
  box: FrameBox
  layer: string | null
  intentional?: boolean
}
export type FrameMeasure = {
  frame: FrameBox
  texts: FrameText[]
  shapes: FrameShape[]
}

// Played in the page: every visible piece of text and every painted shape,
// in frame pixels, with the layer that draws it.
const MEASURE = `(() => {
  const root = document.querySelector('[data-composition-id]')
  if (!root) return null
  const box = (r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom })
  const shown = (element) => {
    let opacity = 1
    for (let e = element; e && e.nodeType === 1; e = e.parentNode) {
      const style = getComputedStyle(e)
      if (style.display === 'none' || style.visibility === 'hidden') return 0
      opacity *= Number(style.opacity)
      if (e === root) break
    }
    return opacity
  }
  const hidden = (element) =>
    element.closest('defs, clipPath, mask, marker, pattern, symbol, script, style, title, audio')
  // data-intentional marks a defect the scene shows on purpose (a caption
  // cut off, a label on a shape): measured, and excused only among itself.
  const intentional = (element) => Boolean(element.closest('[data-intentional]'))
  const layerOf = (element) =>
    element.closest('[data-sketch-layer]')?.getAttribute('data-sketch-layer') ?? null
  const texts = []
  const seen = new Set()
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const words = node.textContent.replace(/\\s+/g, ' ').trim()
    const parent = node.parentElement
    if (!words || !parent || hidden(parent)) continue
    const owner = parent.closest('text') || parent
    if (seen.has(owner) || shown(owner) < 0.1) continue
    seen.add(owner)
    let r
    if (owner instanceof SVGElement) r = owner.getBoundingClientRect()
    else {
      const range = document.createRange()
      range.selectNodeContents(node)
      r = range.getBoundingClientRect()
    }
    if (r.width < 1 || r.height < 1) continue
    const text = (owner.textContent || words).replace(/\\s+/g, ' ').trim()
    texts.push({ text: text.slice(0, 60), box: box(r), layer: layerOf(owner), intentional: intentional(owner) })
  }
  const shapes = []
  const painted = 'path, rect, circle, ellipse, polygon, polyline, line, image, use, img'
  for (const element of root.querySelectorAll(painted)) {
    if (hidden(element) || shown(element) < 0.1) continue
    const tag = element.tagName.toLowerCase()
    if (element instanceof SVGGeometryElement) {
      const style = getComputedStyle(element)
      const fill = style.fill !== 'none' && Number(style.fillOpacity) > 0.05
      const stroke =
        style.stroke !== 'none' &&
        Number(style.strokeOpacity) > 0.05 &&
        parseFloat(style.strokeWidth) > 0
      if (!fill && !stroke) continue
    }
    const r = element.getBoundingClientRect()
    if (r.width < 1 && r.height < 1) continue
    shapes.push({ tag, box: box(r), layer: layerOf(element), intentional: intentional(element) })
  }
  return { frame: box(root.getBoundingClientRect()), texts, shapes }
})()`

const width = (b: FrameBox) => b.right - b.left
const height = (b: FrameBox) => b.bottom - b.top
const area = (b: FrameBox) => Math.max(0, width(b)) * Math.max(0, height(b))
const meet = (a: FrameBox, b: FrameBox) =>
  area({
    left: Math.max(a.left, b.left),
    top: Math.max(a.top, b.top),
    right: Math.min(a.right, b.right),
    bottom: Math.min(a.bottom, b.bottom)
  })
const holds = (outer: FrameBox, inner: FrameBox, slack = 2) =>
  inner.left >= outer.left - slack &&
  inner.top >= outer.top - slack &&
  inner.right <= outer.right + slack &&
  inner.bottom <= outer.bottom + slack
const centre = (b: FrameBox) => ({
  x: (b.left + b.right) / 2,
  y: (b.top + b.bottom) / 2
})
/** A line or a hairline stroke: never read as an object to keep clear. */
const thin = (b: FrameBox) => Math.min(width(b), height(b)) < 6

/** Which edges a box crosses while part of it is still in the frame. */
const edgesCut = (b: FrameBox, frame: FrameBox, slack = 4) => {
  if (
    b.right <= frame.left + slack ||
    b.left >= frame.right - slack ||
    b.bottom <= frame.top + slack ||
    b.top >= frame.bottom - slack
  )
    return []
  return [
    b.left < frame.left - slack ? 'left' : '',
    b.top < frame.top - slack ? 'top' : '',
    b.right > frame.right + slack ? 'right' : '',
    b.bottom > frame.bottom + slack ? 'bottom' : ''
  ].filter(Boolean)
}

export type FrameDefect = {
  kind: 'cut' | 'covered' | 'overlap' | 'empty'
  message: string
}

/**
 * What is wrong with one measured frame. Words on a shape they do not belong
 * to (inside a card is fine), labels on each other, anything visible cut by
 * the frame's edge (lines excepted), and a box with nothing in it.
 */
export const frameDefects = (measure: FrameMeasure): FrameDefect[] => {
  const { frame, texts } = measure
  const shapes = measure.shapes.filter((shape) => !thin(shape.box))
  const defects: FrameDefect[] = []
  const said = (text: string) => `“${text}”`
  const layers = new Map<string, string[]>()
  // A defect shown on purpose is excused on its own and among itself; it
  // still collides with everything else in the frame.
  for (const shape of shapes) {
    if (shape.intentional) continue
    const edges = edgesCut(shape.box, frame)
    if (edges.length) layers.set(shape.layer || 'artwork', edges)
  }
  for (const [layer, edges] of layers)
    defects.push({
      kind: 'cut',
      message: `${layer} is cut by the ${edges.join(' and ')} edge`
    })
  for (const text of texts) {
    const edges = text.intentional ? [] : edgesCut(text.box, frame)
    if (edges.length)
      defects.push({
        kind: 'cut',
        message: `${said(text.text)} is cut by the ${edges.join(' and ')} edge`
      })
    // Words hide a shape when they cover a fair share of it, or a fair
    // share of the words sits on it; words inside a card are the card's.
    const covered = shapes.find((shape) => {
      if (shape.layer === text.layer) return false
      if (shape.intentional && text.intentional) return false
      if (holds(shape.box, text.box) && area(shape.box) >= 3 * area(text.box))
        return false
      const shared = meet(shape.box, text.box)
      return shared > 0.12 * area(text.box) || shared > 0.3 * area(shape.box)
    })
    if (covered)
      defects.push({
        kind: 'covered',
        message: `${said(text.text)} sits on ${covered.layer || 'artwork'}`
      })
  }
  texts.forEach((a, index) => {
    for (const b of texts.slice(index + 1))
      if (
        !(a.intentional && b.intentional) &&
        meet(a.box, b.box) > 0.15 * Math.min(area(a.box), area(b.box))
      )
        defects.push({
          kind: 'overlap',
          message: `${said(a.text)} overlaps ${said(b.text)}`
        })
  })
  const frameArea = area(frame)
  for (const card of shapes) {
    if (
      card.intentional ||
      card.tag !== 'rect' ||
      width(card.box) < 100 ||
      height(card.box) < 50 ||
      area(card.box) > 0.5 * frameArea
    )
      continue
    const inside = (b: FrameBox) => {
      const { x, y } = centre(b)
      return (
        x > card.box.left &&
        x < card.box.right &&
        y > card.box.top &&
        y < card.box.bottom
      )
    }
    const holdsSomething =
      texts.some((text) => inside(text.box)) ||
      shapes.some(
        (shape) =>
          shape !== card && !holds(shape.box, card.box) && inside(shape.box)
      )
    if (!holdsSomething)
      defects.push({
        kind: 'empty',
        message: `an empty box in ${card.layer || 'the artwork'}`
      })
  }
  return defects
}

const HOW: Record<FrameDefect['kind'], string> = {
  cut: 'keep it, and the camera’s framing, at least 48 px inside the frame (if the scene shows a cut caption on purpose, wrap that depiction in data-intentional="why")',
  covered:
    'move the words into clear space beside it (or, when the scene shows that defect on purpose, wrap it in data-intentional="why")',
  overlap: 'move one of them',
  empty:
    'give the box its words (VISUAL_CAST.json meaning.label) and its artwork, or leave it out'
}

/** The defects across moments, each said once with where it happens. */
export const settledProblems = (
  frames: Array<{ moment: string; defects: FrameDefect[] }>
) => {
  const found = new Map<
    string,
    { kind: FrameDefect['kind']; moments: string[] }
  >()
  for (const { moment, defects } of frames)
    for (const defect of defects) {
      const entry = found.get(defect.message) || {
        kind: defect.kind,
        moments: []
      }
      if (!entry.moments.includes(moment)) entry.moments.push(moment)
      found.set(defect.message, entry)
    }
  return [...found]
    .slice(0, 8)
    .map(
      ([message, { kind, moments }]) =>
        `At the end of ${moments.join(', ')}, ${message}: ${HOW[kind]}`
    )
}

/**
 * Plays the composition to each moment's settled frame (a moment's last
 * fifth of a second, after its motion lands) and measures it.
 */
export const measureSettledFrames = async (
  files: SketchFiles,
  moments: Array<{ id: string; start: number; end: number }>,
  size = { width: 1920, height: 1080 }
) => {
  const dir = await mkdtemp(join(tmpdir(), 'studio-settled-frames-'))
  const { default: puppeteer } = await import('puppeteer')
  // The host app owns SIGTERM/SIGINT, as for the cast extraction.
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false
  })
  try {
    for (const [name, file] of Object.entries(files)) {
      const path = join(dir, name)
      await mkdir(dirname(path), { recursive: true })
      await writeFile(
        path,
        typeof file === 'string'
          ? name === 'index.html'
            ? file.replace(/(["'])\/runtime\//g, '$1./runtime/')
            : file
          : Buffer.from(file.base64, 'base64')
      )
    }
    await mkdir(join(dir, 'runtime'), { recursive: true })
    for (const [url, source] of Object.entries(RUNTIME_PATHS))
      await copyFile(source, join(dir, url.replace(/^\//, '')))
    const page = await browser.newPage()
    await page.setViewport({ ...size, deviceScaleFactor: 1 })
    await page.goto(pathToFileURL(join(dir, 'index.html')).href, {
      waitUntil: 'load',
      timeout: 30_000
    })
    await page.waitForFunction(
      'window.__playerReady === true && typeof window.__player?.renderSeek === "function"',
      { timeout: 30_000 }
    )
    const frames: Array<{ moment: string; measure: FrameMeasure }> = []
    for (const moment of moments) {
      const at = Math.max(moment.start, moment.end - 0.2)
      await page.evaluate(
        `(async () => {
          await window.__player.renderSeek(${at})
          if (window.__hfWaitForSeekCompletion) await window.__hfWaitForSeekCompletion()
          await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
        })()`
      )
      const measure = (await page.evaluate(MEASURE)) as FrameMeasure | null
      if (measure) frames.push({ moment: moment.id, measure })
    }
    return frames
  } finally {
    await browser.close()
    await rm(dir, { recursive: true, force: true })
  }
}

/** The settled-frame check of one build: its problems, said once each. */
export const settledFrameProblems = async (
  files: SketchFiles,
  moments: Array<{ id: string; start: number; end: number }>
) =>
  settledProblems(
    (await measureSettledFrames(files, moments)).map(({ moment, measure }) => ({
      moment,
      defects: frameDefects(measure)
    }))
  )
