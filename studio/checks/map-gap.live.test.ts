import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, expect, it } from 'vitest'
import type { Browser } from 'puppeteer'
import { gapCard } from '../app/map-nodes'

// A covered gap's card in a real browser, with the studio's own stylesheet
// (review 8, F09, round 1): at rest it keeps its label, what is missing and
// its four choices inside its dashed border; selected, it opens to its whole
// text, so the planner's reason, the card's words and the card's title all
// show, at the map's zoom out and in. The audit found the quote 0 px tall.
const style = fileURLToPath(new URL('../app/style.css', import.meta.url))
const gap = {
  id: 'same-key',
  missing:
    'What the server does when the same key arrives with a different order',
  episode: 'e2',
  why: 'The card idea does not show the server rejecting a reused key',
  ask: 'What should the server do with a reused key?',
  state: 'open' as const,
  covered: {
    page: 'b',
    says: 'the same key carrying a different order is rejected'
  }
}

let browser: Browser
let dir: string
beforeAll(async () => {
  const { default: puppeteer } = await import('puppeteer')
  browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  dir = await mkdtemp(join(tmpdir(), 'map-gap-'))
})
afterAll(async () => {
  await browser?.close()
  if (dir) await rm(dir, { recursive: true, force: true })
})

it('keeps a covered gap inside its card at rest, and shows its reason, the card’s words and title once selected, at any zoom', async () => {
  const card = (selected: boolean) =>
    `<div class="map-el map-gap${selected ? ' is-selected' : ''}" style="transform:translate(40px,40px);width:184px;height:176px">${gapCard(gap, 'First tool: an idempotency key')}</div>`
  const tab = await browser.newPage()
  await tab.setViewport({ width: 1200, height: 900 })
  for (const zoom of [0.41, 1, 2])
    for (const selected of [false, true]) {
      const file = join(dir, `gap-${zoom}-${selected}.html`)
      await writeFile(
        file,
        `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="file://${style}"></head><body><div class="map-page"><div class="map-canvas" style="position:relative;width:1200px;height:900px"><div class="map-world" style="transform-origin:0 0;transform:scale(${zoom})">${card(selected)}</div></div></div></body></html>`
      )
      await tab.goto(`file://${file}`, { waitUntil: 'load' })
      const at = await tab.evaluate(() => {
        const node = document.querySelector('.map-gap')!
        const box = (el: Element) => el.getBoundingClientRect()
        const outer = box(node)
        const inside = (el: Element) => {
          const r = box(el)
          return (
            r.left >= outer.left - 1 &&
            r.right <= outer.right + 1 &&
            r.top >= outer.top - 1 &&
            r.bottom <= outer.bottom + 1
          )
        }
        return {
          label: box(node.querySelector('.map-node-label')!).height,
          missing: box(node.querySelector('strong')!).height,
          why: box(node.querySelector('p')!).height,
          says: box(node.querySelector('.map-gap-says')!).height,
          title: box(node.querySelector('.map-gap-says b')!).height,
          buttons: [...node.querySelectorAll('button')].map(
            (button) => box(button).height > 0 && inside(button)
          )
        }
      })
      const where = `${selected ? 'selected' : 'at rest'} at ${zoom * 100}%`
      expect.soft(at.label, `${where}: label`).toBeGreaterThan(0)
      expect.soft(at.missing, `${where}: what is missing`).toBeGreaterThan(0)
      expect
        .soft(at.buttons, `${where}: four choices inside the card`)
        .toEqual([true, true, true, true])
      if (selected) {
        expect.soft(at.why, `${where}: the reason`).toBeGreaterThan(0)
        expect.soft(at.says, `${where}: the card’s words`).toBeGreaterThan(0)
        expect.soft(at.title, `${where}: the card’s title`).toBeGreaterThan(0)
      }
    }
}, 120_000)
