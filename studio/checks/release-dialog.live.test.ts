import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, expect, it } from 'vitest'
import type { Browser } from 'puppeteer'
import type { Snapshot } from '../shared/api'
import { planCampaign } from '../shared/campaign'
import { campaignSection } from '../app/campaign-view'
import { releaseDialog, teasersSection } from '../app/release-view'

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
          '#youtube-publish-form',
          '.teaser-row video',
          '.teaser-small'
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

it('shows the thumbnail at about the size YouTube lists it, its choices and the publisher’s note inside the dialog (F19, F17)', async () => {
  const seen = await measure(
    releaseDialog(snapshot, campaignSection(snapshot, TODAY)),
    (box) => ({
      body: box('.dialog-body'),
      cover: box('.release-cover img'),
      tiles: box('.cover-choice') as unknown as Box[],
      input: box('[name="publishAt"]'),
      note: box('.publish-differs'),
      form: box('#youtube-publish-form')
    })
  )
  for (const { scrolls, at } of seen) {
    expect(scrolls).toBe(false)
    // 240 px wide, or the dialog's width on a phone; 16:9 either way.
    expect(Math.round(at.cover.width)).toBe(
      Math.min(240, Math.round(at.body.width - 48))
    )
    expect((at.cover.bottom - at.cover.top) / at.cover.width).toBeCloseTo(
      9 / 16,
      2
    )
    // Every choice inside the dialog, two or more to a row.
    expect(at.tiles).toHaveLength(7)
    for (const tile of at.tiles) {
      expect(tile.right).toBeLessThanOrEqual(at.body.right)
      expect(tile.width).toBeGreaterThanOrEqual(100)
    }
    expect(at.tiles[1].top).toBe(at.tiles[0].top)
    // The publisher's note on its own line under the time, across the form.
    expect(at.note.top).toBeGreaterThanOrEqual(at.input.bottom)
    expect(at.note.width).toBeGreaterThan(at.form.width * 0.9)
  }
}, 60_000)

it('previews a portrait teaser at about a phone’s width, with where it reads small under it (F16)', async () => {
  const teaser = {
    id: 't',
    channel: 'youtube' as const,
    aspect: '9:16' as const,
    segments: [
      { from: 0, to: 4 },
      { from: 14.5, to: 40.5 }
    ],
    state: 'ready' as const,
    objectKey: 't.mp4',
    small: 26.5,
    at: ''
  }
  const seen = await measure(
    teasersSection({
      ...snapshot,
      project: {
        ...project,
        release: { ...project.release!, teasers: [teaser] }
      }
    }),
    (box) => ({
      body: box('.dialog-body'),
      video: box('.teaser-row video'),
      note: box('.teaser-small')
    })
  )
  for (const { scrolls, at } of seen) {
    expect(scrolls).toBe(false)
    expect(Math.round(at.video.width)).toBe(
      Math.min(270, Math.round(at.body.width - 48))
    )
    expect((at.video.bottom - at.video.top) / at.video.width).toBeCloseTo(
      16 / 9,
      1
    )
    expect(at.note.top).toBeGreaterThanOrEqual(at.video.bottom)
    expect(at.note.right).toBeLessThanOrEqual(at.body.right)
  }
}, 60_000)

/** Each selector's text colour, its contrast on the dialog, in a theme. */
const contrasts = async (
  body: string,
  theme: 'light' | 'dark',
  selectors: string[]
) => {
  const file = join(dir, `colours-${Math.random()}.html`)
  await writeFile(
    file,
    `<!doctype html><html data-theme="${theme}"><head><meta charset="utf-8"><link rel="stylesheet" href="file://${style}"></head><body><dialog id="dialog" open><div class="dialog-body">${body}</div></dialog></body></html>`
  )
  const tab = await browser.newPage()
  await tab.goto(`file://${file}`, { waitUntil: 'load' })
  const seen = await tab.evaluate((list) => {
    const light = (colour: string) => {
      const [r, g, b] = colour
        .match(/\d+(\.\d+)?/g)!
        .slice(0, 3)
        .map((value) => {
          const v = Number(value) / 255
          return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
        })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const ground = getComputedStyle(
      document.querySelector('#dialog')!
    ).backgroundColor
    return Object.fromEntries(
      list.map((selector) => {
        const node = document.querySelector(selector)
        if (!node) return [selector, null]
        const colour = getComputedStyle(node).color
        const [high, low] = [light(colour), light(ground)].sort((a, b) => b - a)
        return [selector, { colour, ratio: (high + 0.05) / (low + 0.05) }]
      })
    )
  }, selectors)
  await tab.close()
  return seen as Record<string, { colour: string; ratio: number } | null>
}

it('marks overdue in a warning colour of its own, readable in either theme (F18, round 1)', async () => {
  const value: Snapshot = structuredClone(snapshot)
  value.project.release!.campaign.find(
    (item) => item.id === 'teaser-x--14'
  )!.state = 'approved'
  for (const theme of ['light', 'dark'] as const) {
    const seen = await contrasts(campaignSection(value, TODAY), theme, [
      '.is-due .campaign-when small',
      '.campaign-when small.campaign-overdue'
    ])
    const due = seen['.is-due .campaign-when small']!
    const overdue = seen['.campaign-when small.campaign-overdue']!
    expect(overdue.colour).not.toBe(due.colour)
    expect(overdue.ratio).toBeGreaterThanOrEqual(4.5)
  }
}, 60_000)
