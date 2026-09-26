// Where a video scene stands, read from its durable planning records: the
// revision on show, its preview, the scene's production — and, from them,
// the one thing to do next with the revision the creator is looking at.
//
// These are pure selectors. The notebook's review and the scene workspace
// both draw from them, so a label or an action never depends on which view
// asked (§8 of the scene workspace plan). Plan approval, the preview's
// build, recording and the production stay independent: no state here
// starts one from another.
import { isActiveStatus, type PlanningRecord } from './planning-records'
import type { PlanningOverviewV1, ScenePreviewView, SceneProductionView } from './planning-workspace'

export type Scene = PlanningOverviewV1['scenes'][number]

// checking: the harness submitted it, and the product is playing it in the
// pinned player before it can read ready.
export type PreviewState = { state: 'none' | 'building' | 'ready' | 'failed'; recordId?: string; message?: string; stale?: boolean; checking?: boolean }
export type ProductionState = 'none' | 'producing' | 'ready' | 'accepted' | 'stale' | 'failed'
// The scene's current take against its script now: changed are the script's
// lines the take was not spoken against; null when there is no take.
export type TakeState = { known: boolean; current: boolean; revision: number | null; changed: string[] | null; dropped: number | null; pickups?: number } | null

// A scene's plan revisions, newest first.
export const treatmentRecordsOf = (records: PlanningRecord[], sceneId: string) =>
  records.filter(record => record.kind === 'treatment' && record.subject === sceneId).sort((a, b) => b.revision - a.revision)

// The revision on show: the one chosen, else the scene's current plan, else
// its newest revision with content.
export const shownRecordOf = (scene: Scene, records: PlanningRecord[], chosen: string) => {
  const all = treatmentRecordsOf(records, scene.id).filter(record => record.content)
  return all.find(record => record.id === chosen) || scene.view.current || all[0] || null
}

// A plan revision's own sketch: another revision's is never shown for it.
export const previewFor = (scene: Scene, record: PlanningRecord | null | undefined): ScenePreviewView | null =>
  (record && scene.preview?.byTreatment?.[record.id]) || null

// Where the sketch of one plan revision stands.
export const previewStateOf = (scene: Scene, record: PlanningRecord | null | undefined): PreviewState => {
  const preview = scene.preview
  if (!preview || !record) return { state: 'none' }
  const latest = preview.latest
  if (latest.treatmentId === record.id && isActiveStatus(latest.status)) return { state: 'building', recordId: latest.id, checking: latest.status === 'verifying' }
  const ready = previewFor(scene, record)
  if (ready) return { state: 'ready', recordId: ready.id, stale: !ready.current }
  if (latest.treatmentId === record.id && latest.status === 'failed') return { state: 'failed', recordId: latest.id, message: latest.error?.message }
  return { state: 'none' }
}

// What the stage plays as the scene's production: the newest one, else the
// one accepted — and, for a revision, only the one made from it.
export const productionShown = (scene: Scene): SceneProductionView | null => scene.production?.ready || scene.production?.accepted || null
export const producedFor = (scene: Scene, record: PlanningRecord | null | undefined) => {
  const production = productionShown(scene)
  return production && record && production.of.record === record.id ? production : null
}

// Where the scene's production stands.
export const productionStateOf = (scene: Scene): ProductionState => {
  const production = scene.production
  if (!production) return 'none'
  if (isActiveStatus(production.latest.status)) return 'producing'
  if (production.ready && !production.ready.accepted && production.ready.current) return 'ready'
  if (production.accepted?.current) return 'accepted'
  if (production.ready || production.accepted) return 'stale'
  return production.latest.status === 'failed' ? 'failed' : 'none'
}

// A take that still sets the scene's clock: current, or of a script the
// product cannot compare (never asked for again on a guess).
const takeHolds = (take: TakeState) => Boolean(take && (take.current || !take.known))

export type SceneActionKind =
  | 'prepare-brief'
  | 'plan'
  | 'revise'
  | 'stop'
  | 'preview'
  | 'show-preview'
  | 'approve'
  | 'approve-unpreviewed'
  | 'show-current'
  | 'choose-delivery'
  | 'record'
  | 'produce'
  | 'review-output'
  | 'accept'
// disabled: why it cannot run now; the action is still named.
export type SceneAction = { kind: SceneActionKind; label: string; recordId?: string; disabled?: string }
export type SceneActivity = { kind: 'brief' | 'planning' | 'preview' | 'production'; label: string; recordId: string; checking?: boolean }
export type SceneActions = { primary: SceneAction | null; secondary: SceneAction[]; activity: SceneActivity | null }

export type SceneActionInput = {
  scene: Scene
  shown: PlanningRecord | null
  brief: { ready: boolean; stale: boolean; preparing: boolean; failed: boolean; recordId?: string | null }
  take: TakeState
  desktop: boolean
  // Planning is available (the desktop app with its pinned skill bundle).
  available: boolean
  // What the stage shows now: reviewing an output is accepting it there.
  stage?: 'reference' | 'schematic' | 'base' | 'preview' | 'output'
}

