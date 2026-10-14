// A storyboard video's page: the plan as a proposal ("This video tells …"),
// each scene with its build and its frames' jobs, the takes a camera scene
// waits for, and the made video. One line per level; detail opens on demand.
import type { Snapshot } from '../shared/api'
import {
  BUILD_LABELS,
  BUILD_TYPES,
  STAGE_LABELS,
  frameCount,
  framesDone,
  type FrameSummary,
  type SceneSummary,
  type Storyboard
} from '../shared/storyboard'
import { button, escape } from './ui'

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

const statusLabel = (frame: FrameSummary) =>
  frame.status === 'animated'
    ? 'Built'
    : frame.status === 'failed'
      ? 'Stopped'
      : ''

const frameRow = (
  frame: FrameSummary
) => `<li class="sb-frame is-${frame.status}">
<details>
<summary><span class="sb-frame-number">${frame.number}</span><span class="sb-frame-title"><strong>${escape(frame.title)}</strong><small>${escape(TYPE_LABELS[frame.type] || frame.type)} · ${escape(frame.beat)} · ${seconds(frame.duration)}</small></span>${statusLabel(frame) ? `<span class="sb-frame-state">${statusLabel(frame)}</span>` : ''}</summary>
<div class="sb-frame-body">
${frame.voiceover ? `<p class="sb-line">“${escape(frame.voiceover)}”</p>` : '<p class="sb-line is-silent">No words: the picture carries it.</p>'}
<dl><dt>Why</dt><dd>${escape(frame.narrativeRole)}</dd><dt>Leaves you with</dt><dd>${escape(frame.keyMessage)}</dd><dt>On screen</dt><dd>${escape(frame.scene)}</dd></dl>
${frame.problem ? `<p class="sb-problem">${escape(frame.problem)}</p>` : ''}
</div>
</details>
</li>`

const takeBlock = (scene: SceneSummary, storyboard: Storyboard) => {
  if (scene.take === undefined) return ''
  const changing =
    ['shots', 'frames', 'assemble', 'render'].includes(storyboard.stage) &&
    storyboard.status === 'working'
  const actions = changing
    ? ''
    : `<span class="sb-take-actions"><button type="button" data-action="sb-record" data-page="${escape(scene.pageId)}">${scene.take ? 'Record again' : 'Record'}</button><button type="button" data-action="sb-upload" data-page="${escape(scene.pageId)}">Upload</button></span>`
  return scene.take
    ? `<div class="sb-take is-ready"><span>Your take · ${seconds(scene.take.duration)}</span>${actions}</div>`
    : `<div class="sb-take"><span>${scene.build === 'camera' ? 'Record these lines on camera, or upload a take.' : 'Record these lines, or upload a take.'}</span>${actions}</div>`
}

const sceneBlock = (
  snapshot: Snapshot,
  storyboard: Storyboard,
  scene: SceneSummary,
  index: number
) => {
  const page = snapshot.project.slides.find(
    (slide) => slide.id === scene.pageId
  )
  const choosing =
    storyboard.stage === 'review' && storyboard.status === 'waiting'
  const build = choosing
    ? `<label class="sb-build"><span class="sr">Built as</span><select data-sb-build data-page="${escape(scene.pageId)}">${BUILD_TYPES.map(
        (type) =>
          `<option value="${type}" ${type === scene.build ? 'selected' : ''}>${BUILD_LABELS[type]}</option>`
      ).join('')}</select></label>`
    : `<span class="sb-build is-fixed">${BUILD_LABELS[scene.build]}</span>`
  return `<li class="sb-scene">
<div class="sb-scene-head"><span class="sb-scene-number">Scene ${index + 1}</span><strong>${escape(page?.title || scene.pageId)}</strong>${build}<span class="sb-scene-time">${seconds(sceneSeconds(scene))}</span></div>
<p class="sb-reason">${escape(scene.buildReason)}</p>
${takeBlock(scene, storyboard)}
<ol class="sb-frames">${scene.frames.map(frameRow).join('')}</ol>
</li>`
}

const lengthLine = (storyboard: Storyboard) =>
  storyboard.length
    ? `${seconds(storyboard.length.min)}–${seconds(storyboard.length.max)}${storyboard.length.strict ? ', must fit' : ''}`
    : ''

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

export const storyboardScreen = (snapshot: Snapshot) => {
  const storyboard = snapshot.project.video!.storyboard!
  const plan = storyboard.plan
  const reviewing =
    storyboard.stage === 'review' && storyboard.status === 'waiting'
  const missing = (plan?.scenes || []).filter((scene) => scene.take === null)
  const actions = [
    reviewing ? button('Approve and make', 'sb-approve', true) : '',
    storyboard.status === 'failed' ? button('Try again', 'sb-retry', true) : '',
    storyboard.produced
      ? `<a class="button primary" href="/objects/${escape(storyboard.produced.objectKey)}" download="video.mp4">Download MP4</a>`
      : ''
  ].join('')
  return `<section class="storyboard" aria-label="Storyboard">
<div class="sb-head">
<div class="sb-head-text">
<p class="sb-kicker" role="status">${escape(statusLine(storyboard))}</p>
${
  plan
    ? `<h2>This video tells ${escape(plan.audience)} that ${escape(plan.message.replace(/\.$/, ''))}.</h2>
<p class="sb-meta">${escape(plan.structure)} · opens with ${escape(plan.hook.toLowerCase())}${lengthLine(storyboard) ? ` · ${escape(lengthLine(storyboard))}` : ''}</p>${plan.continuity ? `<p class="sb-meta">${escape(plan.continuity)}</p>` : ''}`
    : '<h2>Planning the episode</h2><p class="sb-meta">The message, its structure and every frame’s job come first; you approve them before anything is built.</p>'
}
</div>
${actions ? `<div class="sb-actions">${actions}</div>` : ''}
</div>
${storyboard.status === 'failed' && storyboard.error ? `<p class="sb-alert" role="alert">${escape(storyboard.error)}</p>` : ''}
${
  storyboard.approved && missing.length
    ? `<p class="sb-alert is-waiting">${missing.length === 1 ? 'One scene waits' : `${missing.length} scenes wait`} for your take: record it or upload it below. ${storyboard.waitingFor === 'takes' ? 'Everything else is made.' : 'Everything else is being made meanwhile.'}</p>`
    : ''
}
${
  storyboard.produced
    ? `<div class="sb-video"><video src="/objects/${escape(storyboard.produced.objectKey)}" controls playsinline preload="metadata"></video>${storyboard.lengthNote ? `<p class="sb-meta">${escape(storyboard.lengthNote)}</p>` : ''}</div>`
    : ''
}
${plan ? `<ol class="sb-scenes">${plan.scenes.map((scene, index) => sceneBlock(snapshot, storyboard, scene, index)).join('')}</ol>` : ''}
${
  reviewing
    ? `<form id="storyboard-change" class="sb-change"><label for="sb-note">Change something</label><textarea id="sb-note" name="note" rows="2" placeholder="Open on the numbers; merge scenes 3 and 4"></textarea><button type="submit">Plan again</button></form>`
    : ''
}
${storyboard.contactSheetKey ? `<figure class="sb-sheet"><img src="/api/projects/${escape(snapshot.project.id)}/storyboard/sheet" alt="Every frame at its middle" loading="lazy"><figcaption>Every frame at its middle</figcaption></figure>` : ''}
<input type="file" data-sb-take-file accept="video/*,audio/*" hidden>
</section>`
}
