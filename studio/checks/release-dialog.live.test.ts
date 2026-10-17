import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, expect, it } from 'vitest'
import type { Browser } from 'puppeteer'
import type { Snapshot } from '../shared/api'
import { planCampaign } from '../shared/campaign'
import { campaignSection } from '../app/campaign-view'

// The release dialog in a real browser, with the studio's own stylesheet
// (review 8), at a desktop's, a tablet's and a phone's width. A synthetic
// notebook: nothing is made.
const style = fileURLToPath(new URL('../app/style.css', import.meta.url))
const frame = (number: number) => ({
  number,
  title: `Frame title number ${number}`,
  type: number === 1 ? 'hook' : 'explain',
  duration: 4,
  voiceover: '',
  still: 'posed'
})
const project = {
  id: 'r8',
  title: 'One click, two lattes',
  source: '',
  slides: [],
  video: {
    settings: { presence: 'off', voice: { kind: 'record' } },
    scenes: [],
    transitions: [],
    inputKey: '',
    produced: { inputKey: 'sb', objectKey: 'v.mp4' },
    storyboard: {
      id: 'sb',
      pages: [],
      stage: 'done',
      status: 'done',
      updatedAt: '',
      plan: {
        message: '',
        audience: '',
        structure: '',
        hook: '',
        scenes: [
          {
            pageId: 'a',
            build: 'faceless',
            buildReason: '',
            frames: [1, 2, 3, 4, 5, 6, 7].map(frame)
          }
        ]
      }
    }
  },
  release: {
    at: new Date(2026, 9, 20, 18, 0).toISOString(),
    teasers: [],
    campaign: []
  }
} as unknown as Snapshot['project']
// Planned in good time, opened on 17 October: its first teasers are overdue.
project.release!.campaign = planCampaign(project, {
  now: new Date(2026, 8, 29)
})
const snapshot: Snapshot = { project, status: 'ready', error: null, events: [] }
const TODAY = new Date(2026, 9, 17, 8, 53)

let browser: Browser
let dir: string
beforeAll(async () => {
  const { default: puppeteer } = await import('puppeteer')
  browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  dir = await mkdtemp(join(tmpdir(), 'release-dialog-'))
})
afterAll(async () => {
  await browser?.close()
  if (dir) await rm(dir, { recursive: true, force: true })
})

type Box = Record<'left' | 'top' | 'right' | 'bottom' | 'width', number>
/** The dialog as the studio opens it, measured at each width. */
const measure = async <T>(
  body: string,
  read: (box: (selector: string) => Box) => T
) => {
  const file = join(dir, `dialog-${Math.random()}.html`)
  await writeFile(
    file,
    `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="file://${style}"></head><body><dialog id="dialog" open><button type="button" data-action="close" aria-label="Close dialog">×</button><div class="dialog-body">${body}</div></dialog></body></html>`
  )
  const tab = await browser.newPage()
  const seen: Array<{ width: number; scrolls: boolean; at: T }> = []
  for (const width of [1440, 768, 375]) {
    await tab.setViewport({ width, height: 900 })
    await tab.goto(`file://${file}`, { waitUntil: 'load' })
    for (const open of ['details.cover-choices', 'details.youtube-publish'])
      await tab
        .$eval(open, (node) => node.setAttribute('open', ''))
        .catch(() => {})
    await tab
      .$eval(
        '.publish-differs',
        (node) => ((node as HTMLElement).hidden = false)
      )
      .catch(() => {})
    const scrolls = await tab.$eval(
      '.dialog-body',
      (node) => node.scrollWidth > node.clientWidth + 1
    )
    const boxes = await tab.evaluate(() =>
      Object.fromEntries(
        [
          '.dialog-body',
          '.campaign-item.is-overdue',
          '.campaign-item.is-overdue [data-action="campaign-move"]',
          '.release-cover img',
          '[name="publishAt"]',
          '.publish-differs',
          '#youtube-publish-form'
        ].map((selector) => {
          const node = document.querySelector(selector)
          const r = node?.getBoundingClientRect()
          return [
            selector,
            r && {
              left: r.left,
              top: r.top,
              right: r.right,
              bottom: r.bottom,
              width: r.width
            }
          ]
        })
      )
    )
    const tiles = await tab.$$eval('.cover-choice', (nodes) =>
      nodes.map((node) => {
        const r = node.getBoundingClientRect()
        return {
          left: r.left,
          top: r.top,
          right: r.right,
          bottom: r.bottom,
          width: r.width
        }
      })
    )
    seen.push({
      width,
      scrolls,
      at: read((selector) =>
        selector === '.cover-choice'
          ? (tiles as never)
          : (boxes[selector] as Box)
      )
    })
  }
  await tab.close()
  return seen
}

it('keeps an overdue step’s Move inside its row, and the dialog no wider than a phone (F18)', async () => {
  const seen = await measure(campaignSection(snapshot, TODAY), (box) => ({
    row: box('.campaign-item.is-overdue'),
    move: box('.campaign-item.is-overdue [data-action="campaign-move"]')
  }))
  for (const { scrolls, at } of seen) {
    expect(scrolls).toBe(false)
    expect(at.move.right).toBeLessThanOrEqual(at.row.right)
    expect(at.move.bottom).toBeLessThanOrEqual(at.row.bottom)
  }
}, 60_000)
