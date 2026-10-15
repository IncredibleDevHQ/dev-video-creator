// The storyboard page's actions: choose a scene or a frame (the made episode
// seeks to it), approve or change the plan, choose a scene's build, record a
// camera scene's take in place with the studio's recorder or upload one, try
// again. While the episode plays, the rail and the strip follow it.
import type { Snapshot } from '../shared/api'
import type { AppContext } from './app-context'
import {
  SCENE_CHANGE_SECONDS,
  TRANSITIONS,
  TRANSITION_LABELS
} from '../shared/storyboard'
import { api } from './api'
import { requestJson } from './http'
import { episodeClock, takeMoments } from './storyboard-view'
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

const storyboardOf = (app: AppContext) =>
  app.snapshot?.project.video?.storyboard

/** The scene and frame on show, for this notebook. */
const viewOf = (app: AppContext) =>
  app.sbView?.projectId === app.snapshot?.project.id
    ? app.sbView!
    : { projectId: app.snapshot!.project.id, scene: 0, frame: null }

const player = (app: AppContext) =>
  app.root.querySelector<HTMLVideoElement>('[data-sb-player]')

// A hair past a boundary, so a seek lands inside the scene or frame asked
// for, whatever the rounding of the durations that make the boundary.
const INSIDE = 0.05

/** Seek the made episode to a moment, now if it is on the page, else once
 * the next render draws it. */
const seek = (app: AppContext, start: number) => {
  const at = start + INSIDE
  const video = player(app)
  if (video && video.readyState >= 1) video.currentTime = at
  else app.sbSeek = at
}

/** A take being recorded for a storyboard scene of this notebook. */
export const storyboardRecording = (app: AppContext) =>
  Boolean(
    app.sbRecord &&
    app.snapshot?.project.video?.storyboard &&
    app.sbRecord.projectId === app.snapshot.project.id
  )

/** The reviewed take saved as the scene's take; the production goes on. */
export const saveStoryboardRecording = async (app: AppContext) => {
  if (!app.capture.blob || !app.sbRecord) return
  const { projectId, pageId } = app.sbRecord
  app.capture.phase = 'uploading'
  app.render()
  try {
    app.snapshot = await uploadTake(projectId, pageId, app.capture.blob)
    app.capture.dispose()
    app.sbRecord = null
  } catch (reason) {
    app.capture.phase = 'reviewing'
    app.render()
    throw reason
  }
}

/** The transitions a frame can enter with, the current one lit. A change
 * to a made episode puts it together again, with no agent. */
const transitionDialog = (app: AppContext, number: number) => {
  const storyboard = storyboardOf(app)!
  const scenes = storyboard.plan!.scenes
  const at = scenes.findIndex((scene) => scene.frames[0]?.number === number)
  const frame = scenes
    .flatMap((scene) => scene.frames)
    .find((entry) => entry.number === number)!
  const heading =
    at > 0 ? `Between scenes ${at} and ${at + 1}` : `Into frame ${number}`
  return `<h2>${heading}</h2>
<p class="sb-meta">${
    storyboard.produced
      ? 'The episode is put together again with it, in about a minute.'
      : 'The episode is put together with it.'
  }${at > 0 ? ` A crossfade into a new scene runs ${SCENE_CHANGE_SECONDS} s.` : ''}</p>${
    frame.transitionWhy
      ? `<p class="sb-meta">Planned as a cut: ${escape(frame.transitionWhy)}</p>`
      : ''
  }
<div class="transition-choices">${TRANSITIONS.map(
    (value) =>
      `<button type="button" data-action="sb-transition-set" data-number="${number}" data-value="${value}" ${value === frame.transition ? 'class="primary" aria-pressed="true"' : ''}>${TRANSITION_LABELS[value]}</button>`
  ).join('')}</div>`
}

const changeDialog = () => `<h2>Change the plan</h2>
<form id="storyboard-change" class="sb-change"><label for="sb-note">Say what to change, in your words</label><textarea id="sb-note" name="note" rows="3" placeholder="Open on the numbers; merge scenes 3 and 4"></textarea>
<div class="dialog-actions">${button('Cancel', 'close')}<button type="submit" class="primary">Plan again</button></div></form>`

