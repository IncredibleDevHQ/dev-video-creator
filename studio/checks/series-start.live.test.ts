import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, expect, it } from 'vitest'
import type { Browser } from 'puppeteer'
import type { NotebookSummary } from '../shared/api'
import { newSeriesDialog, seriesSection } from '../app/series-view'

// Start a series in a real browser, with the studio's own stylesheet (review
// 8, F03): in the review's 1206×954 window the whole start is in sight, its
// Start button too, whatever is chosen — the notebook just made while it is
// drawn, a drawn one, or nothing yet with the code repository open — and on
// a phone its two choices stack, with nothing wider than the screen.
const style = fileURLToPath(new URL('../app/style.css', import.meta.url))
const notebook = (
  id: string,
  title: string,
  status: NotebookSummary['status'] = 'ready'
): NotebookSummary => ({
  id,
  title,
  status,
  hasVideo: false,
  updatedAt: null,
  site: null,
  preview: status === 'ready' ? '<svg/>' : null,
  slides: 4
})
const drawing = notebook(
  'n1',
  'Learning log: APIs that survive retries',
  'building'
)
const draft = notebook('n2', 'Learning log: queues', 'draft')
const drawn = [
  notebook('n3', 'Rate limits: a starter'),
  notebook('n4', 'Caching, a first look')
]
const many = Array.from({ length: 9 }, (_, i) =>
  notebook(`m${i}`, `Learning log, week ${i + 1}`)
)
const STATES: Record<string, { html: string; open?: boolean }> = {
  'the notebook just made, still drawn': {
    html: newSeriesDialog([drawing, draft, ...drawn])
  },
  'a drawn notebook': { html: newSeriesDialog(drawn) },
  'nothing yet, the code repository open': {
    html: newSeriesDialog([draft, ...drawn]),
    open: true
  },
  'many notebooks, nothing yet, the repository open': {
    html: newSeriesDialog([draft, ...many]),
    open: true
  },
  'no notebooks, the repository open': { html: newSeriesDialog(), open: true }
}

let browser: Browser
let dir: string
beforeAll(async () => {
  const { default: puppeteer } = await import('puppeteer')
  browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  dir = await mkdtemp(join(tmpdir(), 'series-start-'))
})
afterAll(async () => {
  await browser?.close()
  if (dir) await rm(dir, { recursive: true, force: true })
})

const measure = async (
  html: string,
  open: boolean,
  width: number,
  height: number
) => {
  const file = join(dir, 'start.html')
  await writeFile(
    file,
    `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="file://${style}"></head><body><dialog><div class="dialog-body">${html}</div></dialog></body></html>`
  )
  const tab = await browser.newPage()
  await tab.setViewport({ width, height })
  await tab.goto(`file://${file}`, { waitUntil: 'load' })
  const at = await tab.evaluate((open) => {
    const dialog = document.querySelector('dialog')!
    dialog.showModal()
    if (open) dialog.querySelector('details')?.setAttribute('open', '')
    const box = dialog.getBoundingClientRect()
    const start = dialog
      .querySelector('#series-form button.primary')!
      .getBoundingClientRect()
    const growth = dialog
      .querySelector('.series-growth')!
      .getBoundingClientRect()
    const led = dialog.querySelector('.series-led')!.getBoundingClientRect()
    const list = dialog.querySelector('.series-from > div')
    return {
      overflow: dialog.scrollHeight - dialog.clientHeight,
      rows: list?.children.length ?? 0,
      listScrolls: list ? list.scrollHeight > list.clientHeight : false,
      startInSight: start.bottom <= box.bottom && start.top >= box.top,
      wider: Math.max(
        dialog.scrollWidth - dialog.clientWidth,
        document.documentElement.scrollWidth - innerWidth
      ),
      beside: Math.abs(led.top - growth.top) < 2 && led.left > growth.right,
      stacked: led.top >= growth.bottom - 1
    }
  }, open)
  await tab.close()
  return at
}

it('shows the whole start in a laptop window, whatever is chosen', async () => {
  const problems: string[] = []
  for (const [name, state] of Object.entries(STATES)) {
    const at = await measure(state.html, Boolean(state.open), 1206, 954)
    if (at.overflow > 0) problems.push(`${name}: scrolls ${at.overflow}px`)
    if (!at.startInSight) problems.push(`${name}: Start is out of sight`)
    if (!at.beside)
      problems.push(`${name}: the two choices are not side by side`)
    // Five rows of notes in sight; more scroll inside the list.
    if (at.listScrolls !== at.rows > 5)
      problems.push(
        `${name}: ${at.rows} rows, the list scrolls: ${at.listScrolls}`
      )
  }
  expect(problems).toEqual([])
})

// Round 2's audit: a series waiting on a drawing that stopped says so on
// home, with Try again and Cancel, in one row that fits a phone too.
it('fits a series waiting on a stopped drawing in one row, its answers in sight', async () => {
  const stopped: NotebookSummary = {
    ...notebook('n5', 'Learning log: queues', 'failed'),
    waitingSeries: 'Queues, from my learning log, week by week',
    waitingStopped:
      'Stopped. Saved work is kept; Try again continues where it stopped.'
  }
  const file = join(dir, 'home.html')
  await writeFile(
    file,
    `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="file://${style}"></head><body><main class="start">${seriesSection([], [stopped])}</main></body></html>`
  )
  for (const [width, height] of [
    [1206, 954],
    [390, 844]
  ]) {
    const tab = await browser.newPage()
    await tab.setViewport({ width, height })
    await tab.goto(`file://${file}`, { waitUntil: 'load' })
    const at = await tab.evaluate(() => {
      const row = document.querySelector('.series-row.is-stopped')!
      const box = row.getBoundingClientRect()
      const buttons = [...row.querySelectorAll('button[data-action]')].map(
        (button) => button.getBoundingClientRect()
      )
      return {
        wider: document.documentElement.scrollWidth - innerWidth,
        inside: buttons.every(
          (b) => b.left >= box.left && b.right <= box.right && b.width > 0
        ),
        count: buttons.length
      }
    })
    await tab.close()
    expect(at, `${width}px`).toEqual({ wider: 0, inside: true, count: 2 })
  }
})

it('stacks the two choices on a phone, nothing wider than the screen', async () => {
  for (const state of Object.values(STATES)) {
    const at = await measure(state.html, Boolean(state.open), 390, 844)
    expect(at.wider).toBeLessThanOrEqual(0)
    expect(at.stacked).toBe(true)
  }
})
