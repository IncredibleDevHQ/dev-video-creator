// Source transport and browser observation.
import { BlockList, isIP } from 'node:net'
import { lookup } from 'node:dns/promises'
import { AsyncLocalStorage } from 'node:async_hooks'
import { Refusal } from './refusal'
export const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36 IncredibleStudio/2'
const privateAddresses = new BlockList()
for (const [address, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4]
] as const)
  privateAddresses.addSubnet(address, prefix, 'ipv4')
for (const [address, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8]
] as const)
  privateAddresses.addSubnet(address, prefix, 'ipv6')
/** An IPv6 address as its eight 16-bit words, or null. */
const ipv6Words = (host: string) => {
  let text = host
  const tail = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(text)
  if (tail) {
    const [a, b, c, d] = tail.slice(1).map(Number)
    text = `${text.slice(0, tail.index)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`
  }
  const [head, rest, extra] = text.split('::')
  if (extra !== undefined) return null
  const left = head ? head.split(':') : []
  const right = rest ? rest.split(':') : []
  const fill = rest === undefined ? 0 : 8 - left.length - right.length
  const words = [...left, ...Array(Math.max(0, fill)).fill('0'), ...right]
  const values = words.map((word) => parseInt(word, 16))
  return values.length === 8 &&
    values.every((value) => value >= 0 && value <= 0xffff)
    ? values
    : null
}

/** The IPv4 address an IPv6 one carries: mapped or compatible
 * (::ffff:a.b.c.d, ::a.b.c.d), NAT64 (64:ff9b::a.b.c.d) or 6to4
 * (2002:aabb:ccdd::). */
const carriedIPv4 = (host: string) => {
  const words = ipv6Words(host)
  if (!words) return null
  const v4 = (high: number, low: number) =>
    `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`
  const zero = (from: number, to: number) =>
    words.slice(from, to).every((word) => word === 0)
  if (zero(0, 5) && (words[5] === 0xffff || words[5] === 0))
    return v4(words[6], words[7])
  if (words[0] === 0x64 && words[1] === 0xff9b && zero(2, 6))
    return v4(words[6], words[7])
  if (words[0] === 0x2002) return v4(words[1], words[2])
  return null
}

// An IPv6 address that carries a private IPv4 one is private too (review 7).
const blocked = (host: string) => {
  if (isIP(host) !== 6) return privateAddresses.check(host, 'ipv4')
  const carried = carriedIPv4(host)
  return (
    (carried !== null && privateAddresses.check(carried, 'ipv4')) ||
    privateAddresses.check(host, 'ipv6')
  )
}
const refusal = () =>
  new Refusal('Links to this machine or a private network cannot be read')
export const assertPublicUrl = (raw: string) => {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    throw new Refusal('That is not a link the studio can open')
  }
  if (!/^https?:$/.test(url.protocol))
    throw new Refusal('Only http and https links can be read')
  const host = url.hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '')
  if (
    process.env.STUDIO_ENABLE_TEST_HOOKS !== '1' &&
    (host === 'localhost' ||
      host.endsWith('.localhost') ||
      host.endsWith('.local') ||
      (isIP(host) && blocked(host)))
  )
    throw refusal()
  return url
}

/**
 * Names as well as literal addresses, at every hop: a public name that
 * resolves to this machine or a private network is refused (review 7). A
 * name that doesn't resolve can't be fetched either, so it passes here and
 * fails as the fetch's own error. Unit checks never reach the network, DNS
 * included: their setup turns the lookup off.
 */
export const assertPublicHost = async (
  raw: string,
  resolve = (host: string) => lookup(host, { all: true })
) => {
  const url = assertPublicUrl(raw)
  if (
    process.env.STUDIO_ENABLE_TEST_HOOKS === '1' ||
    process.env.MINIMAL_STUDIO_RESOLVE_HOSTS === '0'
  )
    return url
  const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '')
  const addresses = isIP(host)
    ? [{ address: host }]
    : await resolve(host).catch(() => [])
  if (addresses.some(({ address }) => blocked(address))) throw refusal()
  return url
}
const budget = new AsyncLocalStorage<AbortSignal>()
export const withFetchBudget = <T>(
  signal: AbortSignal,
  run: () => Promise<T>
) => budget.run(signal, run)
const signalFor = (signal: AbortSignal) =>
  budget.getStore() ? AbortSignal.any([signal, budget.getStore()!]) : signal

const fetchPublic = async (raw: string, init: RequestInit) => {
  let url = raw
  for (let hop = 0; hop < 6; hop++) {
    init.signal?.throwIfAborted()
    await assertPublicHost(url)
    const response = await fetch(url, { ...init, redirect: 'manual' })
    if (![301, 302, 303, 307, 308].includes(response.status)) return response
    const location = response.headers.get('location')
    await response.body?.cancel()
    if (!location) throw new Error('Redirect has no destination')
    url = new URL(location, url).toString()
  }
  throw new Error('Too many redirects')
}

/** Stop reading as soon as the cap is reached, including chunked bodies. */
const boundedBody = async (
  response: Response,
  maximum: number,
  truncate = false
) => {
  if (!truncate && Number(response.headers.get('content-length')) > maximum) {
    await response.body?.cancel()
    throw new Error('The download is too large')
  }
  const reader = response.body?.getReader()
  if (!reader) return Buffer.alloc(0)
  const chunks: Buffer[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (size + value.length > maximum) {
        if (!truncate) throw new Error('The download is too large')
        chunks.push(Buffer.from(value.subarray(0, maximum - size)))
        break
      }
      chunks.push(Buffer.from(value))
      size += value.length
      if (size === maximum && truncate) break
    }
    return Buffer.concat(chunks)
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
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
    const response = await fetchPublic(url, {
      headers: { 'user-agent': UA, accept },
      signal: signalFor(controller.signal)
    })
    if (!response.ok)
      throw new SourceReadError(response.status, new URL(url).hostname)
    const buffer = await boundedBody(response, maximumBytes, true)
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
    const response = await fetchPublic(url, {
      headers: { 'user-agent': UA, accept: 'image/*,font/*,*/*;q=0.5' },
      signal: signalFor(controller.signal)
    })
    if (!response.ok) return null
    const contentType = response.headers.get('content-type') || ''
    if (!types.test(contentType)) return null
    const buffer = await boundedBody(response, maximumBytes)
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
