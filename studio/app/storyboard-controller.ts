import { syncPlayerBar } from './player-bar'
// The storyboard page's actions: choose a scene or a frame (the made episode
// seeks to it), approve or change the plan, approve the stills or change one
// with a note, choose a scene's build, record a camera scene's take in place
// with the studio's recorder or upload one, try again. While the episode
// plays, the rail and the strip follow it.
import type { Snapshot } from '../shared/api'
import type { Project } from '../shared/model'
import type { AppContext } from './app-context'
import {
  SCENE_CHANGE_SECONDS,
  TRANSITIONS,
  TRANSITION_LABELS
} from '../shared/storyboard'
import { api } from './api'
import { requestJson } from './http'
import {
  episodeClock,
  takeMoments,
  type StoryboardView
} from './storyboard-view'
import { button, escape } from './ui'

// A file the picker offers, by the name the engine takes it under: browsers
// call an .m4a audio/x-m4a, and a .wav or an .mp3 by older names.
const TYPE_NAMES: Record<string, string> = {
  'audio/x-m4a': 'audio/mp4',
  'audio/mp3': 'audio/mpeg',
  'audio/x-wav': 'audio/wav',
  'audio/wave': 'audio/wav',
  'audio/vnd.wave': 'audio/wav',
  'video/x-m4v': 'video/mp4'
}

const uploadTake = (projectId: string, pageId: string, blob: Blob) => {
  const type = (blob.type || 'video/webm').split(';')[0]
  return requestJson<Snapshot>(
    `/api/projects/${projectId}/storyboard/scenes/${pageId}/take`,
    {
      method: 'PUT',
      headers: { 'Content-Type': TYPE_NAMES[type] || type },
      body: blob
    }
  )
}

const storyboardOf = (app: AppContext) =>
  app.snapshot?.project.video?.storyboard

/** Whether a snapshot is at least as new as another, by its last event. */
const newer = (one: Snapshot, other: Snapshot) =>
  (one.events.at(-1)?.sequence ?? 0) >= (other.events.at(-1)?.sequence ?? 0)

/** The storyboard scene of the video scene the address names, so a reload
 * opens where the creator was (the Jev series run: it opened scene 1). */
export const storyboardViewAt = (
  project: Project,
  selected: number
): StoryboardView | null => {
  const page = project.video?.scenes[selected]?.slideId
  const scene =
    project.video?.storyboard?.plan?.scenes.findIndex(
      (entry) => entry.pageId === page
    ) ?? -1
  return scene >= 0 ? { projectId: project.id, scene, frame: null } : null
}

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
    const saved = await uploadTake(projectId, pageId, app.capture.blob)
    // Saved either way: the page shows it while the creator is still on its
    // notebook, and the recorder lets go of its take (review 7). The
    // snapshot comes first, so the redraw shows the take.
    if (app.snapshot?.project.id === projectId) app.snapshot = saved
    if (
      app.sbRecord?.projectId === projectId &&
      app.sbRecord.pageId === pageId
    ) {
      app.sbRecord = null
      app.capture.dispose()
    }
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

/** A note on one still: that frame is posed again with it. */
const stillDialog = (
  number: number,
  title: string
) => `<h2>Change frame ${number}’s still</h2>
<p class="sb-meta">${escape(title)} is posed again with your note; the other stills stay as they are.</p>
<form id="storyboard-still" class="sb-change" data-number="${number}"><label for="sb-still-note">What should change?</label><textarea id="sb-still-note" name="note" rows="3" placeholder="Make the diagram fill the frame; put the number on the left"></textarea>
<div class="dialog-actions">${button('Cancel', 'close')}<button type="submit" class="primary">Pose it again</button></div></form>`

