// A storyboard video's page, laid out like the Wireframe page: the scenes in
// a rail on the left, the chosen scene on the stage, its frames in a strip
// under it and the chosen frame's line below. A camera scene records in
// place, the way scenes always have: camera on beside its page, a countdown,
// one line at a time on the prompter, then the take to review.
import type { Snapshot } from '../shared/api'
import type { Moment } from '../shared/model'
import { presenterLayoutStyle } from '../shared/presenter-layout'
import {
  BUILD_LABELS,
  BUILD_TYPES,
  SCENE_CHANGE_SECONDS,
  STAGE_LABELS,
  TRANSITION_LABELS,
  frameCount,
  frameId,
  framesDone,
  type FrameSummary,
  type FrameTransition,
  type SceneSummary,
  type Storyboard
} from '../shared/storyboard'
import { cameraCue } from './camera-cue'
import type { Recording } from './recording'
import {
  countdownOverlay,
  recordActions,
  recordLight,
  recordTitle
} from './record-view'
import { button, escape } from './ui'

const standIn = new URL('./assets/presenter.jpg', import.meta.url).href

/** Which scene and frame the page shows, for one notebook. */
export type StoryboardView = {
  projectId: string
  scene: number
  frame: number | null
}

const TYPE_LABELS: Record<string, string> = {
  hook: 'Hook',
  pain_point: 'Why it matters',
  product_intro: 'Names the idea',
  feature_showcase: 'Step',
  benefit_highlight: 'So what',
  social_proof: 'Evidence',
  branding: 'Takeaway',
  cta: 'The ask'
}

const seconds = (value: number) =>
  value >= 60
    ? `${Math.floor(value / 60)}:${String(Math.round(value % 60)).padStart(2, '0')}`
    : `${Math.round(value * 10) / 10} s`

const sceneSeconds = (scene: SceneSummary) =>
  scene.frames.reduce((total, frame) => total + frame.duration, 0)

/** Where each scene and frame starts in the made episode, in seconds. */
export const episodeClock = (storyboard: Storyboard) => {
  let at = 0
  return (storyboard.plan?.scenes || []).map((scene) => ({
    pageId: scene.pageId,
    start: at,
    frames: scene.frames.map((frame) => {
      const start = at
      at += frame.duration
      return { number: frame.number, start, end: at }
    }),
    end: at
  }))
}

// The plan's length against what was asked: "43 s · aim 25 s–1:00".
const lengthLine = (storyboard: Storyboard) => {
  const total = (storyboard.plan?.scenes || []).reduce(
    (sum, scene) => sum + sceneSeconds(scene),
    0
  )
  const asked = storyboard.length
    ? `${storyboard.length.strict ? 'must fit' : 'aim'} ${seconds(storyboard.length.min)}–${seconds(storyboard.length.max)}`
    : ''
  return [total ? seconds(total) : '', asked].filter(Boolean).join(' · ')
}

const structureLabel = (structure: string) =>
  structure.charAt(0).toUpperCase() + structure.slice(1).replace(/-/g, ' ')

const statusLine = (storyboard: Storyboard) => {
  const total = frameCount(storyboard)
  const done = framesDone(storyboard)
  if (storyboard.status === 'failed') return 'Stopped'
  if (storyboard.status === 'done') return 'Made'
  if (storyboard.status === 'waiting')
    return storyboard.waitingFor === 'takes'
      ? 'Waiting for your takes'
      : 'The plan is ready for you'
  return storyboard.stage === 'frames' && total
    ? `${STAGE_LABELS.frames} · ${done} of ${total}`
    : STAGE_LABELS[storyboard.stage]
}

const building = (storyboard: Storyboard) =>
  ['shots', 'frames', 'assemble', 'render'].includes(storyboard.stage) &&
  storyboard.status === 'working'

/** A camera scene's frames as the moments a take is recorded across. */
export const takeMoments = (scene: SceneSummary): Moment[] =>
  scene.frames
    .filter((frame) => frame.voiceover.trim())
    .map(
      (frame) =>
        ({
          id: frameId(frame),
          recordingKey: `${scene.pageId}:${frame.number}`,
          title: frame.title,
          camera: 'full',
          layout: 'beside-slide',
          start: 0,
          end: frame.duration
        }) as unknown as Moment
    )

