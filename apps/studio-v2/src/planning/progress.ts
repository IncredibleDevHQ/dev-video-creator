// Where a run stands, in named phases (U3 of the scene workspace plan). Each
// phase moves only on what the product confirmed — its record's status and
// the milestones it noted: the run claimed its record, read its packet,
// published a checked draft, handed its result in, the check's answer, the
// player's check. A phase the product cannot see (a harness that publishes
// no drafts) is never shown as done before the result proves it; a repair
// after a refused result shows as the phase coming round again. Nothing
// here is a percentage or a guess from what the harness says it reads.
import { isActiveStatus, type PlanDraft, type PlanningRecord, type ProgressEvent } from './planning-records'

export type PhaseState = 'done' | 'active' | 'todo' | 'failed'
export type Phase = { key: string; label: string; state: PhaseState }
export type RunProgress = {
  phases: Phase[]
  // What is happening now, in a sentence, as progress the creator can use;
  // empty when the run is over, or when its phase already says it.
  now: string
  // What the harness itself did last, as the product noted it — the run's
  // mechanics, for its details rather than its status (step 3 of the
  // project-flow fix verification).
  detail: string
  // How many times the result was refused and repaired.
  repairs: number
  // Sections of a scene plan published as a draft, still being checked.
  draft: PlanDraft | null
  // The last milestone the product confirmed.
  last: ProgressEvent | null
  finished: boolean
  failed: boolean
}

type Kind = PlanningRecord['kind']
const PHASES: Record<Kind, Array<[string, string]>> = {
  treatment: [['reviewing', 'Reviewing the source and visual references'], ['explanation', 'Drafting the explanation'], ['moments', 'Planning the scene\'s moments'], ['checking', 'Checking the plan'], ['ready', 'Ready to review']],
  brief: [['reading', 'Reading the source and your narrative'], ['drafting', 'Drafting the explanation brief'], ['checking', 'Checking the brief'], ['ready', 'Ready']],
  preview: [['preparing', 'Preparing artwork and timing'], ['building', 'Building the animated preview'], ['checking', 'Checking playback and layout'], ['ready', 'Ready to play']],
  production: [['preparing', 'Preparing the clock and the artwork'], ['building', 'Building the scene'], ['checking', 'Checking playback against the clock'], ['ready', 'Ready to review']],
}
// Where the work goes back to when the product refuses a result.
const REPAIR: Record<Kind, string> = { treatment: 'moments', brief: 'drafting', preview: 'building', production: 'building' }

export const progressOf = (record: Pick<PlanningRecord, 'kind' | 'status' | 'progress' | 'error'>): RunProgress => {
  const plan = PHASES[record.kind] || PHASES.treatment
  const keys = plan.map(([key]) => key)
  const events = record.progress?.events || []
  const draft = record.kind === 'treatment' ? record.progress?.draft || null : null
  const has = (milestone: ProgressEvent['milestone']) => events.some(event => event.milestone === milestone)
  const last = events[events.length - 1] || null
  const repairs = events.filter(event => event.milestone === 'refused').length
  const finished = !isActiveStatus(record.status)
  // Ended without a result: failed, stopped, or replaced by a newer run.
  const failed = finished && !['candidate', 'ready', 'reviewed'].includes(record.status)
  // The phase the run is in, as far as the product can tell.
  let at: string
  let now: string
  let detail = ''
  if (!finished) {
    const lastSubmission = [...events].reverse().find(event => ['submitted', 'refused', 'checking'].includes(event.milestone))
    if (record.status === 'verifying' || lastSubmission?.milestone === 'checking') {
      at = 'checking'
      now = record.kind === 'preview' ? 'Playing the sketch in the pinned player to check it' : record.kind === 'production' ? 'Playing the scene in the pinned player, on its clock' : 'Checking it'
    } else if (lastSubmission?.milestone === 'submitted') {
      at = 'checking'
      now = 'The harness handed its result in; the product is checking it'
    } else if (lastSubmission?.milestone === 'refused') {
      at = REPAIR[record.kind]
      now = `The check found ${lastSubmission.count ?? 'some'} problem${lastSubmission.count === 1 ? '' : 's'}; the harness is fixing ${lastSubmission.count === 1 ? 'it' : 'them'}`
    } else if (record.kind === 'treatment' && draft?.moments?.length) {
      at = 'moments'
      now = `${draft.moments.length} moment${draft.moments.length === 1 ? '' : 's'} drafted so far`
    } else if (record.kind === 'treatment' && draft?.question) {
      at = 'moments'
      now = 'The explanation is drafted; the harness is planning the moments'
    } else if (has('context')) {
      at = keys[record.kind === 'preview' || record.kind === 'production' ? 1 : 0]
      // What the product cannot see, it says: a harness that publishes no
      // drafts moves the phases only when it hands the plan in.
      now = record.kind === 'treatment' ? 'The next phase shows when part of the plan is published, or the plan is handed in' : ''
      detail = record.kind === 'treatment' ? 'The harness read its packet' : 'The harness read its packet and is working'
    } else if (record.status === 'running' || has('started')) {
      at = keys[0]
      now = ''
      detail = 'The local harness started'
    } else {
      at = keys[0]
      now = 'Waiting for the local harness to start'
    }
  } else {
    at = failed ? phaseAfter(record.kind, events.filter(event => !['failed', 'stopped', 'accepted'].includes(event.milestone))) : 'ready'
    now = ''
  }
  const position = keys.indexOf(at)
  const phases: Phase[] = plan.map(([key, label], index) => ({
    key,
    label,
    state: failed && index === position ? 'failed' : finished && !failed ? 'done' : index < position ? 'done' : index === position ? 'active' : 'todo',
  }))
  return { phases, now, detail, repairs, draft, last, finished, failed }
}

// Where a run that ended stood when it ended: the phase its last milestone
// put it in.
const phaseAfter = (kind: Kind, events: ProgressEvent[]) => {
  const keys = (PHASES[kind] || PHASES.treatment).map(([key]) => key)
  const last = [...events].reverse().find(event => event.milestone !== 'started')
  if (!last) return keys[0]
  if (last.milestone === 'checking' || last.milestone === 'submitted') return 'checking'
  if (last.milestone === 'refused') return REPAIR[kind]
  if (last.milestone === 'draft') return 'moments'
  if (last.milestone === 'context') return keys[kind === 'preview' || kind === 'production' ? 1 : 0]
  return keys[0]
}

// How long since a moment, in minutes and seconds.
export const sinceOf = (iso: string | null | undefined, now = Date.now()) => {
  const at = iso ? Date.parse(iso) : NaN
  if (!Number.isFinite(at)) return ''
  const seconds = Math.max(0, Math.round((now - at) / 1000))
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
