import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { parseHTML } from 'linkedom'
import { afterAll, afterEach, beforeAll, describe } from 'vitest'
import { expect, it, vi } from 'vitest'
import { WebSocket, WebSocketServer } from 'ws'
import type { Snapshot } from '../shared/api'
import { LENGTH_STOPS, windowStops } from '../shared/length'
import { LOOKS, NEUTRAL_LOOK, type Look } from '../shared/looks'
import { lookColour, recolourLook } from '../shared/looks'
import type { Branding, SiteOffer } from '../shared/settings'
import type { VoiceServerMessage } from '../shared/voice'
import type { AppContext } from '../app/app-context'
import { lengthRange } from '../app/length-range'
import { closeLookPanel, lookSample, openLookPanel } from '../app/look-panel'
import { Aliases } from '../app/map-ai-canvas'
import { runAiTool } from '../app/map-ai-tools'
import { installChrome } from '../app/map-chrome'
import { flowSubmit } from '../app/map-flow-input'
import { startMapSeries } from './map-episodes'
import { addNote, settledNotes } from './map-notes'
import { writeRow } from './persistence'
import { loadProject } from './projects'
import { changeSeries } from './series'
import { readSiteBrand } from './site-brand'
import { BRAND_PAGE_SCRIPT } from './site-brand-page'
import { assertPublicHost, assertPublicUrl } from './source-fetch'
import { fetchBinary, fetchText, withFetchBudget } from './source-fetch'
import { validLength } from './video'
import { stopVoiceSessions, voiceDeps, voiceUpgrade } from './voice-relay'
// The browser, DNS, the agent, OpenAI and the map's requests are stand-ins:
// these checks prove review 7's guards and plumbing, not what a site or a
// model would do.
const { launch, lookup, stage, replies, mapApi, api } = vi.hoisted(() => ({
  launch: vi.fn(),
  lookup: vi.fn(),
  stage: vi.fn(),
  replies: {} as Record<string, (input: Record<string, any>) => unknown>,
  mapApi: { note: vi.fn(async () => ({})) },
  api: { load: vi.fn(async () => ({})) }
}))
vi.mock('puppeteer', () => ({ default: { launch } }))
vi.mock('node:dns/promises', () => ({ lookup }))
vi.mock('./creative/stage', () => ({ runValidatedJsonStage: stage }))
vi.mock('./slide-changes', async (original) => ({
  ...(await original<typeof import('./slide-changes')>()),
  scheduleChanges: vi.fn()
}))
vi.mock('../app/api', () => ({ api }))
vi.mock('../app/map-api', () => ({ mapApi }))
stage.mockImplementation(async (input: Record<string, any>) => {
  const report = input.validate(replies[input.route](input))
  if (!report.ok) throw new Error(report.problems.join('; '))
  return report.value
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

const SITE = 'https://brand.example/'
const HOSTILE = 'red"><img src=x onerror=alert(1)>'
const PRIVATE = 'Links to this machine or a private network cannot be read'
const words = (list: string) => list.split(' ')
/** Every event-handler attribute in a piece of parsed markup. */
const handlers = (root: {
  querySelectorAll: (s: string) => Iterable<Element>
}) =>
  [...root.querySelectorAll('*')].flatMap((element) =>
    element.getAttributeNames().filter((name) => /^on/i.test(name))
  )
const BLANK = { title: 'Streamline', source: '', slides: [], video: null }
const READY = { status: 'ready' as const, error: null, events: [] }
const snapshotOf = (project: Partial<Snapshot['project']> & { id: string }) =>
  ({ ...READY, project: { ...BLANK, ...project } }) as Snapshot

// What the brand script reads on a page, with nothing in it but `palette`:
// a hostile page can answer anything there.
const EMPTY_READ =
  '{"meta":{"title":"","siteName":"","description":"","themeColor":""},"stats":[],"fonts":{"ranked":[],"heading":"","body":"","mono":"","variables":{},"faces":[],"blocked":[],"loaded":[]},"logos":[],"icons":[]}'
const pageRead = (palette: unknown) => ({ ...JSON.parse(EMPTY_READ), palette })
// A browser that draws nothing. A hanging one never finishes loading the
// page until it is closed.
const browserFor = (read: unknown, hang = false) => {
  let shut = () => {}
  const closed = new Promise<never>((_resolve, reject) => {
    shut = () => reject(new Error('Target closed'))
  })
  closed.catch(() => {})
  let reached = () => {}
  const navigating = new Promise<void>((resolve) => (reached = resolve))
  const on: Record<string, (value: unknown) => void> = {}
  const idle = async () => {}
  const blocked: unknown[] = []
  const page = {
    setBypassServiceWorker: idle,
    createCDPSession: async () => ({
      send: async (method: string, value?: unknown) =>
        method === 'Network.setBlockedURLs' && blocked.push(value)
    }),
    setRequestInterception: idle,
    setUserAgent: idle,
    setViewport: idle,
    emulateMediaFeatures: idle,
    on: (name: string, handler: (value: unknown) => void) =>
      (on[name] = handler),
    goto: async () => (reached(), hang ? closed : {}),
    url: () => (hang ? 'about:blank' : SITE),
    evaluate: async (script: unknown) =>
      script === BRAND_PAGE_SCRIPT ? read : undefined
  }
  const browser = {
    newPage: async () => page,
    close: vi.fn(async () => shut())
  }
  launch.mockResolvedValue(browser)
  return { browser, on, navigating, blocked }
}

const paper = NEUTRAL_LOOK.palette
// A cream and a green tint near Paper's lines: review 7 saw them snapped to
// grey by a recolour from Paper to Paper.
const DRAWN =
  '<svg viewBox="0 0 1280 720"><rect fill="#f6f3ec"/><rect fill="#e3ead9"/><text font-family="Inter, sans-serif" fill="#1f2328">A</text></svg>'
const brandingOf = (look: Look, extra: Partial<Branding> = {}): Branding => ({
  ...{ name: '', tagline: '', useAccent: true, logoKey: null },
  ...{ accent: look.palette.accent, palette: look.palette, fonts: look.fonts },
  look: { id: look.id, name: look.name },
  ...extra
})
const LOGO = { pngKey: 'logo.png', width: 120, height: 30, label: 'home' }
const siteOf = (palette?: Look['palette']): SiteOffer => ({
  from: 'brand.example',
  logo: { ...LOGO, from: 'brand.example' },
  fontFiles: [],
  ...(palette && { look: { ...NEUTRAL_LOOK, palette } })
})
// A notebook with a drawn wireframe and its thumbnail, as the Look panel
// finds them.
const lookApp = (branding: Branding) => {
  const { document, Event } = parseHTML(
    `<!doctype html><html><head></head><body><div id="app"><div class="stage">${DRAWN}</div><div class="thumbnail"><div>${DRAWN}</div></div></div></body></html>`
  )
  vi.stubGlobal('document', document)
  const root = document.querySelector('#app')!
  const snapshot = snapshotOf({
    id: 'look',
    slides: [{ id: 'p1', title: 'One', svg: DRAWN }],
    sourceUrl: `${SITE}post`,
    branding
  })
  const app = { root, snapshot, render: () => {} } as unknown as AppContext
  const click = (selector: string) =>
    document
      .querySelector(selector)!
      .dispatchEvent(new Event('click', { bubbles: true }))
  return { app, root, document, click }
}

describe('SR-3: a site’s palette and the Look panel', () => {
  it('keeps only #RRGGBB colours from a site’s palette, at most 24', async () => {
    const shades = Array.from({ length: 30 }, (_, i) => `#0000${i + 10}`)
    const valid = ['#635BFF', '#0a2540', '#ffffff']
    const junk = ['" onmouseover="alert(1)', 'rgb(1, 2, 3)', '#abc', ' #fff000']
    const read = [valid[0], HOSTILE, valid[1], ...junk, 42, null, valid[2]]
    browserFor(pageRead([...read, ...shades]))
    expect((await readSiteBrand(SITE))?.palette).toEqual([
      ...valid,
      ...shades.slice(0, 21)
    ])
    // A palette that isn't a list keeps nothing.
    browserFor(pageRead(HOSTILE))
    expect((await readSiteBrand(SITE))?.palette).toEqual([])
  }, 15_000)

  it('escapes palette values in the Look panel’s sample', () => {
    const palette = { ...paper, ground: HOSTILE, accent: "x' onfocus='y" }
    const html = lookSample('A <b>title</b>', { ...NEUTRAL_LOOK, palette })
    expect(html).not.toContain('"><img')
    const sample = parseHTML(`<div>${html}</div>`).document
    expect(sample.querySelector('img')).toBeNull()
    expect(handlers(sample)).toEqual([])
    expect(
      sample.querySelector('.look-sample')!.getAttribute('style')
    ).toContain(`--look-ground:${HOSTILE};`)
  })

  it('never lets a site’s colours into the Look panel as markup', () => {
    const palette = { ...paper, ground: HOSTILE, secondary: '"><b onclick=x>' }
    const own = { ...LOOKS[0], id: 'custom', palette }
    const { app, document } = lookApp(
      brandingOf(own, { site: siteOf(palette) })
    )
    openLookPanel(app)
    try {
      const panel = document.querySelector('aside.look-panel')!
      // The site's logo is the panel's one picture.
      expect(panel.querySelectorAll('img')).toHaveLength(1)
      expect(handlers(panel)).toEqual([])
      const ground = panel.querySelector('[data-look-colour="ground"]')
      expect((ground as HTMLInputElement).value).toBe(HOSTILE)
    } finally {
      closeLookPanel(app)
    }
  })
})

describe('SR-11: the length window on the slider’s stops', () => {
  const goal = (min: number, max: number, strict = false) => ({
    min,
    max,
    strict
  })

  it('shows a 20–30 min window on the slider’s last two stops, never as NaN', () => {
    const last = LENGTH_STOPS.length - 1
    expect(windowStops(goal(1200, 1800))).toEqual([last - 1, last])
    // The start is clamped to the last stop but one.
    expect(windowStops(goal(1200, 1500))[0]).toBe(last - 1)
    const html = lengthRange(goal(1200, 1800))
    expect(html).not.toContain('NaN')
    expect(html).toContain('>15–20 min<')
    expect(html).toContain('name="min" value="900"')
    expect(html).toContain('name="max" value="1200"')
    expect(html).toContain(`value="${last - 1}" data-length-end="min"`)
    expect(html).toContain(`value="${last}" data-length-end="max"`)
  })

  it('keeps every window the engine accepts on the slider’s stops, as the slider shows it', () => {
    expect(validLength(goal(1200, 1800))).toEqual(goal(900, 1200))
    expect(validLength(goal(50, 100, true))).toEqual(goal(45, 90, true))
    for (const min of [10, 14, 16, 25, 50, 59, 100, 121, 599, 1200, 5399])
      for (const max of [11, 20, 33, 89, 100, 151, 700, 1199, 1800, 5400]) {
        if (min >= max) continue
        const saved = validLength({ min, max })!
        expect(LENGTH_STOPS, `${min}–${max}`).toContain(saved.min)
        expect(LENGTH_STOPS, `${min}–${max}`).toContain(saved.max)
        expect(saved.min).toBeLessThan(saved.max)
        expect(validLength(saved)).toEqual(saved)
        const html = lengthRange(saved)
        expect(html).not.toContain('NaN')
        expect(html).toContain(`name="min" value="${saved.min}"`)
        expect(html).toContain(`name="max" value="${saved.max}"`)
      }
  })
})

describe('SR-12: brand downloads stay on the public internet, bounded', () => {
  const INSIDE = words(
    'localhost localhost. LOCALHOST:4320 app.localhost printer.local 127.0.0.1 127.1 2130706433 0x7f.0.0.1 0.0.0.0 10.0.0.1 100.64.0.1 100.127.255.254 169.254.169.254 172.16.0.1 172.31.255.255 192.168.1.1 224.0.0.1 255.255.255.255 [::1] [::] [::ffff:127.0.0.1] [::ffff:a9fe:a9fe] [fd12:3456::1] [fe80::1] [ff02::1] [::7f00:1] [64:ff9b::7f00:1] [64:ff9b::a00:1] [2002:7f00:1::]'
  )
  const OUTSIDE = words(
    'brand.example 93.184.216.34 100.128.0.1 172.32.0.1 [2606:4700::1111] [64:ff9b::808:808]'
  )
  // The guard stands unless the scripted checks' loopback flag is on.
  const guarded = () => vi.stubEnv('STUDIO_ENABLE_TEST_HOOKS', undefined)
  const redirect = (status: number, location: string) =>
    new Response(null, { status, headers: { location } })
  const at = (address: string) => [{ address, family: 4 }]

  it('refuses this machine and private networks however the host is written', () => {
    guarded()
    for (const host of INSIDE)
      expect(() => assertPublicUrl(`http://${host}/x`), host).toThrow(PRIVATE)
    for (const host of OUTSIDE)
      expect(assertPublicUrl(`http://${host}/x`).href).toBe(`http://${host}/x`)
  })

  it('refuses a name that resolves to a private address, and looks none up in unit checks', async () => {
    guarded()
    const answers: Record<string, string[]> = {
      'intranet.example': ['10.0.0.5'],
      'mixed.example': ['93.184.216.34', '::1'],
      'mapped.example': ['::ffff:192.168.0.1'],
      'carrier.example': ['100.64.1.1'],
      'public.example': ['93.184.216.34', '2606:2800:220:1::1946']
    }
    const resolve = vi.fn(async (host: string) => {
      if (!answers[host]) throw new Error('ENOTFOUND')
      return answers[host].flatMap(at)
    })
    const check = (raw: string) => assertPublicHost(raw, resolve)
    // Unit checks never reach DNS: their setup turns the lookup off.
    await expect(check('https://intranet.example/')).resolves.toBeTruthy()
    expect(resolve).not.toHaveBeenCalled()
    vi.stubEnv('MINIMAL_STUDIO_RESOLVE_HOSTS', '1')
    for (const host of words(
      'intranet.example intranet.example. mixed.example mapped.example carrier.example'
    ))
      await expect(check(`https://${host}/logo.svg`), host).rejects.toThrow(
        PRIVATE
      )
    // The trailing dot is gone before the name is looked up.
    expect(resolve.mock.calls.map(([host]) => host)).not.toContain(
      'intranet.example.'
    )
    await expect(check('https://public.example/a.svg')).resolves.toMatchObject({
      hostname: 'public.example'
    })
    // A literal address is checked as it is, not looked up.
    resolve.mockClear()
    await expect(check('http://10.0.0.1/')).rejects.toThrow(PRIVATE)
    await expect(check('http://93.184.216.34/')).resolves.toBeTruthy()
    expect(resolve).not.toHaveBeenCalled()
  })

  it('checks every redirect hop, by its address and by its name', async () => {
    guarded()
    const [logo, icon] = [`${SITE}logo.png`, `${SITE}icon.png`]
    const fetch = vi.fn(async (url: string, _init?: RequestInit) =>
      url === logo
        ? redirect(302, 'http://169.254.169.254/latest/meta-data/')
        : url === icon
          ? redirect(301, '//cdn.brand.example/icon.png')
          : new Response('inside', { headers: { 'content-type': 'image/png' } })
    )
    vi.stubGlobal('fetch', fetch)
    expect(await fetchBinary(logo, 400_000)).toBeNull()
    await expect(fetchText(logo, 400_000)).rejects.toThrow(PRIVATE)
    expect(fetch).toHaveBeenCalledTimes(2)
    for (const [url, init] of fetch.mock.calls)
      expect([url, init?.redirect]).toEqual([logo, 'manual'])
    // A hop to a public name that resolves to a private address.
    vi.stubEnv('MINIMAL_STUDIO_RESOLVE_HOSTS', '1')
    lookup.mockImplementation(async (host: string) =>
      at(host.startsWith('cdn.') ? '10.0.0.7' : '93.184.216.34')
    )
    expect(await fetchBinary(icon, 400_000)).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(lookup).toHaveBeenCalledWith('cdn.brand.example', { all: true })
  })

  it('follows a public redirect by hand, and stops after six', async () => {
    guarded()
    const fetch = vi.fn(async (url: string) =>
      url === `${SITE}a`
        ? redirect(308, '/b')
        : url === `${SITE}b`
          ? new Response('<p>Hi</p>')
          : redirect(302, `${url}x`)
    )
    vi.stubGlobal('fetch', fetch)
    expect((await fetchText(`${SITE}a`, 1000)).text).toBe('<p>Hi</p>')
    await expect(fetchText('https://loop.example/', 1000)).rejects.toThrow(
      'Too many redirects'
    )
    expect(fetch).toHaveBeenCalledTimes(2 + 6)
  })

  it('stops reading a body at its cap, and refuses one by its declared length', async () => {
    guarded()
    const CHUNK = 64 * 1024
    // A body that never ends, counting what was read from it.
    const serve = (headers: Record<string, string>) => {
      const seen = { bytes: 0, cancelled: false }
      const body = new ReadableStream<Uint8Array>({
        pull(controller) {
          seen.bytes += CHUNK
          controller.enqueue(new Uint8Array(CHUNK).fill(97))
        },
        cancel() {
          seen.cancelled = true
        }
      })
      vi.stubGlobal('fetch', async () => new Response(body, { headers }))
      return seen
    }
    const image = serve({ 'content-type': 'image/png' })
    expect(await fetchBinary(`${SITE}huge.png`, 400_000)).toBeNull()
    expect(image).toEqual({ bytes: expect.any(Number), cancelled: true })
    expect(image.bytes).toBeLessThan(400_000 + 3 * CHUNK)
    const page = serve({ 'content-type': 'text/html' })
    expect((await fetchText(SITE, 400 * 1024)).text).toHaveLength(400 * 1024)
    expect(page).toEqual({ bytes: expect.any(Number), cancelled: true })
    expect(page.bytes).toBeLessThan(400 * 1024 + 3 * CHUNK)
    const font = serve({
      'content-type': 'font/woff2',
      'content-length': '50000000'
    })
    expect(
      await fetchBinary(`${SITE}f.woff2`, 1_500_000, 10_000, /^/)
    ).toBeNull()
    expect(font.cancelled).toBe(true)
    expect(font.bytes).toBeLessThanOrEqual(CHUNK)
  })

  it('ends a brand read’s downloads when its time budget runs out', async () => {
    guarded()
    const hang = (_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) =>
        init?.signal?.addEventListener('abort', () => reject(Error('aborted')))
      )
    const fetch = vi.fn(hang)
    vi.stubGlobal('fetch', fetch)
    const budget = new AbortController()
    const reading = withFetchBudget(budget.signal, () =>
      fetchText(SITE, 1000, 60_000)
    )
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    budget.abort()
    await expect(reading).rejects.toThrow()
    // Past the budget nothing more is fetched.
    const late = await withFetchBudget(budget.signal, () =>
      fetchBinary(SITE, 9)
    )
    expect(late).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('gives the whole brand read 45 seconds, and checks the browser’s own requests', async () => {
    guarded()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const site = browserFor(pageRead([]), true)
    const reading = readSiteBrand(SITE)
    await site.navigating
    // Puppeteer's own: each answer is a promise.
    const answer = () => vi.fn(async () => {})
    const asks = words(
      'http://169.254.169.254/ http://localhost./admin https://cdn.brand.example/app.css data:font/woff2;base64,AAAA'
    ).map((url) => ({ url: () => url, continue: answer(), abort: answer() }))
    for (const ask of asks) site.on.request(ask)
    await new Promise((resolve) => setImmediate(resolve))
    const calls = (key: 'abort' | 'continue') =>
      asks.map((ask) => ask[key].mock.calls.length)
    expect(calls('abort')).toEqual([1, 1, 0, 0])
    expect(calls('continue')).toEqual([0, 0, 1, 1])
    // What interception can't see is shut: WebSockets never open.
    expect(site.blocked).toEqual([{ urls: ['ws://*', 'wss://*'] }])
    await vi.advanceTimersByTimeAsync(44_000)
    expect(site.browser.close).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(await reading).toBeNull()
    expect(site.browser.close).toHaveBeenCalled()
  })
})

describe('SR-13: family names and the map’s zoom level', () => {
  const PAGE =
    '<svg><text font-family="Inter, Helvetica, sans-serif" font-size="40">Title</text>' +
    '<text font-family="Inter, Helvetica, sans-serif" font-size="18">Body</text>' +
    '<text font-family="ui-monospace, Menlo, monospace" font-size="18">code</text></svg>'

  it('quotes a family name only when CSS needs it, and still swaps it back', () => {
    const from = NEUTRAL_LOOK.fonts
    const to = { display: 'Source Sans 3', body: 'Gill Sans', mono: 'Hack' }
    const moved = recolourLook(PAGE, paper, paper, { from, to })
    expect(moved).toContain(
      `font-family="'Source Sans 3', Helvetica, sans-serif" font-size="40"`
    )
    expect(moved).toContain(
      'font-family="Gill Sans, Helvetica, sans-serif" font-size="18"'
    )
    expect(moved).toContain('font-family="Hack, Menlo, monospace"')
    expect(recolourLook(moved, paper, paper, { from: to, to: from })).toBe(PAGE)
    // A name with quotes in it stays inside its attribute.
    const odd = recolourLook(PAGE, paper, paper, {
      from,
      to: { ...to, mono: `O'Neil" onload="alert(1)` }
    })
    expect(odd).toContain(
      `font-family="'O\\'Neil&quot; onload=&quot;alert(1)', Menlo, monospace"`
    )
    expect(handlers(parseHTML(odd).document)).toEqual([])
  })

  it('gives a map reopened at the same far zoom its far-zoom classes', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const canvas = () => parseHTML('<div></div>').document.querySelector('div')!
    const map = {
      onCamera: [] as Array<(animate: boolean) => void>,
      camera: { x: 0, y: 0, k: 0.3 },
      mapId: 'map',
      canvas: canvas()
    }
    installChrome(map as never)
    const moved = () => map.onCamera.forEach((follow) => follow(false))
    moved()
    expect(map.canvas.className).toBe('is-far is-farthest')
    // Reopened: a new canvas, and the camera put back where it was.
    map.canvas = canvas()
    moved()
    expect(map.canvas.className).toBe('is-far is-farthest')
    map.camera.k = 1
    moved()
    expect(map.canvas.className).toBe('')
    vi.clearAllTimers()
  })
})

describe('UX-5 and UX-6: the Look panel’s preview', () => {
  it('returns a drawing unchanged when the palettes and fonts stay the same', () => {
    const fonts = NEUTRAL_LOOK.fonts
    // A recolour onto the same look still moved these tints onto its lines.
    expect(lookColour('#f6f3ec', paper, paper)).not.toBe('#f6f3ec')
    expect(recolourLook(DRAWN, paper, { ...paper })).toBe(DRAWN)
    const same = { from: fonts, to: { ...fonts } }
    expect(recolourLook(DRAWN, paper, { ...paper }, same)).toBe(DRAWN)
    // Another look still recolours, and another face still swaps.
    const mint = LOOKS[3].palette
    expect(recolourLook(DRAWN, paper, mint)).not.toContain('#f6f3ec')
    const georgia = { from: fonts, to: { ...fonts, body: 'Georgia' } }
    expect(recolourLook(DRAWN, paper, paper, georgia)).toContain(
      'font-family="Georgia, sans-serif"'
    )
  })

  it('leaves drawn wireframes alone when the panel opens, and restores them when the current look is chosen again', () => {
    const { app, root, click } = lookApp(brandingOf(LOOKS[0]))
    const stage = root.querySelector('.stage')!
    const [drawn, thumbnail] = root.querySelectorAll('svg')
    const before = stage.innerHTML
    openLookPanel(app)
    try {
      // Not repainted: the very same nodes, as they were.
      expect(root.querySelectorAll('svg')[0]).toBe(drawn)
      expect(root.querySelectorAll('svg')[1]).toBe(thumbnail)
      expect(stage.innerHTML).toBe(before)
      expect(before).toContain('fill="#f6f3ec"')
      click('[data-look-id="ink"]')
      expect(stage.innerHTML).not.toContain('#f6f3ec')
      click('[data-look-id="paper"]')
      expect(stage.innerHTML).toBe(before)
      expect(root.querySelector('.thumbnail > div')!.innerHTML).toBe(before)
    } finally {
      closeLookPanel(app)
    }
  })

  it('previews the site’s logo on its look’s own ground, not on the panel’s chip', () => {
    // A cream site whose look the notebook wears; a site with no look, and
    // the notebook in white Paper.
    const cream = { ...LOOKS[4], id: 'site' }
    for (const [look, site, ground] of [
      [cream, siteOf(cream.palette), '#fbf7ef'],
      [LOOKS[0], siteOf(), '#ffffff']
    ] as const) {
      const { app, document } = lookApp(brandingOf(look, { site }))
      openLookPanel(app)
      try {
        const logo = document.querySelector('.look-logo img')!
        expect(logo.getAttribute('style')).toBe(`background:${ground}`)
      } finally {
        closeLookPanel(app)
      }
    }
  })
})

describe('CV-6: a gap’s note says which gap', () => {
  const gap = (id: string, missing: string) =>
    ({ id, missing, why: 'w', ask: `${missing}?`, state: 'open' }) as const
  // A drawn map whose series misses two things.
  const gappedMap = async (id: string) => {
    const slides = ['Why it exists', 'Deploy it'].map((title, index) => ({
      id: `${id}-${index + 1}`,
      title,
      svg: `<svg><text>${title}</text></svg>`,
      idea: `${title}, in a sentence`
    }))
    const source = 'Streamline runs custom video pipelines.'
    const harness = { adapter: 'claude-code' as const }
    await writeRow('projects', id, snapshotOf({ id, source, harness, slides }))
    await writeRow('outlines', id, {
      source: { title: 'Streamline', text: source },
      brand: {},
      outline: { title: 'Streamline', scenes: slides },
      slideIds: slides.map((s) => s.id)
    })
    await writeRow('sources', id, { title: 'Streamline', text: source })
    const series = await startMapSeries(id, {})
    await changeSeries(series.id, (current) => {
      current.gaps = [gap('roles', 'IAM roles'), gap('costs', 'Costs')]
    })
  }
  const lastNote = async (id: string) =>
    (await loadProject(id))!.project.notes!.at(-1)!
  const sorted = (fills: string) => () => ({
    items: [{ kind: 'new', line: 'An answer', title: 'It', after: null, fills }]
  })

  it('gives Sort Note the gap a note was sent for, and checks the sorting answers it', async () => {
    await gappedMap('gap-map')
    const told: string[] = []
    replies['Sort Note'] = (input) => {
      told.push(input.packet['packet/NOTE.md'])
      return sorted('roles')()
    }
    const text = 'A deployer role and a reader role.'
    const started = await addNote('gap-map', { text, gap: 'roles' })
    expect(started.project.notes!.at(-1)).toMatchObject({
      gap: 'roles',
      state: 'sorting'
    })
    await settledNotes()
    expect(told[0]).toContain('gap roles')
    expect(told[0]).toContain(text)
    expect(await lastNote('gap-map')).toMatchObject({
      state: 'sorted',
      results: [{ kind: 'new', fills: 'roles' }]
    })
    // A sorting that answers another gap is sent back, then fails.
    replies['Sort Note'] = sorted('costs')
    await addNote('gap-map', { text: 'Roles, again.', gap: 'roles' })
    await settledNotes()
    expect(await lastNote('gap-map')).toMatchObject({
      state: 'failed',
      error: expect.stringContaining(
        'Create a new card answering the requested gap roles'
      )
    })
  })

  it('refuses a gap that is not an open gap of the series', async () => {
    await gappedMap('gap-map-2')
    await expect(
      addNote('gap-map-2', { text: 'Something.', gap: 'not-a-gap' })
    ).rejects.toThrow('Choose an open gap of this series')
  })

  it('sends the gap id from a gap’s note form and from Studio AI’s add_note', async () => {
    const text = 'Deployer and reader roles'
    vi.stubGlobal('FormData', function () {
      return { get: (name: string) => (name === 'note' ? text : null) }
    })
    const run = async (work: () => Promise<unknown>) => (await work(), true)
    const asked = { mapId: 'map', noteAsk: { text: '', gap: 'gap-1' }, run }
    const form = { dataset: { mapForm: 'flow-note' } }
    expect(await flowSubmit(asked as never, form as never)).toBe(true)
    expect(mapApi.note).toHaveBeenLastCalledWith('map', text, 'gap-1')
    // Studio AI names the gap by its short id on the canvas.
    mapApi.note.mockClear()
    vi.stubGlobal('document', { activeElement: null, body: null })
    const aliases = new Aliases()
    expect(aliases.of('g', 'gap-1')).toBe('g1')
    // A canvas with no menu to open, and a cursor that moves at once.
    const idle = async () => {}
    const box = { id: 'gap-1', x: 900, y: 40, w: 220, h: 90 }
    const map = {
      ...{ mapId: 'map', layout: { gaps: [box] }, slot: () => null },
      ...{ root: { querySelector: () => null }, refresh: idle, toast() {} }
    }
    const cursor = {
      ...{ glide: idle, press: idle, type: idle, doing() {}, typed() {} },
      screenOf: (point: { x: number; y: number }) => point
    }
    const outcome = await runAiTool(
      map as never,
      cursor as never,
      aliases,
      'add_note',
      { text, gap: 'g1' }
    )
    expect(outcome).toMatchObject({ ok: true })
    expect(mapApi.note).toHaveBeenLastCalledWith('map', text, 'gap-1')
  })
})

describe('CV-5 and UX-7: the voice socket', () => {
  const yes = { intent: 'plan' as const, act: 1, yes: 1, probabilities: {} }
  const CONFIRMED = '{"confirmed":true}'
  const realtime = new WebSocketServer({ port: 0, host: '127.0.0.1' })
  const studio = createServer((_request, response) =>
    response.writeHead(404).end()
  )
  studio.on('upgrade', (request, socket, head) => {
    if (!voiceUpgrade(request, socket, head)) socket.destroy()
  })
  const upstream: Array<Record<string, any>> = []
  let service: WebSocket | null = null
  let dialled = 0
  realtime.on('connection', (socket) => {
    dialled++
    service = socket
    socket.on('message', (data) => upstream.push(JSON.parse(String(data))))
    socket.send(JSON.stringify({ type: 'session.created' }))
  })
  const toService = (event: object) => service!.send(JSON.stringify(event))
  const map = 'review-7-voice'
  let port = 0
  const until = async (check: () => unknown) => {
    for (const end = Date.now() + 3000; !check(); ) {
      if (Date.now() > end) throw new Error('Timed out')
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
  }
  const open = async () => {
    const origin = `http://127.0.0.1:${port}`
    const page = new WebSocket(
      `ws://127.0.0.1:${port}/api/projects/${map}/voice`,
      { headers: { origin } }
    )
    const heard: VoiceServerMessage[] = []
    page.on('message', (data) => heard.push(JSON.parse(String(data))))
    await new Promise<void>((resolve, reject) =>
      page.on('open', () => resolve()).on('error', reject)
    )
    return { page, heard }
  }

  beforeAll(async () => {
    await new Promise<void>((resolve) => studio.listen(0, '127.0.0.1', resolve))
    port = (studio.address() as AddressInfo).port
    if (!realtime.address())
      await new Promise<void>((resolve) => realtime.on('listening', resolve))
    const realtimePort = (realtime.address() as AddressInfo).port
    voiceDeps.url = () => `ws://127.0.0.1:${realtimePort}/v1/realtime`
    voiceDeps.jev = () => true
    voiceDeps.classify = async (state: unknown) =>
      (state as { latest: string }).latest.startsWith('Yes') ? yes : null
    await writeRow('projects', map, snapshotOf({ id: map }))
  })
  afterAll(async () => {
    stopVoiceSessions()
    for (const client of realtime.clients) client.terminate()
    await new Promise<void>((resolve) => realtime.close(() => resolve()))
    await new Promise<void>((resolve) => studio.close(() => resolve()))
  })

  it('uses each spoken yes for one big change: a second change on the same yes is held', async () => {
    voiceDeps.key = async () => 'stand-in-key'
    const { page, heard } = await open()
    await until(() => upstream.some((e) => e.type === 'session.update'))
    toService({ type: 'session.updated' })
    await until(() => heard.some((m) => m.type === 'ready'))
    const say = (item: string, transcript: string) => {
      toService({ type: 'input_audio_buffer.committed', item_id: item })
      toService({
        type: 'conversation.item.input_audio_transcription.completed',
        item_id: item,
        transcript
      })
    }
    const call = (call_id: string, name: string) =>
      toService({
        type: 'response.output_item.done',
        item: { type: 'function_call', call_id, name, arguments: CONFIRMED }
      })
    const got = (type: string, call: string) =>
      heard.some((m) => m.type === type && 'call' in m && m.call === call)
    say('u1', 'Yes, plan it again')
    call('call-1', 'plan_series')
    await until(() => got('tool', 'call-1'))
    // Studio AI's follow-up leans on the same yes for a second big change.
    call('call-2', 'undo_organize')
    await until(() => got('held', 'call-2'))
    expect(got('tool', 'call-2')).toBe(false)
    const told = upstream.find((e) => e.item?.call_id === 'call-2')
    expect(JSON.parse(told!.item.output)).toMatchObject({
      ok: false,
      error: expect.stringMatching(/new confirmation/)
    })
    // A new yes, even in the same words, lets the next one through.
    say('u2', 'Yes, plan it again')
    call('call-3', 'undo_organize')
    await until(() => got('tool', 'call-3'))
    page.send(JSON.stringify({ type: 'stop' }))
    await until(() => heard.some((m) => m.type === 'closed'))
  })

  it('says a missing key by its code, with Settings → API keys and OPENAI_API_KEY, and never dials out', async () => {
    voiceDeps.key = async () => ''
    const before = dialled
    const { heard } = await open()
    await until(() => heard.some((m) => m.type === 'closed'))
    const error = heard.find((m) => m.type === 'error')
    expect(error).toMatchObject({ type: 'error', code: 'no-key' })
    expect(error && 'message' in error && error.message).toMatch(
      /Settings → API keys.*OPENAI_API_KEY/
    )
    expect(dialled).toBe(before)
  })
})