const railState = (storyboard: Storyboard, scene: SceneSummary) => {
  if (scene.take === null)
    return '<span class="sb-rail-state is-take">Your take</span>'
  if (scene.frames.every((frame) => frame.status === 'animated'))
    return '<span class="sb-rail-state is-built">Built</span>'
  return building(storyboard) || storyboard.stage === 'voice'
    ? '<span class="sb-rail-state is-working"><span class="activity-orbit" aria-hidden="true"></span>Building</span>'
    : ''
}

const rail = (
  snapshot: Snapshot,
  storyboard: Storyboard,
  chosen: number,
  focused: boolean
) => {
  const scenes = storyboard.plan?.scenes || []
  const total = scenes.reduce((sum, scene) => sum + sceneSeconds(scene), 0)
  const pages = scenes.length
    ? scenes.map((scene) => scene.pageId)
    : storyboard.pages
  return `<aside class="rail scene-rail" ${focused ? 'inert' : ''} aria-label="Scenes">
<div class="rail-heading"><strong>Scenes</strong><small>${pages.length} ${pages.length === 1 ? 'scene' : 'scenes'}${total ? ` · ${seconds(total)}` : ''}</small></div>
${pages
  .map((pageId, index) => {
    const page = snapshot.project.slides.find((slide) => slide.id === pageId)
    const scene = scenes[index]
    return `<div class="scene-card"><button type="button" class="thumbnail ${index === chosen ? 'selected' : ''}" data-action="sb-scene" data-index="${index}" aria-label="Scene ${index + 1}: ${escape(page?.title || '')}">
<span class="thumb-number">${index + 1}</span>
<div>${page?.svg || '<span>Blank wireframe</span>'}</div>
<span class="scene-meta"><span>${scene ? seconds(sceneSeconds(scene)) : ''}</span>${scene ? `<b>${escape(BUILD_LABELS[scene.build].toUpperCase())}</b>` : ''}</span>${scene ? railState(storyboard, scene) : ''}
</button></div>${
      scenes[index + 1]?.frames[0]
        ? transitionMark(
            scenes[index + 1].frames[0],
            true,
            canChange(storyboard) && !focused,
            `Between scenes ${index + 1} and ${index + 2}`
          )
        : ''
    }`
  })
  .join('')}</aside>`
}

// The episode above the stage: the whole proposal while it is reviewed,
// then the message and one line.
const band = (storyboard: Storyboard) => {
  const plan = storyboard.plan
  const reviewing =
    storyboard.stage === 'review' && storyboard.status === 'waiting'
  const length = lengthLine(storyboard)
  return `<div class="sb-band">
<p class="sb-kicker" role="status">${escape(statusLine(storyboard))}</p>
${
  !plan
    ? '<h2>Planning the episode</h2><p class="sb-meta">The message, its structure and every frame’s job come first; you approve them before anything is built.</p>'
    : reviewing
      ? `<h2>${escape(plan.message)}</h2>
<p class="sb-meta">For ${escape(plan.audience)} · ${escape(structureLabel(plan.structure))} · opens with ${escape(plan.hook.toLowerCase())}${length ? ` · ${escape(length)}` : ''}</p>${plan.continuity ? `<p class="sb-meta">${escape(plan.continuity)}</p>` : ''}`
      : `<h2>${escape(plan.message)}</h2>
<p class="sb-meta">${escape(structureLabel(plan.structure))}${length ? ` · ${escape(length)}` : ''}</p>`
}
</div>`
}

/** What the stage shows: the made episode, a built frame, or the page, with
 * the camera beside it while a take is recorded or reviewed. */
