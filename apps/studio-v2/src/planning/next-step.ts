// The one next step a notebook offers (F10 of the Perplexity review), so a
// creator moves from a designed base to a reviewed scene without choosing
// between creation verbs, or learning which path ignores approved plans.
//
// A base offers its video: to create, or to open. A video offers the next
// step of the selected scene — plan it, review its candidate, record it,
// produce it from its approved plan, review what was produced — and, once
// no scene needs one, the export: the video, when every scene plays its
// accepted production; otherwise a draft that says which scenes do not.
import type { ScenePlanningView } from './planning-records'

export type NextStepAction = 'create-explainer' | 'create-video' | 'open-video' | 'brief' | 'plan' | 'review' | 'record' | 'produce' | 'review-output' | 'export' | 'wait'
export type NextStep = { action: NextStepAction; label: string; title: string; sceneId: string | null; disabled: boolean }

export type BaseInput = { pages: number; videos: Array<{ id: string; title: string }> }
export const baseNextStep = ({ pages, videos }: BaseInput): NextStep => {
  // A base with a video leads to it, whatever its pages are.
  if (videos.length) {
    const video = videos[0]
    return { action: 'open-video', label: 'Open video', title: `Open “${video.title}”, this notebook’s video${videos.length > 1 ? ` (the newest of ${videos.length})` : ''}: each scene is planned, reviewed and recorded there.`, sceneId: null, disabled: false }
  }
  if (!pages) return { action: 'create-explainer', label: 'Create explainer', title: 'Start from a link, an article or your own narrative: it becomes this notebook’s designed pages, and then its video.', sceneId: null, disabled: false }
  return { action: 'create-video', label: 'Create video', title: 'Make this notebook’s video: a video notebook made from these pages, where each scene is planned, reviewed and recorded — by you or with a generated voice, scene by scene.', sceneId: null, disabled: false }
}

export type VideoScene = {
  id: string
  index: number
  title: string
  state: ScenePlanningView['state']
  delivery: 'human' | 'generated' | 'silent' | null
  // The scene's take against its script now.
  take: 'none' | 'current' | 'earlier'
  // Its production from the approved plan (P4): none yet, running, ready to
  // review, accepted, out of date, or failed — and whether the notebook
  // plays an accepted production for it.
  production?: 'none' | 'producing' | 'ready' | 'accepted' | 'stale' | 'failed'
  produced?: boolean
}
export type VideoInput = {
  scenes: VideoScene[]
  brief: { ready: boolean; stale: boolean; preparing: boolean; failed: boolean }
  selected: string | null
  // Planning, and the harness it needs, run in the desktop app.
  desktop: boolean
}

const BROWSER = 'Planning runs in the desktop app, with your local harness'
const named = (scene: VideoScene) => `scene ${scene.index + 1}`

// A scene delivered by a generated voice or in silence is produced from its
// approved plan, then its production is reviewed and accepted.
const productionStep = (scene: VideoScene, about: string, step: (action: NextStepAction, label: string, title: string, disabled?: boolean) => NextStep, desktop: boolean): NextStep | null => {
  const desktopOnly = desktop ? '' : ' Production runs in the desktop app.'
  switch (scene.production || 'none') {
    case 'producing':
      return step('wait', `Producing ${named(scene)}…`, `${about} is being produced from its approved plan.`, true)
    case 'ready':
      return step('review-output', `Review ${named(scene)} output`, `${about} was produced from its approved plan: play it on the stage, and accept it as the scene's output.`)
    case 'accepted':
      return null
    case 'stale':
      return step('produce', `Produce ${named(scene)} again`, `What was produced for ${about} is out of date: produce it from its approved plan as it is now.${desktopOnly}`, !desktop)
    default:
      return step('produce', `Produce ${named(scene)}`, `${about} is approved: produce it from its approved plan, on your “Scene production” harness${scene.production === 'failed' ? ' — the last attempt failed' : ''}.${desktopOnly}`, !desktop)
  }
}

// What one scene needs next, or null when it needs nothing now.
const stepOf = (scene: VideoScene, desktop: boolean): NextStep | null => {
  const about = `“${scene.title || 'Untitled scene'}”`
  const step = (action: NextStepAction, label: string, title: string, disabled = false): NextStep => ({ action, label, title, sceneId: scene.id, disabled })
  switch (scene.state) {
    case 'planning':
      return step('wait', `Planning ${named(scene)}…`, `A plan for ${about} is being made.`, true)
    case 'ready-to-plan':
    case 'failed':
      return step('plan', `Plan ${named(scene)}`, desktop ? `Plan ${about} from the brief and its page${scene.state === 'failed' ? ' — the last attempt failed' : ''}.` : BROWSER, !desktop)
    case 'stale':
      return step('plan', `Revise ${named(scene)}`, desktop ? `The plan of ${about} was made from inputs that changed: plan it again from them.` : BROWSER, !desktop)
    case 'candidate':
      return step('review', `Review ${named(scene)}`, `Read the candidate plan of ${about}, preview it, and approve it or give direction.`)
    case 'reviewed':
      if (scene.delivery !== 'generated' && scene.delivery !== 'silent') {
        if (scene.take !== 'current') {
          return step('record', `${scene.take === 'earlier' ? 'Re-record' : 'Record'} ${named(scene)}`, `${about} is approved and presented by you: ${scene.take === 'earlier' ? 'its take is of an earlier script — record the lines that changed' : 'record your take'}.`)
        }
        // A scene you present is produced from your aligned take (P5), which
        // this build does not connect yet: its take plays in the notebook.
        return null
      }
      return productionStep(scene, about, step, desktop)
    default:
      return null
  }
}

export const videoNextStep = ({ scenes, brief, selected, desktop }: VideoInput): NextStep => {
  if (brief.preparing) return { action: 'wait', label: 'Preparing the brief…', title: 'The explanation brief is being prepared; the scenes are planned from it.', sceneId: null, disabled: true }
  if (!brief.ready || brief.stale) {
    return {
      action: 'brief',
      label: brief.stale ? 'Update the brief' : 'Prepare the brief',
      title: desktop ? (brief.stale ? 'The brief was made from inputs that changed: prepare it again, then plan the scenes from it.' : `The explanation brief comes first${brief.failed ? ' — the last attempt failed' : ''}: every scene is planned from it.`) : BROWSER,
      sceneId: null,
      disabled: !desktop,
    }
  }
  // The selected scene first, then the ones after it, round to the start.
  const at = Math.max(0, scenes.findIndex(scene => scene.id === selected))
  const order = [...scenes.slice(at), ...scenes.slice(0, at)]
  let waiting: NextStep | null = null
  for (const scene of order) {
    const step = stepOf(scene, desktop)
    if (!step) continue
    if (step.action === 'wait') {
      waiting ||= step
      continue
    }
    return step
  }
  if (waiting) return waiting
  // The video, once every scene plays its accepted production; until then
  // a draft, which says what it plays instead.
  const produced = scenes.filter(scene => scene.produced).length
  if (scenes.length && produced === scenes.length) {
    return { action: 'export', label: 'Export video', title: 'Every scene plays the production you accepted from its approved plan: the export renders them in order.', sceneId: null, disabled: false }
  }
  return {
    action: 'export',
    label: 'Export draft',
    title: produced
      ? `${produced} of ${scenes.length} scenes play the production you accepted; the others play the notebook’s own composition — your takes where you present them.`
      : 'No scene plays a production accepted from its approved plan: the export is a draft of the notebook’s own composition — your takes where you present them.',
    sceneId: null,
    disabled: !scenes.length,
  }
}
