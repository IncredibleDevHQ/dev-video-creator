// A download never replaces the studio (F01 of the fix verification): the
// file is asked for on the app's own origin, whatever address the app had
// when it was made; it is checked before it is saved; and the desktop saves
// it through its own download, never by navigating the window to it.
import { portableUrl } from './studio-refs'

export type DownloadOutcome = { state: 'completed' | 'cancelled' | 'started'; path?: string }
type DesktopDownload = (url: string, filename: string) => Promise<{ state: 'completed' | 'cancelled' | 'interrupted'; path?: string }>

/** A file name the creator's system takes: no path separators or reserved
 * characters, and an extension. */
export const downloadName = (title: string, extension: string) => {
  const base = title.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Incredible Studio'
  return `${base}.${extension}`
}

export const downloadStudioFile = async (url: string, filename: string, origin = window.location.origin): Promise<DownloadOutcome> => {
  const address = new URL(portableUrl(url), origin)
  if (address.origin !== origin) throw new Error('Only the studio’s own files download here')
  const probe = await fetch(address.href, { method: 'HEAD', cache: 'no-store' }).catch(() => null)
  if (!probe) throw new Error('The studio did not answer — try again in a moment')
  if (probe.status === 404) throw new Error('The file is no longer in the studio’s store')
  if (!probe.ok) throw new Error(`The file could not be read (HTTP ${probe.status})`)
  const desktop = (window as Window & { studioDesktop?: { download?: DesktopDownload } }).studioDesktop?.download
  if (desktop) {
    const result = await desktop(address.href, filename)
    if (result.state === 'interrupted') throw new Error('The download was interrupted')
    return { state: result.state, ...(result.path ? { path: result.path } : {}) }
  }
  // The browser's own download of a same-origin file: never a navigation.
  const link = document.createElement('a')
  link.href = address.href
  link.download = filename
  link.rel = 'noopener'
  link.hidden = true
  document.body.append(link)
  link.click()
  link.remove()
  return { state: 'started' }
}