const stage = (
  snapshot: Snapshot,
  storyboard: Storyboard,
  scene: SceneSummary | undefined,
  frame: FrameSummary | undefined,
  capture: Recording,
  recording: boolean
) => {
  const page = snapshot.project.slides.find(
    (slide) => slide.id === (scene?.pageId || storyboard.pages[0])
  )
  const camera = scene?.build === 'camera'
  const live =
    recording &&
    ['preparing', 'ready', 'countdown', 'recording'].includes(capture.phase)
  const reviewing =
    recording && ['reviewing', 'uploading'].includes(capture.phase)
  if (storyboard.produced && !recording)
    return `<div class="stage video-stage sb-stage"><video class="sb-player" data-sb-player src="/objects/${escape(storyboard.produced.objectKey)}"${storyboard.posterKey ? ` poster="/objects/${escape(storyboard.posterKey)}"` : ''} controls playsinline preload="metadata"></video></div>`
  const picture =
    !recording && frame?.status === 'animated'
      ? `<img class="sb-shot" src="/api/projects/${escape(snapshot.project.id)}/storyboard/frames/${escape(frameId(frame))}/snapshot?v=${encodeURIComponent(storyboard.updatedAt)}" alt="Frame ${frame.number}, as built">`
      : page?.svg ||
        '<span class="sb-stage-note">The page is being drawn</span>'
  const presenter = !camera
    ? ''
    : live
      ? '<div class="presenter-preview beside-slide"><video data-camera autoplay muted playsinline></video></div>'
      : reviewing && capture.url
        ? `<div class="presenter-preview beside-slide"><video class="take-player" data-sb-take src="${escape(capture.url)}" controls playsinline></video></div>`
        : scene?.take
          ? `<div class="presenter-preview beside-slide"><video data-sb-take src="/objects/${escape(scene.take.objectKey)}" controls playsinline preload="metadata"></video></div>`
          : `<div class="presenter-preview beside-slide"><img src="${standIn}" alt="Presenter stand-in"><small>Your take goes here</small></div>`
  return `<div class="stage video-stage sb-stage ${camera && frame?.status !== 'animated' ? 'presenter-layout-beside-slide' : ''}" style="${camera ? presenterLayoutStyle('beside-slide') : ''}">${camera && frame?.status === 'animated' && !recording ? picture : `${picture}${presenter}`}${recording ? countdownOverlay(capture) : ''}</div>`
}

/** The line to read, large, while a take is set up and recorded. */
const prompter = (
  scene: SceneSummary,
  capture: Recording,
  recording: boolean
) => {
  if (
    !recording ||
    !['ready', 'countdown', 'recording'].includes(capture.phase)
  )
    return ''
  const lines = scene.frames.filter((frame) => frame.voiceover.trim())
  const at = Math.min(capture.current, lines.length - 1)
  const line = lines[at]
  const next = lines[at + 1]
  const more = lines.length > 1
  const label =
    capture.phase === 'ready'
      ? 'Get ready · this is your first line'
      : capture.phase === 'countdown'
        ? `Ready in ${capture.countdown}`
        : `Recording · ${more ? 'Enter for the next line · ' : ''}Esc to stop`
  return `<div class="practice-cue recording-script sb-prompter"><strong>${escape(label)}</strong><span data-prompter>${escape(line?.voiceover || '')}</span>${next ? `<small>Then: ${escape(next.voiceover)}</small>` : ''}</div>`
}

const sceneLine = (
  storyboard: Storyboard,
  scene: SceneSummary,
  index: number,
  title: string
) => {
  const choosing =
    storyboard.stage === 'review' && storyboard.status === 'waiting'
  const build = choosing
    ? `<label class="sb-build"><span class="sr">Built as</span><select data-sb-build data-page="${escape(scene.pageId)}">${BUILD_TYPES.map(
        (type) =>
          `<option value="${type}" ${type === scene.build ? 'selected' : ''}>${BUILD_LABELS[type]}</option>`
      ).join('')}</select></label>`
    : `<span class="sb-build is-fixed">${BUILD_LABELS[scene.build]}</span>`
  return `<div class="sb-scene-line"><span class="sb-scene-number">Scene ${index + 1} of ${storyboard.plan!.scenes.length}</span><strong>${escape(title)}</strong>${build}<span class="sb-scene-time">${seconds(sceneSeconds(scene))}</span></div>
<p class="sb-reason">${escape(scene.buildReason)}</p>`
}

const frameState = (frame: FrameSummary) =>
  frame.status === 'animated'
    ? 'Built'
    : frame.status === 'failed'
      ? 'Stopped'
      : seconds(frame.duration)

