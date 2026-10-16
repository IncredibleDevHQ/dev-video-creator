// The brand a site shows, read inside the studio: the page is rendered in a
// headless browser, one pass collects how every colour is used, the faces it
// sets text in and declares, and its logo candidates (site-brand-page.ts),
// and the roles are picked by what each colour does (brand-colour.ts). The
// site's own logo is kept as a transparent PNG (and as safe SVG when it is
// drawn so), its best icon as a square mark, and the files of its openly
// licensed faces so a look can carry them.
import type { Browser, Page } from 'puppeteer'
import type { BrandFontFile, SiteLogo } from '../shared/settings'
import { brandRoles, type BrandRoles, type ColourStat } from './brand-colour'
import { fontRoles, openFamily, type FontSignals } from './brand-fonts'
import { storeAsset } from './persistence'
import { BRAND_PAGE_SCRIPT } from './site-brand-page'
import { rankIcons, readableOn, sanitizeSvg, type IconLink } from './site-logo'
import {
  UA,
  fetchBinary,
  fetchText,
  publicUrl,
  assertPublicHost,
  withFetchBudget
} from './source-fetch'

type DeclaredFace = {
  family: string
  weight: string
  style: string
  sources: Array<{ url: string; format: string }>
  /** The characters the file covers (`unicode-range`), when it says. */
  range?: string
}

type PageRead = {
  meta: {
    title: string
    siteName: string
    description: string
    themeColor: string
  }
  palette: string[]
  stats: ColourStat[]
  fonts: FontSignals & {
    faces: DeclaredFace[]
    blocked: string[]
    /** Faces the page loaded, however declared (CSS or script). */
    loaded: Array<{ family: string; weight: string; style: string }>
  }
  logos: Array<{
    index: number
    kind: 'svg' | 'img'
    score: number
    label: string
    width: number
    height: number
    markup?: string
    src?: string
  }>
  icons: IconLink[]
}

export type SiteBrand = {
  roles: BrandRoles | null
  /** The page's colours in order of prominence. */
  palette: string[]
  fonts: { display: string; body: string; mono: string; seen: string[] }
  fontFiles: BrandFontFile[]
  logo?: SiteLogo
  /** The site's square icon, at least 96 px. */
  symbol?: SiteLogo
  themeColor: string
}

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms))

const FORMATS: Record<string, BrandFontFile['format']> = {
  wOF2: 'woff2',
  wOFF: 'woff',
  OTTO: 'opentype',
  true: 'truetype',
  '\u0000\u0001\u0000\u0000': 'truetype'
}
const EXTENSIONS: Record<BrandFontFile['format'], string> = {
  woff2: '.woff2',
  woff: '.woff',
  opentype: '.otf',
  truetype: '.ttf'
}

/** What a font file is, by its first bytes; null for anything else. */
export const fontFormat = (bytes: Buffer) =>
  FORMATS[bytes.subarray(0, 4).toString('latin1')] ?? null

/** A face's weight: one value, or a variable face's range. */
export const faceWeight = (raw: string): BrandFontFile['weight'] => {
  const named: Record<string, number> = { normal: 400, bold: 700 }
  const values = raw
    .trim()
    .split(/\s+/)
    .map((part) => named[part] ?? Number(part))
    .filter((value) => value >= 1 && value <= 1000)
  if (values.length === 2 && values[0] !== values[1])
    return [Math.min(...values), Math.max(...values)]
  return values[0] || 400
}