const DESKTOP_ONLY = 'Runs in the desktop app'

// The one action for the revision on show (the scene workspace plan's table
// of actions by state), what else can be done with it, and what is running.
export const sceneActionsOf = (input: SceneActionInput): SceneActions => {
  const { scene, shown, brief, take, desktop, available } = input
  const view = scene.view
  const secondary: SceneAction[] = []
  const blocked = !desktop ? DESKTOP_ONLY : !available ? 'Planning needs the desktop app and its pinned skills' : undefined
  // The brief comes before any plan.
  if (view.state === 'needs-brief' || view.state === 'brief-failed') {
    return { primary: { kind: 'prepare-brief', label: view.state === 'brief-failed' ? 'Retry the brief' : 'Prepare the brief', ...(blocked ? { disabled: blocked } : {}) }, secondary, activity: null }
  }
  if (view.state === 'preparing') return { primary: null, secondary, activity: brief.recordId ? { kind: 'brief', label: 'Preparing the explanation brief', recordId: brief.recordId } : null }
  // A plan being made is shown as it goes; the approved plan stays meanwhile.
  const planning = view.latest && view.latest.kind === 'treatment' && isActiveStatus(view.latest.status) ? view.latest : null
  let activity: SceneActivity | null = planning ? { kind: 'planning', label: `Planning r${planning.revision}`, recordId: planning.id } : null
  if (planning) secondary.push({ kind: 'stop', label: 'Stop planning', recordId: planning.id })
  const briefBlocks = brief.stale ? 'Prepare the brief again first' : !brief.ready ? 'The brief comes first' : undefined
  const planBlocked = blocked || briefBlocks
  if (!shown) {
    if (planning) return { primary: null, secondary, activity }
    const failed = view.latest?.status === 'failed'
    return { primary: { kind: 'plan', label: failed ? 'Plan the scene again' : 'Plan the scene', ...(planBlocked ? { disabled: planBlocked } : {}) }, secondary, activity }
  }
  const n = shown.revision
  const stale = shown.id === view.current?.id && Boolean(view.staleBecause)
  const revise: SceneAction = { kind: 'revise', label: 'Revise the plan', ...(planning ? { disabled: `r${planning.revision} is being planned` } : planBlocked ? { disabled: planBlocked } : {}) }
  if (stale) {
    return { primary: planning ? null : { ...revise, label: 'Plan again from the current inputs' }, secondary, activity }
  }
  if (shown.status === 'candidate') {
    const preview = previewStateOf(scene, shown)
    const unpreviewed: SceneAction = { kind: 'approve-unpreviewed', label: `Approve r${n} without a preview`, recordId: shown.id }
    let primary: SceneAction | null
    if (preview.state === 'building') {
      activity = activity || { kind: 'preview', label: preview.checking ? `Checking the preview of r${n}` : `Building the preview of r${n}`, recordId: preview.recordId || '', checking: preview.checking }
      primary = null
      if (preview.recordId) secondary.push({ kind: 'stop', label: 'Stop the preview', recordId: preview.recordId })
      secondary.push(unpreviewed)
    } else if (preview.state === 'ready' && !preview.stale) {
      primary = { kind: 'approve', label: `Approve r${n}`, recordId: shown.id }
      if (input.stage !== 'preview') secondary.push({ kind: 'show-preview', label: `Play the preview of r${n}`, recordId: shown.id })
    } else {
      primary = { kind: 'preview', label: preview.state === 'failed' || preview.stale ? `Preview r${n} again` : `Preview r${n}`, recordId: shown.id, ...(blocked ? { disabled: blocked } : {}) }
      secondary.push(unpreviewed)
    }
    secondary.push(revise)
    return { primary, secondary, activity }
  }
  if (shown.status === 'reviewed' && shown.id === view.reviewed?.id) {
    // A newer candidate never replaces the approved plan on show: it is
    // offered, for the creator to look at (U3 of the scene workspace plan).
    const newer = view.current && view.current.id !== shown.id && view.current.status === 'candidate' ? view.current : null
    if (newer) secondary.unshift({ kind: 'show-current', label: `Review r${newer.revision}`, recordId: newer.id })
    const production = productionStateOf(scene)
    const latest = scene.production?.latest
    const producer = blocked ? { disabled: blocked } : {}
    if (production === 'producing' && latest) {
      activity = activity || { kind: 'production', label: latest.status === 'verifying' ? `Checking the scene produced from r${n}` : `Producing the scene from r${n}`, recordId: latest.id, checking: latest.status === 'verifying' }
      return { primary: null, secondary: [...secondary, { kind: 'stop', label: 'Stop producing', recordId: latest.id }, revise], activity }
    }
    if (production === 'ready') {
      const ready = scene.production!.ready!
      const primary: SceneAction = input.stage === 'output'
        ? { kind: 'accept', label: 'Accept as the scene\'s output', recordId: ready.id }
        : { kind: 'review-output', label: 'Review the output', recordId: ready.id }
      return { primary, secondary: [...secondary, { kind: 'produce', label: 'Produce again', ...producer }, revise], activity }
    }
    if (production === 'accepted') {
      return { primary: null, secondary: [...secondary, ...(input.stage === 'output' ? [] : [{ kind: 'review-output', label: 'Play the output' } as SceneAction]), { kind: 'produce', label: 'Produce again', ...producer }, revise], activity }
    }
    // Not produced, out of date, or failed: what producing waits for first.
    const again = production === 'stale' ? 'Produce it again' : production === 'failed' ? 'Produce it again' : 'Produce the scene'
    if (!scene.delivery) return { primary: { kind: 'choose-delivery', label: 'Choose how it is voiced' }, secondary: [...secondary, revise], activity }
    // A scene you present waits only on your take: none yet, one of an earlier
    // script, or one that cannot set the clock (productionWaits says why).
    if (scene.delivery === 'human' && (!takeHolds(take) || scene.productionWaits)) {
      // No take yet; a take of an earlier script (only its changed lines,
      // when it kept them); or a take that cannot set the clock.
      const earlier = Boolean(take && take.known && !take.current)
      const label = !take ? 'Record the scene' : earlier && take.changed?.length ? `Record the ${take.changed.length === 1 ? 'changed line' : `${take.changed.length} changed lines`}` : 'Record the scene again'
      return { primary: { kind: 'record', label }, secondary: [...secondary, { kind: 'produce', label: again, disabled: scene.productionWaits || 'Your take of the plan\'s lines sets the clock first' }, revise], activity }
    }
    return { primary: { kind: 'produce', label: again, ...(scene.productionWaits ? { disabled: scene.productionWaits } : producer) }, secondary: [...secondary, ...(scene.delivery === 'human' ? [{ kind: 'record', label: 'Record it again' } as SceneAction] : []), revise], activity }
  }
  // An earlier revision: looked at, never acted on here.
  const current = view.current
  return { primary: current && current.id !== shown.id ? { kind: 'show-current', label: `Show r${current.revision}`, recordId: current.id } : null, secondary, activity }
}