export const clickStoryboard = async (
  app: AppContext,
  target: HTMLButtonElement,
  action: string | undefined
) => {
  const snapshot = app.snapshot
  if (!snapshot || !action?.startsWith('sb-')) return false
  const id = snapshot.project.id
  const storyboard = storyboardOf(app)
  const busy = app.capture.phase !== 'idle'
  if (action === 'sb-scene' || action === 'sb-frame') {
    if (busy || !storyboard) return true
    const view = viewOf(app)
    const clock = episodeClock(storyboard)
    if (action === 'sb-scene') {
      const scene = Number(target.dataset.index)
      app.sbView = { projectId: id, scene, frame: null }
      if (clock[scene]) seek(app, clock[scene].start)
    } else {
      const number = Number(target.dataset.number)
      app.sbView = { ...view, frame: number }
      const at = clock[view.scene]?.frames.find(
        (frame) => frame.number === number
      )
      if (at) seek(app, at.start)
    }
    app.render()
    return true
  }
  if (action === 'sb-transition') {
    if (busy || !storyboard?.plan) return true
    app.showDialog(transitionDialog(app, Number(target.dataset.number)))
    return true
  }
  if (action === 'sb-transition-set') {
    app.snapshot = await api.setStoryboardTransition(
      id,
      Number(target.dataset.number),
      target.dataset.value || ''
    )
    app.dialog.close()
    app.render()
    return true
  }
  if (action === 'sb-approve') app.snapshot = await api.approveStoryboard(id)
  else if (action === 'sb-retry') app.snapshot = await api.retryStoryboard(id)
  else if (action === 'sb-change') {
    app.showDialog(changeDialog())
    app.dialog.querySelector<HTMLTextAreaElement>('#sb-note')?.focus()
    return true
  } else if (action === 'sb-upload' && target.dataset.page) {
    const input = app.root.querySelector<HTMLInputElement>(
      '[data-sb-take-file]'
    )
    if (!input) return true
    input.dataset.page = target.dataset.page
    input.value = ''
    input.click()
    return true
  } else if (action === 'sb-record' && target.dataset.page) {
    if (busy) throw new Error('Finish this take first')
    const scene = storyboard?.plan?.scenes.find(
      (entry) => entry.pageId === target.dataset.page
    )
    if (!scene) return true
    const moments = takeMoments(scene)
    if (!moments.length) throw new Error('This scene has no lines to record')
    app.sbRecord = { projectId: id, pageId: scene.pageId }
    app.recordingSceneId = ''
    app.recordingProjectId = id
    app.sbView = {
      projectId: id,
      scene: storyboard!.plan!.scenes.indexOf(scene),
      frame: null
    }
    app.prepareRecordingPass(moments)
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
  app.dialog.close()
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

/** After a render: a seek asked for before the episode was on the page. */
export const syncStoryboardPlayer = (app: AppContext) => {
  const video = player(app)
  if (!video || app.sbSeek === null) return
  const at = app.sbSeek
  app.sbSeek = null
  if (video.readyState >= 1) video.currentTime = at
  else
    video.addEventListener(
      'loadedmetadata',
      () => {
        video.currentTime = at
      },
      { once: true }
    )
}

/** While the episode plays, the rail and the frame strip follow it. */
export const installStoryboardPlayback = (app: AppContext) => {
  app.root.addEventListener(
    'timeupdate',
    (event) => {
      const video = event.target as HTMLVideoElement
      const storyboard = storyboardOf(app)
      if (!video.matches?.('[data-sb-player]') || !storyboard) return
      const t = video.currentTime + INSIDE
      const clock = episodeClock(storyboard)
      const scene = clock.findIndex(
        (entry, index) =>
          t >= entry.start && (t < entry.end || index === clock.length - 1)
      )
      if (scene < 0) return
      const frame = clock[scene].frames.find(
        (entry) => t >= entry.start && t < entry.end
      )
      const view = viewOf(app)
      if (scene !== view.scene) {
        app.sbView = {
          projectId: view.projectId,
          scene,
          frame: frame?.number ?? null
        }
        app.render()
        return
      }
      for (const control of app.root.querySelectorAll<HTMLElement>(
        '.sb-strip [data-action="sb-frame"]'
      ))
        control.classList.toggle(
          'current',
          Number(control.dataset.number) === frame?.number
        )
      const head = app.root.querySelector<HTMLElement>('.sb-playhead')
      const span = clock[scene].end - clock[scene].start
      if (head && span > 0) {
        head.hidden = false
        head.style.left = `${Math.min(100, Math.max(0, ((video.currentTime - clock[scene].start) / span) * 100))}%`
      }
    },
    true
  )
}
