import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
const root = await mkdtemp(join(tmpdir(), 'minimal-product-capture-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const { formatSteps, parseSteps, captureNote } =
  await import('../shared/capture')
const { captureDemo, captureUrl, recordSteps } =
  await import('./product-capture')
const { readAsset, writeRow } = await import('./persistence')
const { loadProject } = await import('./projects')
const { default: puppeteer } = await import('puppeteer')

// A product page on this computer: a button that reveals the plans, a field.
const PAGE = `<!doctype html><html><body style="font:20px sans-serif;padding:40px">
<h1>Acme</h1><button id="plans" onclick="document.getElementById('list').hidden=false">Pricing</button>
<input id="email" placeholder="Email"><input id="secret" type="password">
<ul id="list" hidden><li>Free</li><li>Team</li></ul></body></html>`
let server: Server, url: string
beforeAll(async () => {
  server = createServer((_, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html' })
    response.end(PAGE)
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  url = `http://127.0.0.1:${(server.address() as { port: number }).port}/`
})
afterAll(async () => {
  server.close()
  await rm(root, { recursive: true, force: true })
})
const tools = await (async () => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' })
    return existsSync(await puppeteer.executablePath())
  } catch {
    return false
  }
})()

it('reads and writes a demo’s steps, one a line', () => {
  const text =
    'click Pricing\ntype #email ada@example.com\nscroll 600\nwait 900\ngoto /pricing'
  const { steps, problems } = parseSteps(text)
  expect(problems).toEqual([])
  expect(steps[1]).toEqual({
    do: 'type',
    target: '#email',
    text: 'ada@example.com'
  })
  expect(formatSteps(steps)).toBe(text)
  expect(parseSteps('jump 3\n').problems).toEqual([
    'Line 1: write goto, click, type, scroll or wait, then what to act on',
    'Write at least one step'
  ])
  expect(parseSteps('wait 99999').problems).toHaveLength(2)
  expect(() => captureUrl('file:///etc/passwd')).toThrow('https://')
  expect(
    captureNote({ url, steps, state: 'ready', seconds: 4.2, at: '' })
  ).toContain('A 4.2s capture of')
})

it.skipIf(!tools)(
  'captures a page’s demo with its cursor, as an MP4',
  async () => {
    const id = 'demo'
    await writeRow('projects', id, {
      project: {
        id,
        title: 'Acme',
        source: '',
        slides: [{ id: 'a', title: 'Plans', svg: '<svg/>' }],
        video: null
      },
      status: 'ready',
      error: null,
      events: []
    } satisfies Snapshot)
    const started = await captureDemo(id, {
      slideId: 'a',
      url,
      steps: 'click Pricing\ntype #email ada@example.com'
    })
    expect(started.project.slides[0].capture?.state).toBe('capturing')
    await vi.waitFor(
      async () =>
        expect((await loadProject(id))!.project.slides[0].capture?.state).toBe(
          'ready'
        ),
      { timeout: 60_000, interval: 250 }
    )
    const done = (await loadProject(id))!
    const capture = done.project.slides[0].capture!
    expect(done.project.productUrls).toEqual([url])
    expect(capture.seconds).toBeGreaterThan(2)
    const file = join(root, 'capture.mp4')
    await writeFile(file, await readAsset(capture.objectKey!))
    const probe = execFileSync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'stream=codec_name,width,height',
      '-of',
      'csv=p=0',
      file
    ]).toString()
    expect(probe.trim()).toMatch(/^h264,1280,720/)
  },
  90_000
)

it.skipIf(!tools)(
  'never types into a password field, nor leaves the site',
  async () => {
    await expect(
      recordSteps(url, [{ do: 'type', target: '#secret', text: 'x' }])
    ).rejects.toThrow('password field')
    await expect(
      recordSteps(url, [{ do: 'goto', url: 'https://example.com/' }])
    ).rejects.toThrow('own site')
    await expect(
      recordSteps(url, [{ do: 'click', target: 'Checkout' }])
    ).rejects.toThrow('Could not find “Checkout”')
  },
  90_000
)