// @font-face rules in a stylesheet the page could not read for us (another
// origin's, with no CORS), parsed from its text.
export const facesIn = (css: string, base: string): DeclaredFace[] =>
  [...css.matchAll(/@font-face\s*\{([^}]*)\}/gi)].map((match) => {
    const body = match[1]
    const value = (name: string) =>
      new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`, 'i')
        .exec(body)?.[1]
        ?.trim() || ''
    const sources = [
      ...value('src').matchAll(
        /url\(\s*(?:"([^"]+)"|'([^']+)'|([^)\s]+))\s*\)\s*(?:format\(\s*["']?([^"')]+)["']?\s*\))?/gi
      )
    ]
      .map((source) => {
        try {
          return {
            url: new URL(source[1] || source[2] || source[3], base).href,
            format: source[4] || ''
          }
        } catch {
          return null
        }
      })
      .filter((source): source is { url: string; format: string } =>
        Boolean(source)
      )
    const range = value('unicode-range')
    return {
      family: value('font-family').replace(/["']/g, ''),
      weight: value('font-weight') || '400',
      style: value('font-style') || 'normal',
      sources,
      ...(range ? { range } : {})
    }
  })

// A face's Latin subset first: Google Fonts and Next.js split a face into
// several files by script, and the brand's text is set in the Latin one.
const latinFirst = (face: DeclaredFace) =>
  !face.range || /U\+0+-0*FF\b|U\+0000-00FF/i.test(face.range) ? 0 : 1

const keepFaces = async (
  read: PageRead,
  roles: SiteBrand['fonts'],
  captured: Map<string, Buffer>
) => {
  const wanted = new Set(
    [roles.display, roles.body, roles.mono]
      .map((family) => openFamily(family))
      .filter((family): family is string => Boolean(family))
  )
  if (!wanted.size) return []
  const faces: DeclaredFace[] = [...read.fonts.faces]
  for (const href of read.fonts.blocked.slice(0, 6)) {
    if (!publicUrl(href)) continue
    try {
      const css = await fetchText(href, 400 * 1024, 8_000, 'text/css,*/*;q=0.5')
      faces.push(...facesIn(css.text, href))
    } catch {
      /* a stylesheet that won't load declares nothing we can keep */
    }
  }
  faces.sort((a, b) => latinFirst(a) - latinFirst(b))
  const kept: BrandFontFile[] = []
  const seen = new Set<string>()
  // One variable file declared once per weight is fetched and stored once.
  const stored = new Map<string, Pick<BrandFontFile, 'objectKey' | 'format'>>()
  for (const face of faces) {
    const family = openFamily(face.family)
    if (!family || !wanted.has(family) || kept.length >= 10) continue
    const style = /italic|oblique/i.test(face.style) ? 'italic' : 'normal'
    const weight = faceWeight(face.weight)
    const key = `${family}|${String(weight)}|${style}`
    if (seen.has(key)) continue
    const source =
      face.sources.find((entry) => /woff2/i.test(entry.format + entry.url)) ||
      face.sources.find((entry) => !/eot|svg/i.test(entry.format + entry.url))
    if (!source) continue
    let file = stored.get(source.url)
    if (!file) {
      const body =
        captured.get(source.url) ||
        (await fetchBinary(source.url, 1_500_000, 10_000, /^/))?.buffer
      const format = body ? fontFormat(body) : null
      if (!body || !format) continue
      const asset = await storeAsset({
        body,
        contentType: `font/${EXTENSIONS[format].slice(1)}`,
        kind: 'brand-font',
        extension: EXTENSIONS[format]
      })
      file = { objectKey: asset.objectKey, format }
      stored.set(source.url, file)
    }
    kept.push({ family, weight, style, ...file })
    seen.add(key)
  }
  // A face declared where the page can't show us (another origin's sheet,
  // or a script): the file it loaded, known by its name.
  const plain = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '')
  const longest = [...wanted].sort((a, b) => b.length - a.length)
  for (const family of wanted) {
    if (kept.some((file) => file.family === family)) continue
    const loaded = read.fonts.loaded.find(
      (face) =>
        openFamily(face.family) === family && !/italic/i.test(face.style)
    )
    for (const [url, body] of captured) {
      const name = plain(
        decodeURIComponent(new URL(url).pathname.split('/').pop() || '')
      )
      const owner = longest.find((other) => name.includes(plain(other)))
      const format = fontFormat(body)
      if (owner !== family || /italic/.test(name) || !format) continue
      const stored = await storeAsset({
        body,
        contentType: `font/${EXTENSIONS[format].slice(1)}`,
        kind: 'brand-font',
        extension: EXTENSIONS[format]
      })
      kept.push({
        family,
        weight: faceWeight(loaded?.weight || '400'),
        style: 'normal',
        objectKey: stored.objectKey,
        format
      })
      break
    }
  }
  return kept
}

/** A safe SVG as a transparent PNG, drawn by the browser at twice its size. */
const rasterize = async (browser: Browser, svg: string, height = 160) => {
  const page = await browser.newPage()
  try {
    await page.setViewport({ width: 1600, height: 400, deviceScaleFactor: 2 })
    await page.setContent(
      `<!doctype html><html><head><style>html,body{margin:0;background:transparent}img{display:block;height:${height}px;width:auto;max-width:1500px}</style></head><body><img id="l" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"></body></html>`,
      { waitUntil: 'load', timeout: 10_000 }
    )
    const image = await page.$('#l')
    const box = await image?.boundingBox()
    if (!image || !box || box.width < 4) return null
    return Buffer.from(await image.screenshot({ omitBackground: true }))
  } catch {
    return null
  } finally {
    await page.close()
  }
}

