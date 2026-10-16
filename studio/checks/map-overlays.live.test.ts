import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, expect, it } from 'vitest'
import type { Browser } from 'puppeteer'
import { mapPage } from '../app/map-view'

// The map's overlays in a real browser, with the studio's own stylesheet:
// the toast (Undo after a page is removed, Review 6 MAP-1; "Organise again")
// stays clear of the selection bar at every width, with its button on top,
// and neither runs under the zoom pill or the Queue. A narrow window raised
// the bar over the toast once, and a note's form always covered it.
const style = fileURLToPath(new URL('../app/style.css', import.meta.url))
const button = (label: string, kind = 'quiet') =>
  `<button type="button" class="${kind}">${label}</button>`
const BARS: Record<string, string | null> = {
  none: null,
  episode: `<div class="map-info"><b>Ep 3</b> · Can you trust ninety percent?<small>6 pages</small></div>${button('Rename')}${button('⋯', 'quiet map-more')}`,
  page: `<div class="map-info"><b>Ep 3</b> · 2 of 6 · An independent calibration audit<small>from page 9 · also in Ep 2</small></div>${button('Change')}${button('Remove')}${button('⋯', 'quiet map-more')}`,
  gap: `<div class="map-info"><b>Missing</b> · Checking calibration<small>How do you check that a model’s confidence is honest?</small></div>${button('Add a note', 'primary')}${button('Explain here')}${button('Ignore')}`,
  note: `<form class="map-ask"><label>Fill the gap · How do you check that a model’s confidence is honest?<textarea name="note" rows="2"></textarea></label><button type="submit" class="primary">Add</button>${button('Cancel')}</form>`
}
const TOAST = `<span>Removed from the episode. The map keeps the page.</span>${button('Undo')}`
const QUEUE =
  '<button type="button" class="map-queue-pill"><i></i>Queue<span>idle</span></button>'

let browser: Browser
let dir: string
beforeAll(async () => {
  const { default: puppeteer } = await import('puppeteer')
  browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  dir = await mkdtemp(join(tmpdir(), 'map-overlays-'))
})
afterAll(async () => {
  await browser?.close()
  if (dir) await rm(dir, { recursive: true, force: true })
})

type Box = { left: number; top: number; right: number; bottom: number }
const meets = (one: Box, other: Box) =>
  Math.min(one.right, other.right) > Math.max(one.left, other.left) &&
  Math.min(one.bottom, other.bottom) > Math.max(one.top, other.top)

it('keeps the toast, the selection bar, the zoom pill, the Queue and the notes apart at every width', async () => {
  const file = join(dir, 'map.html')
  await writeFile(
    file,
    `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="file://${style}"></head><body>${mapPage('The Model That Doesn’t Talk')}</body></html>`
  )
  const tab = await browser.newPage()
  // The settled layout: the panel and the dock move without their slide.
  await tab.emulateMediaFeatures([
    { name: 'prefers-reduced-motion', value: 'reduce' }
  ])
  for (const notes of [false, true])
    for (const [kind, bar] of Object.entries(BARS))
      for (const width of [1440, 1237, 1100, 981, 980, 900, 768]) {
        await tab.setViewport({ width, height: 800 })
        await tab.goto(`file://${file}`, { waitUntil: 'load' })
        const at = await tab.evaluate(
          (parts) => {
            const slot = (name: string) =>
              document.querySelector<HTMLElement>(`[data-map-slot="${name}"]`)!
            const box = (node: Element) => {
              const r = node.getBoundingClientRect()
              return {
                left: r.left,
                top: r.top,
                right: r.right,
                bottom: r.bottom
              }
            }
            const hit = (x: number, y: number) =>
              document.elementFromPoint(x, y)
            if (parts.notes)
              document
                .querySelector('.map-page')!
                .classList.add('is-notes-open')
            slot('toast').innerHTML = parts.toast
            slot('toast').hidden = false
            slot('queue').innerHTML = parts.queue
            if (parts.bar) {
              slot('bar').innerHTML = parts.bar
              slot('bar').hidden = false
            }
            const toast = box(slot('toast'))
            const bar = box(slot('bar'))
            const action = box(slot('toast').querySelector('button')!)
            const between = hit(
              (toast.left + toast.right) / 2,
              (toast.bottom + bar.top) / 2
            )
            return {
              toast,
              bar,
              stage: box(document.querySelector('.map-stage')!),
              zoom: box(document.querySelector('.map-zoom')!),
              queue: box(slot('queue').firstElementChild!),
              notes: box(document.querySelector('.map-rail')!),
              onTop: slot('toast').contains(
                hit(
                  (action.left + action.right) / 2,
                  (action.top + action.bottom) / 2
                )
              ),
              through: ![
                slot('toast'),
                slot('bar'),
                document.querySelector('.map-dock')
              ].some((node) => node?.contains(between))
            }
          },
          { toast: TOAST, bar, queue: QUEUE, notes }
        )
        const where = `${kind} bar at ${width} px${notes ? ', notes open' : ''}`
        if (notes)
          expect
            .soft(meets(at.toast, at.notes), `${where}: toast, notes`)
            .toBe(false)
        expect
          .soft(at.onTop, `${where}: the toast’s button is on top`)
          .toBe(true)
        expect
          .soft(meets(at.toast, at.zoom), `${where}: toast, zoom`)
          .toBe(false)
        expect
          .soft(meets(at.toast, at.queue), `${where}: toast, Queue`)
          .toBe(false)
        if (!bar) {
          expect
            .soft(
              Math.round(at.stage.bottom - at.toast.bottom),
              `${where}: place`
            )
            .toBe(74)
          continue
        }
        expect.soft(meets(at.toast, at.bar), `${where}: toast, bar`).toBe(false)
        expect.soft(meets(at.bar, at.zoom), `${where}: bar, zoom`).toBe(false)
        expect.soft(meets(at.bar, at.queue), `${where}: bar, Queue`).toBe(false)
        if (notes)
          expect
            .soft(meets(at.bar, at.notes), `${where}: bar, notes`)
            .toBe(false)
        // Between the two, a click still reaches the canvas.
        expect.soft(at.through, `${where}: between them`).toBe(true)
      }
}, 120_000)
