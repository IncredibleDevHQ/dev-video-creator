import { createServer, type Server } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, expect, it } from 'vitest'
// The fixture site runs on loopback, which the reader's own fetches refuse
// outside checks.
process.env.STUDIO_ENABLE_TEST_HOOKS = '1'
const { readSiteBrand, facesIn, faceWeight, fontFormat } =
  await import('./site-brand')
const { readAsset } = await import('./persistence')
const { fontFaces, uniqueFaces } = await import('../app/brand-fonts')

const inter = await readFile(
  fileURLToPath(new URL('../app/assets/inter.woff2', import.meta.url))
)
const icon =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><circle cx="128" cy="128" r="120" fill="#533afd"/></svg>'

// A product page with a brand of its own: white blocks, navy text, a purple
// on buttons and links, a logo in its header home link painted by CSS, a
// menu icon, and a wall of customer logos further down.
const page = `<!doctype html><html><head><title>Fixture | Payments for builders</title>
<meta property="og:site_name" content="Fixture">
<link rel="icon" href="/favicon.ico">
<link rel="icon" type="image/svg+xml" href="/icon.svg">
<style>
@font-face{font-family:"Inter";src:url("/fonts/inter.woff2") format("woff2");font-weight:100 900;font-style:normal}
@font-face{font-family:"Inter";src:url("/fonts/inter.woff2") format("woff2");font-weight:700;font-style:normal}
@font-face{font-family:"Fixture Grotesk";src:url("/fonts/grotesk.woff2") format("woff2");font-weight:700}
body{margin:0;background:#ffffff;color:#0a2540;font-family:"Inter",sans-serif}
header{display:flex;justify-content:space-between;align-items:center;padding:20px 40px}
.brand path{fill:#533afd}
h1{font-family:"Fixture Grotesk","Inter",sans-serif;font-size:64px}
.hero{min-height:640px;padding:80px 40px}
.btn{background:#533afd;color:#ffffff;padding:12px 20px;border-radius:999px;display:inline-block}
a{color:#533afd}
code{font-family:"JetBrains Mono",monospace}
.customers{display:flex;gap:40px;padding:40px}
.customers path{fill:#888888}
</style></head><body>
<header><a href="/" aria-label="Fixture home" class="brand"><svg viewBox="0 0 120 30" width="120" height="30"><path d="M0 0h30v30H0z"/><path d="M40 5h70v20H40z"/></svg></a>
<nav><a href="/pricing">Pricing</a> <button class="menu" aria-label="Open menu"><svg width="24" height="24" viewBox="0 0 24 24"><path d="M0 0h24v4H0z"/></svg></button></nav></header>
<section class="hero"><h1>Payments for builders</h1>
<p>Accept payments online and in person, and grow your revenue with one platform.</p>
<a class="btn" href="/start">Start now</a> <a class="btn" href="/sales">Contact sales</a> <a href="/docs">Read the docs</a>
<p>Install it: <code>npm install fixture</code></p></section>
<section class="customers"><svg aria-label="Acme logo" width="100" height="30" viewBox="0 0 100 30"><path d="M0 0h100v30H0z"/></svg><svg aria-label="Globex logo" width="100" height="30" viewBox="0 0 100 30"><path d="M0 0h100v30H0z"/></svg></section>
</body></html>`

let server: Server
let origin = ''
beforeAll(async () => {
  server = createServer((request, response) => {
    const path = (request.url || '/').split('?')[0]
    const send = (type: string, body: string | Buffer) => {
      response.writeHead(200, { 'content-type': type })
      response.end(body)
    }
    if (path === '/') return send('text/html; charset=utf-8', page)
    if (path.startsWith('/fonts/')) return send('font/woff2', inter)
    if (path === '/icon.svg') return send('image/svg+xml', icon)
    response.writeHead(404)
    response.end()
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  const address = server.address()
  origin = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`
})
afterAll(() => new Promise<void>((done) => server.close(() => done())))

it('reads a site’s brand in the product: roles, faces, its own logo and icon', async () => {
  const brand = await readSiteBrand(`${origin}/`)
  expect(brand).not.toBeNull()
  expect(brand!.roles).toMatchObject({
    ground: '#FFFFFF',
    text: '#0A2540',
    accent: '#533AFD'
  })
  expect(brand!.fonts).toMatchObject({
    display: 'Fixture Grotesk',
    body: 'Inter',
    mono: 'JetBrains Mono'
  })
  // Only the open face travels as a file; the foundry face shows elsewise.
  expect(
    brand!.fontFiles.map((file) => [file.family, file.weight, file.format])
  ).toEqual([
    ['Inter', [100, 900], 'woff2'],
    ['Inter', 700, 'woff2']
  ])
  expect(fontFormat(await readAsset(brand!.fontFiles[0].objectKey))).toBe(
    'woff2'
  )
  // A file declared for two weights is stored once, and the page loads it
  // for each of them.
  expect(brand!.fontFiles[1].objectKey).toBe(brand!.fontFiles[0].objectKey)
  const faces = uniqueFaces([...brand!.fontFiles, ...brand!.fontFiles])
  expect(faces).toHaveLength(2)
  expect(fontFaces(faces).match(/font-weight:[^;]+/g)).toEqual([
    'font-weight:100 900',
    'font-weight:700'
  ])
  // The header's home-link logo, not a customer's, with its CSS paint kept.
  expect(brand!.logo).toMatchObject({
    label: expect.stringMatching(/fixture home/)
  })
  const svg = (await readAsset(brand!.logo!.svgKey!)).toString('utf8')
  expect(svg).toContain('fill="#533AFD"')
  expect(svg).not.toMatch(/class=|<style/)
  const png = await readAsset(brand!.logo!.pngKey)
  expect(png.subarray(1, 4).toString('latin1')).toBe('PNG')
  // Its square icon, drawn from the SVG the page declares.
  expect(brand!.symbol).toMatchObject({ label: 'icon' })
  expect(brand!.symbol!.width).toBeGreaterThanOrEqual(96)
}, 60_000)

it('reads @font-face rules a page could not show, with their weights', () => {
  const faces = facesIn(
    `@font-face{font-family:'Manrope';font-style:normal;font-weight:200 800;src:url(./manrope-latin.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131}`,
    'https://fonts.example/css/site.css'
  )
  expect(faces).toEqual([
    {
      family: 'Manrope',
      weight: '200 800',
      style: 'normal',
      sources: [
        {
          url: 'https://fonts.example/css/manrope-latin.woff2',
          format: 'woff2'
        }
      ],
      range: 'U+0000-00FF,U+0131'
    }
  ])
  expect(faceWeight('200 800')).toEqual([200, 800])
  expect(faceWeight('bold')).toBe(700)
  expect(faceWeight('')).toBe(400)
  expect(fontFormat(Buffer.from('not a font'))).toBeNull()
})