/** A logo element as the page paints it, everything else hidden. */
const isolate = async (page: Page, index: number) => {
  const mark = `[data-brand-logo="${index}"]`
  const css = `html,body{background:transparent!important}body *:not(${mark}):not(${mark} *){visibility:hidden!important;background:transparent!important;box-shadow:none!important}${mark},${mark} *{visibility:visible!important}`
  try {
    await page.evaluate(
      `(() => { const style = document.createElement('style'); style.id = 'brand-isolate'; style.textContent = ${JSON.stringify(css)}; document.head.appendChild(style); })()`
    )
    const element = await page.$(mark)
    if (!element) return null
    return Buffer.from(await element.screenshot({ omitBackground: true }))
  } catch {
    return null
  } finally {
    await page
      .evaluate(
        "document.getElementById('brand-isolate') && document.getElementById('brand-isolate').remove()"
      )
      .catch(() => undefined)
  }
}

/** How much of a picture shows against a ground: the share of its pixels
 * opaque and unlike the ground's colour (a white logo on white shows none). */
const visibleShare = async (browser: Browser, png: Buffer, ground: string) => {
  const page = await browser.newPage()
  try {
    await page.setContent(
      `<img id="p" src="data:image/png;base64,${png.toString('base64')}">`,
      { waitUntil: 'load', timeout: 10_000 }
    )
    const rgb = [1, 3, 5].map((at) => parseInt(ground.slice(at, at + 2), 16))
    return Number(
      await page.evaluate(
        [
          `(() => { const img = document.getElementById('p'); if (!img.naturalWidth) return 0;`,
          `const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;`,
          `const context = canvas.getContext('2d'); context.drawImage(img, 0, 0);`,
          `const data = context.getImageData(0, 0, canvas.width, canvas.height).data; let shown = 0;`,
          `for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 40 && Math.abs(data[i] - ${rgb[0]}) + Math.abs(data[i + 1] - ${rgb[1]}) + Math.abs(data[i + 2] - ${rgb[2]}) > 90) shown++;`,
          `return shown / (data.length / 4); })()`
        ].join(' ')
      )
    )
  } catch {
    return 0
  } finally {
    await page.close()
  }
}

const pngSize = (png: Buffer) =>
  png.subarray(1, 4).toString('latin1') === 'PNG'
    ? { width: png.readUInt32BE(16), height: png.readUInt32BE(20) }
    : null

