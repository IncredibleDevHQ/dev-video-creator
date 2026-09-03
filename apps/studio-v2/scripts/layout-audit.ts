// Layout audit harness: compiles single-block projects across configuration
// axes with the real compiler and screenshots each at 1920x1080.
// Usage (from apps/studio-v2): AUDIT_PRESENTER_URL=<http url> npx tsx scripts/layout-audit.ts <outDir> <matrixJson>
// matrixJson: [{ name, node: TiptapNode, config: partial BlockRenderConfigV1, presenter?: boolean, at?: seconds }]
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  compileProject,
  createDefaultBlockConfig,
  defaultBrand,
  type ProjectDocumentV1,
  type TiptapNode,
} from 'markdown-composition'

const require = createRequire(import.meta.url)
const puppeteer = require('puppeteer')
const gsapUrl = pathToFileURL(join(dirname(require.resolve('gsap')), 'gsap.min.js')).href

const [, , outDir, matrixPath] = process.argv
mkdirSync(outDir, { recursive: true })
const matrix = JSON.parse(readFileSync(matrixPath, 'utf8')) as Array<{
  name: string
  node: TiptapNode
  config: Record<string, unknown>
  presenter?: boolean
  at?: number
}>

// The compiler only accepts http(s)/blob sources, so the presenter photo is
// served by the local worker (AUDIT_PRESENTER_URL).
const presenterImage = process.env.AUDIT_PRESENTER_URL || ''

const deepMerge = (base: any, patch: any) => {
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      base[key] = deepMerge(base[key] || {}, value)
    } else base[key] = value
  }
  return base
}

const browser = await puppeteer.launch()
const page = await browser.newPage()
await page.setViewport({ width: 1920, height: 1080 })
for (const entry of matrix) {
  const id = 'b1'
  const node = { ...entry.node, attrs: { ...(entry.node.attrs || {}), id } }
  const config = deepMerge(createDefaultBlockConfig(id, node), entry.config)
  const project: ProjectDocumentV1 = {
    version: 1,
    id: 'audit',
    title: 'Layout audit',
    notebook: { type: 'doc', content: [node] },
    fps: 30,
    width: 1920,
    height: 1080,
    blocks: { [id]: config },
    presenterTracks: {},
    brand: defaultBrand,
  }
  const compiled = compileProject(project, {
    gsapUrl,
    // No runtime for stills: it would pin the timeline to its own clock.
    hyperframesRuntimeUrl: 'data:text/javascript,',
    previewPresenter: entry.presenter ? { imageUrl: presenterImage, name: 'Arun' } : undefined,
  })
  const htmlPath = join(outDir, `${entry.name}.html`)
  writeFileSync(htmlPath, compiled.html)
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' })
  await page.evaluate(async (t: number) => {
    // Drive the GSAP timeline directly and stamp clip windows ourselves —
    // the same visibility rule the runtime applies from data-start/duration.
    const w = window as any
    const tl = w.__timelines?.audit
    if (tl) {
      tl.pause()
      tl.time(t)
      tl.render(t, true, true)
    }
    document.querySelectorAll<HTMLElement>('.clip').forEach(el => {
      const start = Number(el.dataset.start || 0)
      const duration = Number(el.dataset.duration || 0)
      const inside = t >= start && (duration <= 0 || t < start + duration)
      el.style.visibility = inside ? 'visible' : 'hidden'
    })
    await new Promise(r => setTimeout(r, 300))
  }, entry.at ?? 2.5)
  await page.screenshot({ path: join(outDir, `${entry.name}.png`) })
  const state = await page.evaluate(() => {
    const content = document.querySelector('.content')
    const w = window as any
    return {
      hiddenClips: Array.from(document.querySelectorAll('.clip')).filter(el => getComputedStyle(el).visibility === 'hidden').length,
      contentOpacity: content ? getComputedStyle(content).opacity : 'n/a',
      tlTime: w.__timelines?.audit?.time(),
    }
  })
  console.log(entry.name, JSON.stringify(state))
}
await browser.close()