const GLYPHS: Record<FrameTransition, string> = {
  cut: '│',
  crossfade: '◐',
  'blur-crossfade': '◍',
  'push-slide LEFT': '←',
  'push-slide RIGHT': '→',
  'push-slide UP': '↑',
  'push-slide DOWN': '↓',
  'zoom-through': '⊕',
  squeeze: '⇔'
}

/** How a frame enters, in words: a crossfade into a new scene runs longer. */
export const transitionWords = (frame: FrameSummary, opensScene: boolean) =>
  `${TRANSITION_LABELS[frame.transition] || frame.transition}${
    opensScene && /crossfade$/.test(frame.transition)
      ? ` · ${SCENE_CHANGE_SECONDS} s`
      : ''
  }`

/** A transition can change while nothing is being made. */
const canChange = (storyboard: Storyboard) =>
  storyboard.status !== 'working' && Boolean(storyboard.plan)

/** The mark between two frames (or two scenes) for how the next one enters. */
const transitionMark = (
  frame: FrameSummary,
  opensScene: boolean,
  enabled: boolean,
  between: string
) =>
  frame.transition
    ? `<button type="button" class="${opensScene ? 'transition-control sb-scene-change' : 'sb-transition'}" data-action="sb-transition" data-number="${frame.number}" title="${escape(`${between}: ${transitionWords(frame, opensScene)}`)}" aria-label="${escape(`${between}: ${transitionWords(frame, opensScene)}`)}" ${enabled ? '' : 'disabled'}>${opensScene ? escape(transitionWords(frame, true)) : GLYPHS[frame.transition] || '·'}</button>`
    : ''

/** The scene's frames, sized by how long each runs; the chosen one lit. */
const strip = (
  scene: SceneSummary,
  current: number | undefined,
  locked: boolean,
  changeable: boolean
) =>
  `<div class="moment-timeline sb-strip"><div class="moment-strip" aria-label="Frames">${scene.frames
    .map(
      (frame, index) =>
        `${index ? transitionMark(frame, false, changeable && !locked, `Into frame ${frame.number}`) : ''}<div class="moment-item" style="flex-grow:${Math.max(0.1, frame.duration)}">
<button type="button" class="moment ${frame.number === current ? 'current' : ''}" data-action="sb-frame" data-number="${frame.number}" ${locked ? 'disabled' : ''}>
<span class="moment-head"><b class="moment-number">${frame.number}</b>${scene.build === 'camera' ? cameraCue('full') : ''}</span>
<span class="moment-name" title="${escape(frame.title)}">${escape(frame.title)}</span>
<small>${escape(TYPE_LABELS[frame.type] || frame.type)} · ${escape(frameState(frame))}</small>
</button></div>`
    )
    .join(
      ''
    )}<span class="sb-playhead" aria-hidden="true" hidden></span></div></div>`

const frameDetail = (
  frame: FrameSummary,
  opensScene: boolean
) => `<section class="sb-frame-detail" aria-label="Frame ${frame.number}">
${frame.voiceover ? `<p class="sb-line">“${escape(frame.voiceover)}”</p>` : '<p class="sb-line is-silent">No words: the picture carries it.</p>'}
<dl><dt>Why</dt><dd>${escape(frame.narrativeRole)}</dd><dt>On screen</dt><dd>${escape(frame.scene)}</dd>${frame.transition ? `<dt>Enters with</dt><dd>${escape(transitionWords(frame, opensScene))}${frame.transitionWhy ? ` · ${escape(frame.transitionWhy)}` : ''}</dd>` : ''}</dl>
${frame.problem ? `<p class="sb-problem">${escape(frame.problem)}</p>` : ''}
</section>`