const keepLogo = async (
  browser: Browser,
  page: Page,
  read: PageRead,
  roles: BrandRoles | null,
  from: string
): Promise<SiteLogo | undefined> => {
  for (const candidate of read.logos) {
    let svg = candidate.markup ? sanitizeSvg(candidate.markup) : null
    if (!svg && candidate.src && /\.svg(\?|#|$)/i.test(candidate.src)) {
      const file = await fetchBinary(candidate.src, 400_000)
      const text = file?.buffer.toString('utf8') || ''
      // Paint given by a stylesheet or classes doesn't survive on its own.
      if (text && !/<style|\sclass=/i.test(text)) svg = sanitizeSvg(text)
    }
    if (svg && roles) svg = readableOn(svg, roles.ground, roles.text)
    const png = svg
      ? await rasterize(browser, svg)
      : await isolate(page, candidate.index)
    if (!png || png.length < 200) continue
    // A logo drawn for another ground (white for a dark header) is no logo
    // on this one: the next candidate is tried.
    if (roles && (await visibleShare(browser, png, roles.ground)) < 0.02)
      continue
    const stored = await storeAsset({
      body: png,
      contentType: 'image/png',
      kind: 'brand-logo',
      extension: '.png'
    })
    const vector = svg
      ? await storeAsset({
          body: Buffer.from(svg),
          contentType: 'image/svg+xml',
          kind: 'brand-logo',
          extension: '.svg'
        })
      : null
    return {
      pngKey: stored.objectKey,
      ...(vector ? { svgKey: vector.objectKey } : {}),
      width: candidate.width,
      height: candidate.height,
      label: candidate.label,
      from
    }
  }
  return undefined
}

const keepSymbol = async (
  browser: Browser,
  read: PageRead,
  from: string
): Promise<SiteLogo | undefined> => {
  for (const icon of rankIcons(read.icons).slice(0, 5)) {
    if (/\.ico(\?|$)/i.test(icon.href) || /mask-icon/i.test(icon.rel)) continue
    const file = await fetchBinary(icon.href, 600_000)
    if (!file) continue
    const svg = /svg/.test(file.contentType)
      ? sanitizeSvg(file.buffer.toString('utf8'))
      : null
    const png = svg
      ? await rasterize(browser, svg, 256)
      : /png/.test(file.contentType)
        ? file.buffer
        : null
    const size = png ? pngSize(png) : null
    if (!png || !size || Math.min(size.width, size.height) < 96) continue
    const stored = await storeAsset({
      body: png,
      contentType: 'image/png',
      kind: 'brand-logo',
      extension: '.png'
    })
    return {
      pngKey: stored.objectKey,
      width: size.width,
      height: size.height,
      label: 'icon',
      from
    }
  }
  return undefined
}

/**
 * Reads a site's brand. Null when no browser could render the page; the
 * caller falls back to what the page's stylesheets say.
 */
export const readSiteBrand = async (url: string): Promise<SiteBrand | null> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 45_000)
  try {
    return await withFetchBudget(controller.signal, () =>
      readBrand(url, controller.signal)
    )
  } finally {
    clearTimeout(timer)
  }
}
const readBrand = async (
  url: string,
  signal: AbortSignal
): Promise<SiteBrand | null> => {
  let browser: Browser
  try {
    await assertPublicHost(url)
    const { default: puppeteer } = await import('puppeteer')
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox'],
      handleSIGINT: false,
      handleSIGTERM: false,
      handleSIGHUP: false
    })
  } catch {
    return null
  }
  const stop = () => {
    void browser.close().catch(() => {})
  }
  signal.addEventListener('abort', stop, { once: true })
  try {
    signal.throwIfAborted()
    const page = await browser.newPage()
    // What interception can't see stays out: a service worker's own fetches
    // and WebSockets, which a brand read never needs (review 7).
    await page.setBypassServiceWorker(true)
    const session = await page.createCDPSession()
    await session.send('Network.enable')
    await session.send('Network.setBlockedURLs', {
      urls: ['ws://*', 'wss://*']
    })
    await page.setRequestInterception(true)
    page.on('request', (request) => {
      if (/^(data|blob):/.test(request.url())) {
        void request.continue().catch(() => {})
        return
      }
      void assertPublicHost(request.url())
        .then(
          () => request.continue(),
          () => request.abort()
        )
        .catch(() => {})
    })
    await page.setUserAgent(UA)
    // A wide desktop window in light mode, as a brand's site is usually
    // seen (the computer's own dark mode would otherwise reach the page).
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 })
    await page.emulateMediaFeatures([
      { name: 'prefers-color-scheme', value: 'light' }
    ])
    const captured = new Map<string, Buffer>()
    page.on('response', (response) => {
      if (response.request().resourceType() !== 'font' || captured.size >= 24)
        return
      if (Number(response.headers()['content-length']) > 2_000_000) return
      response
        .buffer()
        .then((body) => {
          if (body.length <= 2_000_000) captured.set(response.url(), body)
        })
        .catch(() => undefined)
    })
    const loaded = await page
      .goto(url, { waitUntil: 'networkidle2', timeout: 25_000 })
      .catch(() => null)
    if (!loaded && page.url() === 'about:blank') return null
    await wait(800)
    await page
      .evaluate(
        'window.scrollTo(0, Math.min(document.body.scrollHeight, innerHeight * 4))'
      )
      .catch(() => undefined)
    await wait(500)
    await page.evaluate('window.scrollTo(0, 0)').catch(() => undefined)
    await page
      .evaluate('document.fonts ? document.fonts.ready.then(() => true) : true')
      .catch(() => undefined)
    await wait(300)
    const read = (await page.evaluate(BRAND_PAGE_SCRIPT)) as PageRead
    // The page's own words: only plain #RRGGBB colours go on (review 7).
    read.palette = Array.isArray(read.palette)
      ? read.palette
          .filter(
            (colour) =>
              typeof colour === 'string' && /^#[0-9a-f]{6}$/i.test(colour)
          )
          .slice(0, 24)
      : []
    const from = new URL(page.url() || url).hostname.replace(/^www\./, '')
    const roles = brandRoles(read.stats, read.palette)
    const fonts = fontRoles(read.fonts)
    const fontFiles = await keepFaces(read, fonts, captured)
    const logo = await keepLogo(browser, page, read, roles, from)
    const symbol = await keepSymbol(browser, read, from)
    return {
      roles,
      palette: read.palette,
      fonts,
      fontFiles,
      ...(logo ? { logo } : {}),
      ...(symbol ? { symbol } : {}),
      themeColor: read.meta.themeColor
    }
  } catch {
    return null
  } finally {
    signal.removeEventListener('abort', stop)
    await browser.close().catch(() => undefined)
  }
}
