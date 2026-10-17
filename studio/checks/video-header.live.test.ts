import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import type { Browser } from 'puppeteer'
import type { Snapshot } from '../shared/api'
import { planCampaign } from '../shared/campaign'

// The video stage's header in a real browser, with the studio's own
// stylesheet (review 8, round 1): a long Release label ("Release · 1 due ·
// 1 overdue") never pushes Export MP4 off a phone's screen, nor makes the
// page scroll sideways. A synthetic notebook: nothing is made.
const style = fileURLToPath(new URL('../app/style.css', import.meta.url))
const release = new Date(2026, 9, 20, 18, 0).toISOString()
const project = {
  id: 'header',
  title: 'One click, two lattes',
  source: '',
  slides: [{ id: 'a', title: 'A', svg: '<svg></svg>' }],
  harness: { adapter: 'claude-code' },
  video: {
    settings: { presence: 'off', voice: { kind: 'record' } },
    scenes: [],
    transitions: [],
    inputKey: '',
    produced: { inputKey: 'sb', objectKey: 'v.mp4' },
    storyboard: {
      id: 'sb',
      pages: ['a'],
      stage: 'done',
      status: 'done',
      updatedAt: '',
      produced: { objectKey: 'v.mp4', duration: 50 }
    }
  },
  release: { at: release, teasers: [], campaign: [] }
} as unknown as Snapshot['project']
project.release!.campaign = planCampaign(project, {
  now: new Date(2026, 8, 29)
})
project.release!.campaign[0].state = 'approved'
const snapshot = {
  project,
  status: 'ready',
  error: null,
  events: []
} as unknown as Snapshot

let browser: Browser
let dir: string
beforeAll(async () => {
  const { default: puppeteer } = await import('puppeteer')
  browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  dir = await mkdtemp(join(tmpdir(), 'video-header-'))
})
afterAll(async () => {
  await browser?.close()
  if (dir) await rm(dir, { recursive: true, force: true })
})

it('keeps the video header inside a phone’s width with a long Release label (review 8, round 1)', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 17, 8, 53))
  const { workspaceHeader } = await import('../app/workspace-header')
  const header = workspaceHeader(snapshot, 'video', false)
  vi.useRealTimers()
  expect(header).toContain('Release · 1 due · 1 overdue')
  const file = join(dir, 'header.html')
  await writeFile(
    file,
    `<!doctype html><html data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="file://${style}"></head><body>${header}</body></html>`
  )
  const tab = await browser.newPage()
  for (const width of [1440, 768, 390, 360]) {
    await tab.setViewport({ width, height: 844 })
    await tab.goto(`file://${file}`, { waitUntil: 'load' })
    const at = await tab.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      buttons: [...document.querySelectorAll('header button')].map(
        (button) => ({
          text: button.textContent!.trim(),
          right: button.getBoundingClientRect().right
        })
      )
    }))
    expect(at.scroll).toBeLessThanOrEqual(width)
    for (const button of at.buttons)
      expect(button.right, `${button.text} at ${width} px`).toBeLessThanOrEqual(
        width
      )
    expect(at.buttons.map((button) => button.text)).toContain('Export MP4')
  }
}, 60_000)