const actions = (
  storyboard: Storyboard,
  scene: SceneSummary | undefined,
  capture: Recording,
  recording: boolean
) => {
  if (
    recording &&
    ['preparing', 'ready', 'countdown', 'recording'].includes(capture.phase)
  )
    return recordActions(capture, 'line')
  if (recording && capture.phase === 'reviewing')
    return `${button('Discard', 'discard-take')}${button('Retake', 'retake-recording')}${button('Save take', 'save-take', true)}`
  if (recording && capture.phase === 'uploading')
    return button('Saving…', 'save-take', true, true)
  const reviewing =
    storyboard.stage === 'review' && storyboard.status === 'waiting'
  const take = (() => {
    if (!scene || scene.take === undefined) return ''
    const locked = Boolean(scene.take) && building(storyboard)
    const lead = Boolean(storyboard.approved) && !scene.take && !reviewing
    const control = (label: string, action: string, primary: boolean) =>
      `<button type="button" data-action="${action}" data-page="${escape(scene.pageId)}" ${primary ? 'class="primary"' : ''} ${locked ? 'disabled title="Wait until this step finishes to replace a take"' : ''}>${label}</button>`
    return `${control('Upload', 'sb-upload', false)}${control(scene.take ? 'Record again' : 'Record', 'sb-record', lead)}`
  })()
  return `${take}${reviewing ? `${button('Change the plan', 'sb-change')}${button('Approve and make', 'sb-approve', true)}` : ''}${storyboard.status === 'failed' ? button('Try again', 'sb-retry', true) : ''}`
}

export const storyboardScreen = (
  snapshot: Snapshot,
  view: StoryboardView | null,
  capture: Recording,
  recordPage: string | null
) => {
  const storyboard = snapshot.project.video!.storyboard!
  const plan = storyboard.plan
  const scenes = plan?.scenes || []
  const chosen =
    view?.projectId === snapshot.project.id
      ? Math.min(view.scene, Math.max(0, scenes.length - 1))
      : 0
  const scene = scenes[chosen]
  const recording = Boolean(
    scene && recordPage === scene.pageId && capture.phase !== 'idle'
  )
  const focused = recording
  const picked =
    view?.projectId === snapshot.project.id && view.frame !== null
      ? scene?.frames.find((frame) => frame.number === view.frame)
      : undefined
  const lines = scene?.frames.filter((frame) => frame.voiceover.trim()) || []
  const frame = recording
    ? lines[Math.min(capture.current, lines.length - 1)]
    : picked || scene?.frames[0]
  const page = snapshot.project.slides.find(
    (slide) => slide.id === scene?.pageId
  )
  const missing = scenes.filter((entry) => entry.take === null)
  const reviewingTake =
    recording && ['reviewing', 'uploading'].includes(capture.phase)
  return `<section class="video-workspace storyboard-workspace ${focused ? 'is-focused' : ''}" data-capture-phase="${capture.phase}" aria-label="Storyboard">
${rail(snapshot, storyboard, chosen, focused)}
<div class="stage-area" ${focused ? 'role="dialog" aria-modal="true" aria-label="Presenter studio"' : ''}>
${
  focused
    ? `<div class="focus-heading"><div><strong>${reviewingTake ? 'Review your take' : recordTitle(capture)}</strong><span>Scene ${chosen + 1} · ${reviewingTake ? `${lines.length} ${lines.length === 1 ? 'line' : 'lines'}` : `Frame ${frame?.number ?? 1}${lines.length > 1 ? ` · ${Math.min(capture.current, lines.length - 1) + 1} of ${lines.length}` : ''}`}</span>${recordLight(capture)}</div></div>`
    : band(storyboard)
}
${storyboard.status === 'failed' && storyboard.error ? `<p class="sb-alert" role="alert">${escape(storyboard.error)}</p>` : ''}
${stage(snapshot, storyboard, scene, frame, capture, recording)}
${scene ? prompter(scene, capture, recording) : ''}
${scene && !focused ? sceneLine(storyboard, scene, chosen, page?.title || scene.pageId) : ''}
${scene ? strip(scene, frame?.number, focused, canChange(storyboard)) : ''}
${frame && !focused ? frameDetail(frame, chosen > 0 && scene?.frames[0]?.number === frame.number) : ''}
${
  !focused && storyboard.approved && missing.length
    ? `<div class="recording-nudge"><strong>Your turn</strong><span>${missing.length === 1 ? 'One scene waits' : `${missing.length} scenes wait`} for your take: record it on camera, or upload one. ${storyboard.waitingFor === 'takes' ? 'Everything else is made.' : 'Everything else is being made meanwhile.'}</span></div>`
    : ''
}
<div class="video-actions"><div>${focused ? '' : button('← Wireframe', 'open-wireframe')}</div><div>${actions(storyboard, scene, capture, recording)}</div></div>
</div>
<input type="file" data-sb-take-file accept="video/*,audio/*" hidden>
</section>`
}
