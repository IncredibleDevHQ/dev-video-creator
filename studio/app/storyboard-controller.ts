// The storyboard page's actions: approve or change the plan, choose a
// scene's build, record or upload a scene's take, try again.
import type { Snapshot } from '../shared/api'
import type { AppContext } from './app-context'
import { api } from './api'
import { requestJson } from './http'
import { button, escape } from './ui'

const uploadTake = (projectId: string, pageId: string, blob: Blob) =>
  requestJson<Snapshot>(
    `/api/projects/${projectId}/storyboard/scenes/${pageId}/take`,
    {
      method: 'PUT',
      headers: { 'Content-Type': (blob.type || 'video/webm').split(';')[0] },
      body: blob
    }
  )

// The take being recorded: one at a time.
let recording: {
  pageId: string
  stream: MediaStream
  recorder: MediaRecorder | null
  chunks: Blob[]
  blob: Blob | null
} | null = null

const stopStream = () => {
  recording?.stream.getTracks().forEach((track) => track.stop())
  recording = null
}

const sceneLines = (snapshot: Snapshot, pageId: string) =>
  snapshot.project.video?.storyboard?.plan?.scenes
    .find((scene) => scene.pageId === pageId)
    ?.frames.map((frame) => frame.voiceover)
    .filter(Boolean) || []

const recorderDialog = (
  snapshot: Snapshot,
  pageId: string,
  state: 'ready' | 'recording' | 'review'
) => {
  const page = snapshot.project.slides.find((slide) => slide.id === pageId)
  return `<h2>Record: ${escape(page?.title || 'this scene')}</h2>
<div class="sb-recorder">
<video data-sb-preview autoplay muted playsinline></video>
<ol class="sb-prompter">${sceneLines(snapshot, pageId)
    .map((line) => `<li>${escape(line)}</li>`)
    .join('')}</ol>
</div>
<p class="sb-meta" role="status">${state === 'recording' ? 'Recording… read the lines in order, then stop.' : state === 'review' ? 'Keep this take, or record it again.' : 'Read the lines in order, at your own pace.'}</p>
<div class="dialog-actions">${
    state === 'recording'
      ? button('Stop', 'sb-rec-stop', true)
      : state === 'review'
        ? `${button('Record again', 'sb-rec-start')}${button('Keep this take', 'sb-rec-save', true)}`
        : button('Start recording', 'sb-rec-start', true)
  }${button('Cancel', 'sb-rec-cancel')}</div>`
}

const openRecorder = async (app: AppContext, pageId: string) => {
  stopStream()
  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  })
  recording = { pageId, stream, recorder: null, chunks: [], blob: null }
  app.showDialog(recorderDialog(app.snapshot!, pageId, 'ready'))
  const preview =
    app.dialog.querySelector<HTMLVideoElement>('[data-sb-preview]')
  if (preview) preview.srcObject = stream
  app.dialog.addEventListener('close', stopStream, { once: true })
}

const showState = (
  app: AppContext,
  state: 'ready' | 'recording' | 'review'
) => {
  if (!recording || !app.snapshot) return
  app.showDialog(recorderDialog(app.snapshot, recording.pageId, state))
  const preview =
    app.dialog.querySelector<HTMLVideoElement>('[data-sb-preview]')
  if (!preview) return
  if (state === 'review' && recording.blob) {
    preview.srcObject = null
    preview.muted = false
    preview.controls = true
    preview.src = URL.createObjectURL(recording.blob)
  } else preview.srcObject = recording.stream
}

export const clickStoryboard = async (
  app: AppContext,
  target: HTMLButtonElement,
  action: string | undefined
) => {
  const snapshot = app.snapshot
  if (!snapshot || !action?.startsWith('sb-')) return false
  const id = snapshot.project.id
  if (action === 'sb-approve') app.snapshot = await api.approveStoryboard(id)
  else if (action === 'sb-retry') app.snapshot = await api.retryStoryboard(id)
  else if (action === 'sb-upload' && target.dataset.page) {
    const input = app.root.querySelector<HTMLInputElement>(
      '[data-sb-take-file]'
    )
    if (!input) return true
    input.dataset.page = target.dataset.page
    input.value = ''
    input.click()
    return true
  } else if (action === 'sb-record' && target.dataset.page) {
    await openRecorder(app, target.dataset.page)
    return true
  } else if (action === 'sb-rec-start' && recording) {
    recording.chunks = []
    recording.blob = null
    const current = recording
    const recorder = new MediaRecorder(current.stream)
    recorder.ondataavailable = (event) =>
      event.data.size && current.chunks.push(event.data)
    recorder.onstop = () => {
      current.blob = new Blob(current.chunks, {
        type: recorder.mimeType || 'video/webm'
      })
      showState(app, 'review')
    }
    current.recorder = recorder
    recorder.start(1000)
    showState(app, 'recording')
    return true
  } else if (action === 'sb-rec-stop' && recording?.recorder) {
    recording.recorder.stop()
    return true
  } else if (action === 'sb-rec-save' && recording?.blob) {
    const { pageId, blob } = recording
    app.dialog.close()
    stopStream()
    app.snapshot = await uploadTake(id, pageId, blob)
  } else if (action === 'sb-rec-cancel') {
    app.dialog.close()
    stopStream()
    return true
  } else return false
  app.render()
  return true
}

export const submitStoryboard = async (
  app: AppContext,
  form: HTMLFormElement,
  values: FormData
) => {
  if (form.id !== 'storyboard-change' || !app.snapshot) return
  const note = String(values.get('note') || '').trim()
  if (!note) throw new Error('Say what to change')
  app.snapshot = await api.approveStoryboard(app.snapshot.project.id, note)
  app.render()
}

/** A scene's build chosen, or a take file picked. */
export const changeStoryboard = async (app: AppContext, element: Element) => {
  if (!app.snapshot) return false
  const id = app.snapshot.project.id
  if (
    element instanceof HTMLSelectElement &&
    element.dataset.sbBuild !== undefined &&
    element.dataset.page
  ) {
    app.snapshot = await api.setStoryboardBuild(
      id,
      element.dataset.page,
      element.value
    )
    app.render()
    return true
  }
  if (
    element instanceof HTMLInputElement &&
    element.dataset.sbTakeFile !== undefined &&
    element.dataset.page
  ) {
    const file = element.files?.[0]
    if (!file) return true
    app.snapshot = await uploadTake(id, element.dataset.page, file)
    app.render()
    return true
  }
  return false
}
