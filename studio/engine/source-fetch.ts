// Source transport and browser observation.
import { Refusal } from './refusal'
export const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36 IncredibleStudio/2'
export const assertPublicUrl = (raw: string) => {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    throw new Refusal('That is not a link the studio can open')
  }
  if (!/^https?:$/.test(url.protocol))
    throw new Refusal('Only http and https links can be read')
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
    throw new Refusal(
      'Links to this machine or a private network cannot be read'
    )
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

/** A public address the engine may fetch itself; null for a private one. */
export const publicUrl = (raw: string) => {
  try {
    return assertPublicUrl(raw).toString()
  } catch {
    return null
  }
}

export const fetchBinary = async (
  url: string,
  maximumBytes: number,
  timeoutMs = 10_000,
  types = /^image\//
) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    if (!publicUrl(url)) return null
    const response = await fetch(url, {
      headers: { 'user-agent': UA, accept: 'image/*,font/*,*/*;q=0.5' },
      redirect: 'follow',
      signal: controller.signal
    })
    if (!response.ok) return null
    const contentType = response.headers.get('content-type') || ''
    if (!types.test(contentType)) return null
    const buffer = Buffer.from(await response.arrayBuffer())
    if (!buffer.length || buffer.length > maximumBytes) return null
    return { buffer, contentType }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
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