const changeDialog = (posed: boolean) => `<h2>Change the plan</h2>${
  posed
    ? '<p class="sb-meta">The new plan waits for your approval, then every still is posed again.</p>'
    : ''
}
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
      // The address follows the scene on show.
      const page = storyboard.plan?.scenes[scene]?.pageId
      const at =
        snapshot.project.video?.scenes.findIndex((s) => s.slideId === page) ??
        -1
      if (at >= 0) app.selected = at
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
    if (app.dialog.dataset.saving === 'true') return true
    app.dialog.dataset.saving = 'true'
    const buttons = [
      ...app.dialog.querySelectorAll<HTMLButtonElement>('button')
    ]
    buttons.forEach((button) => {
      button.disabled = true
    })
    try {
      const saved = await api.setStoryboardTransition(
        id,
        Number(target.dataset.number),
        target.dataset.value || ''
      )
      if (app.snapshot?.project.id === id) {
        app.snapshot = saved
        app.dialog.close()
        app.render()
      }
    } finally {
      delete app.dialog.dataset.saving
      buttons.forEach((button) => {
        button.disabled = false
      })
    }
    return true
  }
  // A frame's words still past the creator's: the plan goes back with
  // them named, or they are kept (review 8).
  if (action === 'sb-claim-again' || action === 'sb-claim-keep') {
    const number = Number(target.dataset.number)
    const frame = storyboard?.plan?.scenes
      .flatMap((scene) => scene.frames)
      .find((entry) => entry.number === number)
    if (busy || !frame?.claim) return true
    target.disabled = true
    const saved = await (action === 'sb-claim-keep'
      ? api.keepFrameClaim(id, number)
      : api.approveStoryboard(
          id,
          `Frame ${number}: ${frame.claim}. Say it within that limit, or leave the promise out.`
        ))
    if (app.snapshot?.project.id === id) app.snapshot = saved
    app.render()
    return true
  }
  if (action === 'sb-still') {
    const number = Number(target.dataset.number)
    const frame = storyboard?.plan?.scenes
      .flatMap((scene) => scene.frames)
      .find((entry) => entry.number === number)
    if (busy || !frame) return true
    app.showDialog(stillDialog(number, frame.title))
    app.dialog.querySelector<HTMLTextAreaElement>('#sb-still-note')?.focus()
    return true
  }
  if (action === 'sb-remake') {
    const working = storyboard?.status === 'working'
    app.showDialog(
      `<h2>Remake from the current wireframes?</h2><p>A new plan will use your edited wireframes and wait for your approval.${working ? ' What is being made now stops first.' : ''} Your recorded takes are kept. This starts a new AI planning run.</p><div class="dialog-actions"><button type="button" data-action="close">Cancel</button><button type="button" class="primary" data-action="sb-remake-confirm">Remake video</button></div>`
    )
    return true
  }
  if (action === 'sb-stop' || action === 'sb-replan') {
    target.disabled = true
    const saved = await (action === 'sb-stop'
      ? api.stopStoryboard(id)
      : api.replanStoryboard(id))
    // The live stream may already have brought a newer state (the stop
    // landing): an answer read before it never replaces it (review 8).
    if (app.snapshot?.project.id === id && newer(saved, app.snapshot))
      app.snapshot = saved
    app.render()
    return true
  }
  if (action === 'sb-remake-confirm') {
    target.disabled = true
    try {
      const saved = await api.remakeStoryboard(id)
      app.dialog.close()
      if (app.snapshot?.project.id === id) {
        app.snapshot = saved
        app.render()
      }
    } finally {
      target.disabled = false
    }
    return true
  }
  if (action === 'sb-approve' || action === 'sb-retry') {
    const saved = await (action === 'sb-approve'
      ? api.approveStoryboard(id)
      : api.retryStoryboard(id))
    // Shown on its own notebook only: another may have opened meanwhile.
    if (app.snapshot?.project.id === id) app.snapshot = saved
  } else if (action === 'sb-change') {
    app.showDialog(changeDialog(storyboard?.stage === 'board'))
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
  if (!['storyboard-change', 'storyboard-still'].includes(form.id)) return
  if (!app.snapshot) return
  const id = app.snapshot.project.id
  const note = String(values.get('note') || '').trim()
  if (!note) throw new Error('Say what to change')
  const saved =
    form.id === 'storyboard-still'
      ? await api.noteStoryboardFrame(id, Number(form.dataset.number), note)
      : await api.approveStoryboard(id, note)
  // Another notebook opened meanwhile keeps its page, and its own dialog.
  if (app.snapshot?.project.id !== id) return
  app.snapshot = saved
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
    const saved = await api.setStoryboardBuild(
      id,
      element.dataset.page,
      element.value
    )
    if (app.snapshot?.project.id === id) {
      app.snapshot = saved
      app.render()
    }
    return true
  }
  if (
    element instanceof HTMLInputElement &&
    element.dataset.sbTakeFile !== undefined &&
    element.dataset.page
  ) {
    const file = element.files?.[0]
    if (!file) return true
    const saved = await uploadTake(id, element.dataset.page, file)
    if (app.snapshot?.project.id === id) {
      app.snapshot = saved
      app.render()
    }
    return true
  }
  return false
}

/** After a render: a seek asked for before the episode was on the page. */
export const syncStoryboardPlayer = (app: AppContext) => {
  syncPlayerBar(app.root)
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