export type RailTone = 'idle' | 'busy' | 'new' | 'good' | 'warn' | 'bad'
// The scene's one state in the list of scenes: what it needs next.
export const railStateOf = (scene: Scene, take: TakeState): { label: string; tone: RailTone } => {
  const view = scene.view
  const revision = view.current?.revision ?? view.latest?.revision ?? 0
  // A scene not yet planned waits first on its base's designed page (the
  // chaining of the BoltDB review): being designed, or landed for it.
  const reference = scene.reference
  if (!view.latest && !view.current && !view.reviewed) {
    if (reference?.baseDesigning) return { label: 'Designing its page…', tone: 'busy' }
    if (reference?.newer && !reference.newer.designing && reference.newer.svg) return { label: 'Designed page ready', tone: 'new' }
  }
  switch (view.state) {
    case 'needs-brief':
      return { label: 'Waits for the brief', tone: 'idle' }
    case 'preparing':
      return { label: 'Waits for the brief', tone: 'busy' }
    case 'brief-failed':
      return { label: 'Brief failed', tone: 'bad' }
    case 'ready-to-plan':
      return { label: 'Plan it', tone: 'idle' }
    case 'planning':
      return { label: `Planning r${view.latest?.revision ?? revision}…`, tone: 'busy' }
    case 'failed':
      return { label: 'Plan failed', tone: 'bad' }
    case 'stale':
      return { label: 'Out of date', tone: 'warn' }
    case 'candidate': {
      const preview = previewStateOf(scene, view.current)
      if (preview.state === 'building') return { label: `Previewing r${revision}…`, tone: 'busy' }
      return { label: `Review r${revision}`, tone: 'new' }
    }
    case 'reviewed': {
      const production = productionStateOf(scene)
      if (production === 'producing') return { label: 'Producing…', tone: 'busy' }
      if (production === 'ready') return { label: 'Output to review', tone: 'new' }
      if (production === 'accepted') return { label: 'Done', tone: 'good' }
      if (production === 'stale') return { label: 'Output out of date', tone: 'warn' }
      if (production === 'failed') return { label: 'Production failed', tone: 'bad' }
      if (!scene.delivery) return { label: 'Choose a voice', tone: 'warn' }
      if (scene.delivery === 'human' && !takeHolds(take)) return { label: take ? 'Record again' : 'Record it', tone: 'warn' }
      return { label: `Approved r${revision}`, tone: 'good' }
    }
  }
  return { label: '', tone: 'idle' }
}
