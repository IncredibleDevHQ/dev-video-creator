// Source transport and browser observation.
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36 IncredibleStudio/2'
export const assertPublicUrl = (raw: string) => {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    throw new Error('That is not a link the studio can open')
  }
  if (!/^https?:$/.test(url.protocol))
    throw new Error('Only http and https links can be read')
  const host = url.hostname.toLowerCase()
  // The private-network guard stands in normal launches; scripted checks run
  // a fixture brand site on loopback under the test-hooks flag (the same flag
  // that already exposes /__eval — never set in a normal launch).
  if (
    process.env.STUDIO_ENABLE_TEST_HOOKS !== '1' &&
    (host === 'localhost' ||
      host.endsWith('.local') ||
      /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(
        host
      ) ||
      host === '::1' ||
      host === '[::1]')
  ) {
    throw new Error('Links to this machine or a private network cannot be read')
  }
  return url
}

export class SourceReadError extends Error {
  constructor(
    readonly status: number,
    readonly hostname: string
  ) {
    super(
      [401, 403, 429].includes(status)
        ? 'This site does not allow automatic reading. Paste the article text to continue.'
        : `Could not read this article (${status}). Check the link or paste the article text.`
    )
    this.name = 'SourceReadError'
  }
}
export const fetchText = async (
  url: string,
  maximumBytes: number,
  timeoutMs = 15_000,
  accept = 'text/html,text/css,*/*;q=0.8'
) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      headers: { 'user-agent': UA, accept },
      redirect: 'follow',
      signal: controller.signal
    })
    if (!response.ok)
      throw new SourceReadError(response.status, new URL(url).hostname)
    const buffer = Buffer.from(await response.arrayBuffer())
    return {
      text: buffer.subarray(0, maximumBytes).toString('utf8'),
      contentType: response.headers.get('content-type') || '',
      finalUrl: response.url || url
    }
  } finally {
    clearTimeout(timer)
  }
}

export const fetchBinary = async (
  url: string,
  maximumBytes: number,
  timeoutMs = 10_000
) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      headers: { 'user-agent': UA, accept: 'image/*,*/*;q=0.5' },
      redirect: 'follow',
      signal: controller.signal
    })
    if (!response.ok) return null
    const contentType = response.headers.get('content-type') || ''
    if (!/^image\//.test(contentType)) return null
    const buffer = Buffer.from(await response.arrayBuffer())
    if (!buffer.length || buffer.length > maximumBytes) return null
    return { buffer, contentType }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// ——— the rendered read: what the page actually paints ———
// Computed styles weighted by area for grounds and by text length for ink,
// so CSS-in-JS and images-as-backgrounds do not hide the brand.

type Rendered = {
  backgrounds: Array<[string, number]>
  inks: Array<[string, number]>
  fonts: Array<[string, number]>
  headingFont: string
  bodyFont: string
}

export const renderedRead = async (url: string): Promise<Rendered | null> => {
  try {
    const { default: puppeteer } = await import('puppeteer')
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox'],
      handleSIGINT: false,
      handleSIGTERM: false,
      handleSIGHUP: false
    })
    try {
      const page = await browser.newPage()
      await page.setUserAgent(UA)
      await page.setViewport({ width: 1280, height: 900 })
      await page
        .goto(url, { waitUntil: 'networkidle2', timeout: 20_000 })
        .catch(() => undefined)
      await new Promise((resolve) => setTimeout(resolve, 800))
      return await page.evaluate(() => {
        const backgrounds = new Map<string, number>()
        const inks = new Map<string, number>()
        const fonts = new Map<string, number>()
        const bump = (map: Map<string, number>, key: string, weight: number) =>
          map.set(key, (map.get(key) || 0) + weight)
        const elements = Array.from(
          document.querySelectorAll('body, body *')
        ).slice(0, 5000)
        const limitY = window.innerHeight * 3
        elements.forEach((element) => {
          const rect = element.getBoundingClientRect()
          if (
            rect.width < 2 ||
            rect.height < 2 ||
            rect.top > limitY ||
            rect.bottom < 0
          )
            return
          const style = getComputedStyle(element)
          if (
            style.visibility === 'hidden' ||
            style.display === 'none' ||
            Number(style.opacity) === 0
          )
            return
          const area =
            Math.min(rect.width, window.innerWidth) *
            Math.min(rect.height, limitY)
          const background = style.backgroundColor
          if (
            background &&
            !/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\)/.test(background) &&
            background !== 'transparent'
          )
            bump(backgrounds, background, area)
          const textLength = Array.from(element.childNodes)
            .filter((node) => node.nodeType === 3)
            .reduce(
              (sum, node) => sum + (node.textContent || '').trim().length,
              0
            )
          if (textLength) {
            bump(
              inks,
              style.color,
              textLength * parseFloat(style.fontSize || '16')
            )
            const family = (style.fontFamily || '')
              .split(',')[0]
              .replace(/["']/g, '')
              .trim()
            if (family) bump(fonts, family, textLength)
          }
          if (
            parseFloat(style.borderTopWidth || '0') > 0 &&
            style.borderTopColor
          )
            bump(inks, style.borderTopColor, rect.width * 0.4)
        })
        const family = (selector: string) => {
          const element = document.querySelector(selector)
          return element
            ? (getComputedStyle(element).fontFamily || '')
                .split(',')[0]
                .replace(/["']/g, '')
                .trim()
            : ''
        }
        const sorted = (map: Map<string, number>) =>
          [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40)
        return {
          backgrounds: sorted(backgrounds),
          inks: sorted(inks),
          fonts: sorted(fonts),
          headingFont: family('h1') || family('h2'),
          bodyFont: family('p') || family('body')
        }
      })
    } finally {
      await browser.close()
    }
  } catch {
    return null
  }
}

export const absolute = (href: string | null | undefined, base: string) => {
  if (!href) return ''
  try {
    return new URL(href, base).toString()
  } catch {
    return ''
  }
}
