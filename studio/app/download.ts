const active = new Set<string>()

let noticeTimer: ReturnType<typeof setTimeout> | undefined
/** One line saying what an action did, read out and gone after a while. */
export const notice = (text: string, finished = false) => {
  clearTimeout(noticeTimer)
  let status = document.getElementById('download-status')
  if (!status) {
    status = document.createElement('div')
    status.id = 'download-status'
    status.className = 'download-status'
    status.setAttribute('role', 'status')
    document.body.append(status)
  }
  status.textContent = text
  if (finished) noticeTimer = setTimeout(() => status?.remove(), 15_000)
}

const filename = (response: Response, fallback: string) => {
  const header = response.headers.get('content-disposition') || ''
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header)?.[1]
  if (encoded) {
    try {
      return decodeURIComponent(encoded)
    } catch {}
  }
  return /filename="([^"]+)"/.exec(header)?.[1] || fallback
}

/** One request per export; keep progress and failures inside the editor. */
const download = async (
  key: string,
  path: string,
  button: HTMLButtonElement,
  type: string,
  fallback: string
) => {
  if (active.has(key)) return
  active.add(key)
  const label = button.textContent
  button.disabled = true
  button.setAttribute('aria-busy', 'true')
  button.textContent =
    type === 'application/pdf' ? 'Preparing PDF…' : 'Downloading…'
  notice(button.textContent)
  try {
    const response = await fetch(path)
    if (!response.ok || !response.headers.get('content-type')?.includes(type)) {
      const result = await response.json().catch(() => null)
      throw new Error(
        result?.error || 'Could not download this file. Try again.'
      )
    }
    const url = URL.createObjectURL(await response.blob())
    const link = document.createElement('a')
    link.href = url
    const name = filename(response, fallback)
    link.download = name
    link.hidden = true
    document.body.append(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
    notice(`${name} is ready. Check your browser’s downloads.`, true)
  } catch (error) {
    notice('Download failed. Please try again.', true)
    throw error
  } finally {
    active.delete(key)
    button.disabled = false
    button.removeAttribute('aria-busy')
    button.textContent = label
  }
}

export const downloadPresentation = (
  projectId: string,
  button: HTMLButtonElement
) =>
  download(
    `${projectId}:pdf`,
    `/api/projects/${encodeURIComponent(projectId)}/export`,
    button,
    'application/pdf',
    'wireframes.pdf'
  )

export const downloadVideo = (
  projectId: string,
  button: HTMLButtonElement,
  sceneId?: string
) =>
  download(
    `${projectId}:${sceneId || 'video'}`,
    `/api/projects/${encodeURIComponent(projectId)}${sceneId ? `/scenes/${encodeURIComponent(sceneId)}` : ''}/download`,
    button,
    'video/mp4',
    sceneId ? 'scene.mp4' : 'video.mp4'
  )
