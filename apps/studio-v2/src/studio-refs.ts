// The studio's own files — objects in its store, its assets, its renders
// and previews — are named by their path on the app's own origin, never by
// the address the app had when they were made. The desktop's worker takes a
// new port at every start, so an address written with one
// (http://127.0.0.1:58827/objects/…) is dead after a restart while the same
// path on the app's origin serves the same bytes (F01, F05 of the fix
// verification). One reading of a reference serves the renderer, the
// download and the notebook alike.
import type { ProjectDocumentV1, TiptapNode } from 'markdown-composition'

export type StudioRoot = 'objects' | 'assets' | 'outputs' | 'previews'
// What a reference names: the store's own object key, or a file's name
// under one of the worker's folders — decoded, never a path out of it.
export type StudioRef = { root: StudioRoot; path: string }

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])
const STUDIO_PATH = /^\/(objects|assets|outputs|previews)\/([^?#]+)/

/** What a value names in the studio's own files — root-relative, or an
 * absolute address on a loopback host whatever its port — or null for
 * anything else (a remote URL, a data: or blob: URL, a path elsewhere). */
export const studioRefOf = (value: unknown): StudioRef | null => {
  if (typeof value !== 'string' || !value) return null
  let pathname = ''
  if (value.startsWith('/')) {
    if (value.startsWith('//')) return null
    pathname = value
  } else {
    let url: URL
    try {
      url = new URL(value)
    } catch {
      return null
    }
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !LOCAL_HOSTS.has(url.hostname)) return null
    pathname = url.pathname
  }
  const match = STUDIO_PATH.exec(pathname)
  if (!match) return null
  let path = ''
  try {
    path = decodeURIComponent(match[2])
  } catch {
    return null
  }
  if (path.split('/').some(part => !part || part === '.' || part === '..')) return null
  return { root: match[1] as StudioRoot, path }
}

/** The same reference on whatever origin the app has now: the path, as it
 * was written. Anything that is not the studio's own comes back unchanged. */
export const portableUrl = (value: string) => {
  if (value.startsWith('/') || !studioRefOf(value)) return value
  const url = new URL(value)
  return `${url.pathname}${url.search}${url.hash}`
}

/** The address of a stored object on the app's own origin. */
export const objectUrl = (objectKey: string) => `/objects/${objectKey}`

// Every address markup names — href, xlink:href and src attributes, and
// CSS url() outside a fragment — rewritten through `map` (null keeps it).
const MARKUP_ATTRIBUTE_URL = /(\s(?:xlink:)?href|\ssrc)(\s*=\s*)(["'])([^"']*)\3/g
const MARKUP_CSS_URL = /url\(\s*(["']?)([^"')\s]+)\1\s*\)/g
export const mapMarkupUrls = (markup: string, map: (url: string) => string | null) =>
  markup
    .replace(MARKUP_ATTRIBUTE_URL, (whole, name: string, equals: string, quote: string, url: string) => {
      const next = url.startsWith('#') ? null : map(url)
      return next === null || next === url ? whole : `${name}${equals}${quote}${next}${quote}`
    })
    .replace(MARKUP_CSS_URL, (whole, quote: string, url: string) => {
      const next = url.startsWith('#') ? null : map(url)
      return next === null || next === url ? whole : `url(${quote}${next}${quote})`
    })

/** Every media address a notebook keeps, through `map`: its presenter
 * tracks, takes, produced scenes, theme logo, asset library, and each
 * block's source and page artwork. Words are never touched — a link or a
 * code sample that happens to name a local address is the author's.
 * Returns how many addresses changed. */
export const mapProjectMedia = (project: ProjectDocumentV1, map: (url: string) => string) => {
  let changed = 0
  const through = (value: string | undefined) => {
    if (typeof value !== 'string' || !value) return value
    const next = map(value)
    if (next !== value) changed += 1
    return next
  }
  Object.values(project.presenterTracks || {}).forEach(tracks => tracks.forEach(track => {
    if (track.kind === 'human-camera') track.videoUrl = through(track.videoUrl)!
    if (track.audioUrl) track.audioUrl = through(track.audioUrl)!
  }))
  const takes = [...Object.values(project.recordedBlocks || {}), ...Object.values(project.recordedBlockTakes || {}).flat()]
  takes.forEach(take => {
    take.videoUrl = through(take.videoUrl)!
    if (take.cameraUrl) take.cameraUrl = through(take.cameraUrl)
  })
  Object.values(project.producedScenes || {}).forEach(produced => {
    produced.videoUrl = through(produced.videoUrl)!
  })
  if (project.theme?.logo?.url) project.theme.logo.url = through(project.theme.logo.url)!
  if (project.source?.logoUrl) project.source.logoUrl = through(project.source.logoUrl)
  project.assets?.forEach(asset => {
    asset.url = through(asset.url)!
  })
  const visit = (node: TiptapNode) => {
    if (node.attrs && typeof node.attrs.src === 'string') node.attrs.src = through(node.attrs.src)
    if (node.attrs && typeof node.attrs.svg === 'string') {
      const svg = node.attrs.svg
      node.attrs.svg = mapMarkupUrls(svg, url => {
        const next = map(url)
        if (next !== url) changed += 1
        return next
      })
    }
    node.content?.forEach(visit)
  }
  project.notebook?.content?.forEach(visit)
  return changed
}

/** A notebook written while the app had another address names its media
 * by their paths again, so they play on this one. */
export const portableProjectMedia = (project: ProjectDocumentV1) => mapProjectMedia(project, portableUrl)
