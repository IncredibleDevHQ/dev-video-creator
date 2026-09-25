import { describe, expect, it } from 'vitest'
import type { PlanningRecord } from './planning-records'
import { railStateOf, sceneActionsOf, shownRecordOf, type Scene, type SceneActionInput } from './scene-state'

const record = (id: string, revision: number, status: PlanningRecord['status'], kind: PlanningRecord['kind'] = 'treatment') =>
  ({ id, kind, subject: 's1', revision, status, content: kind === 'treatment' ? { moments: [] } : null, error: null }) as unknown as PlanningRecord
const r1 = record('t1', 1, 'reviewed')
const r2 = record('t2', 2, 'candidate')
const scene = (view: Partial<Scene['view']>, extra: Partial<Scene> = {}): Scene =>
  ({ id: 's1', title: 'Rate limits', index: 0, originScenes: ['b1'], script: '', direction: '', delivery: 'generated', view: { state: 'ready-to-plan', latest: null, reviewed: null, current: null, staleBecause: null, ...view }, ...extra }) as Scene
const brief = { ready: true, stale: false, preparing: false, failed: false }
const act = (input: Partial<SceneActionInput> & { scene: Scene }) => sceneActionsOf({ shown: null, brief, take: null, desktop: true, available: true, ...input })
const preview = (treatmentId: string, status: string, ready?: { current: boolean }) => ({
  latest: { id: `p-${treatmentId}`, status, revision: 1, error: null, runId: null, treatmentId },
  ready: null,
  byTreatment: ready ? { [treatmentId]: { id: `p-${treatmentId}`, url: '/p', of: { record: treatmentId, revision: 2 }, current: ready.current, staleBecause: null, summary: { duration: 8, moments: [], layers: [], provisional: [] }, warnings: [], adapter: null, model: null, checked: null } } : {},
}) as unknown as Scene['preview']
const production = (status: string, ready?: { accepted?: boolean; current?: boolean }, accepted?: { current: boolean }) => {
  const view = (id: string, current: boolean, isAccepted: boolean) => ({ id, url: `/x/${id}`, of: { record: 't1', revision: 1 }, current, staleBecause: current ? null : 'the plan changed', summary: { duration: 8, clock: 'generated-voice', moments: [], layers: [], unmet: [], controls: [] }, warnings: [], adapter: null, model: null, checked: null, voice: null, clockReview: [], accepted: isAccepted ? { at: '', url: '', durationMs: 8000, bundle: '', edits: 0 } : null, edits: { revision: 0, values: {}, updatedAt: null, carried: null } })
  return {
    latest: { id: 'x-latest', status, revision: 1, error: null, runId: null, treatmentId: 't1' },
    ready: ready ? view('x-ready', ready.current ?? true, Boolean(ready.accepted)) : null,
    accepted: accepted ? view('x-accepted', accepted.current, true) : null,
  } as unknown as Scene['production']
}

describe('the one action for the revision on show', () => {
  it('starts with the brief, then the plan — never a disabled approval form', () => {
    expect(act({ scene: scene({ state: 'needs-brief' }) }).primary).toMatchObject({ kind: 'prepare-brief', label: 'Prepare the brief' })
    expect(act({ scene: scene({ state: 'brief-failed' }) }).primary).toMatchObject({ kind: 'prepare-brief', label: 'Retry the brief' })
    expect(act({ scene: scene({ state: 'preparing' }), brief: { ...brief, ready: false, preparing: true, recordId: 'b1' } })).toMatchObject({ primary: null, activity: { kind: 'brief', recordId: 'b1' } })
    expect(act({ scene: scene({ state: 'ready-to-plan' }) }).primary).toMatchObject({ kind: 'plan', label: 'Plan the scene' })
    expect(act({ scene: scene({ state: 'ready-to-plan' }), brief: { ...brief, stale: true } }).primary).toMatchObject({ kind: 'plan', disabled: 'Prepare the brief again first' })
    expect(act({ scene: scene({ state: 'ready-to-plan' }), desktop: false }).primary?.disabled).toBe('Runs in the desktop app')
  })

  it('shows a plan being made as activity, with a way to stop it, and keeps the approved plan workable', () => {
    const planning = record('t3', 3, 'running')
    const first = act({ scene: scene({ state: 'planning', latest: planning }) })
    expect(first).toMatchObject({ primary: null, activity: { kind: 'planning', label: 'Planning r3', recordId: 't3' } })
    expect(first.secondary).toEqual([{ kind: 'stop', label: 'Stop planning', recordId: 't3' }])
    // r1 is approved while r3 is planned: producing r1 is still its own step.
    const kept = act({ scene: scene({ state: 'planning', latest: planning, reviewed: r1, current: r1 }), shown: r1 })
    expect(kept.primary).toMatchObject({ kind: 'produce', label: 'Produce the scene' })
    expect(kept.activity).toMatchObject({ kind: 'planning', recordId: 't3' })
  })

  it('previews a candidate, then approves it; approving without a preview is an explicit second choice', () => {
    const view = { state: 'candidate' as const, latest: r2, current: r2, reviewed: r1 }
    const none = act({ scene: scene(view), shown: r2 })
    expect(none.primary).toMatchObject({ kind: 'preview', label: 'Preview r2', recordId: 't2' })
    expect(none.secondary.map(action => action.label)).toEqual(['Approve r2 without a preview', 'Revise the plan'])
    const building = act({ scene: scene(view, { preview: preview('t2', 'verifying') }), shown: r2 })
    expect(building).toMatchObject({ primary: null, activity: { kind: 'preview', label: 'Checking the preview of r2', checking: true } })
    expect(building.secondary.map(action => action.kind)).toEqual(['stop', 'approve-unpreviewed', 'revise'])
    expect(building.secondary[0]).toMatchObject({ label: 'Stop the preview', recordId: 'p-t2' })
    const ready = act({ scene: scene(view, { preview: preview('t2', 'ready', { current: true }) }), shown: r2 })
    expect(ready.primary).toMatchObject({ kind: 'approve', label: 'Approve r2' })
    expect(ready.secondary.map(action => action.kind)).toEqual(['show-preview', 'revise'])
    expect(act({ scene: scene(view, { preview: preview('t2', 'ready', { current: true }) }), shown: r2, stage: 'preview' }).secondary.map(action => action.kind)).toEqual(['revise'])
    expect(act({ scene: scene(view, { preview: preview('t2', 'ready', { current: false }) }), shown: r2 }).primary?.label).toBe('Preview r2 again')
    expect(act({ scene: scene(view, { preview: preview('t2', 'failed') }), shown: r2 }).primary?.label).toBe('Preview r2 again')
    expect(act({ scene: scene(view), shown: r2, desktop: false }).primary?.disabled).toBe('Runs in the desktop app')
  })

  it('asks for what producing needs first: a voice, then your take — naming only the changed lines', () => {
    const approved = { state: 'reviewed' as const, latest: r1, current: r1, reviewed: r1 }
    expect(act({ scene: scene(approved, { delivery: null }), shown: r1 }).primary).toMatchObject({ kind: 'choose-delivery' })
    // productionWaits always says why a scene you present waits for its take.
    const human = scene(approved, { delivery: 'human', productionWaits: 'Record and select a take of this scene first.' })
    const noTake = act({ scene: human, shown: r1 })
    expect(noTake.primary).toMatchObject({ kind: 'record', label: 'Record the scene' })
    expect(noTake.secondary[0]).toMatchObject({ kind: 'produce', disabled: 'Record and select a take of this scene first.' })
    expect(act({ scene: human, shown: r1, take: { known: true, current: false, revision: 1, changed: ['The limit bites.'], dropped: 0 } }).primary?.label).toBe('Record the changed line')
    expect(act({ scene: human, shown: r1, take: { known: true, current: false, revision: 1, changed: null, dropped: 2 } }).primary?.label).toBe('Record the scene again')
    expect(act({ scene: scene(approved, { delivery: 'human', productionWaits: 'Your take does not say the plan\'s line “x”.' }), shown: r1, take: { known: true, current: true, revision: 1, changed: [], dropped: 0 } }).primary).toMatchObject({ kind: 'record', label: 'Record the scene again' })
    const ready = act({ scene: scene(approved, { delivery: 'human' }), shown: r1, take: { known: true, current: true, revision: 1, changed: [], dropped: 0 } })
    expect(ready.primary).toMatchObject({ kind: 'produce', label: 'Produce the scene' })
    expect(ready.secondary[0]).toMatchObject({ kind: 'record', label: 'Record it again' })
  })

  it('produces, then reviews the output and accepts it where it plays', () => {
    const approved = { state: 'reviewed' as const, latest: r1, current: r1, reviewed: r1 }
    expect(act({ scene: scene(approved), shown: r1 }).primary).toMatchObject({ kind: 'produce', label: 'Produce the scene' })
    const producing = act({ scene: scene(approved, { production: production('running') }), shown: r1 })
    expect(producing).toMatchObject({ primary: null, activity: { kind: 'production', label: 'Producing the scene from r1' } })
    expect(producing.secondary[0]).toMatchObject({ kind: 'stop', label: 'Stop producing', recordId: 'x-latest' })
    expect(act({ scene: scene(approved, { production: production('ready', {}) }), shown: r1 }).primary).toMatchObject({ kind: 'review-output', recordId: 'x-ready' })
    expect(act({ scene: scene(approved, { production: production('ready', {}) }), shown: r1, stage: 'output' }).primary).toMatchObject({ kind: 'accept', label: 'Accept as the scene\'s output' })
    const accepted = act({ scene: scene(approved, { production: production('reviewed', undefined, { current: true }) }), shown: r1 })
    expect(accepted.primary).toBeNull()
    expect(accepted.secondary.map(action => action.label)).toEqual(['Play the output', 'Produce again', 'Revise the plan'])
    expect(act({ scene: scene(approved, { production: production('reviewed', undefined, { current: false }) }), shown: r1 }).primary?.label).toBe('Produce it again')
    expect(act({ scene: scene(approved, { production: production('ready', {}) }), shown: r1, desktop: false }).secondary[0]).toMatchObject({ kind: 'produce', disabled: 'Runs in the desktop app' })
  })

  it('keeps the approved plan on show while a newer candidate lands, and offers the candidate', () => {
    const approved = { state: 'candidate' as const, latest: r2, current: r2, reviewed: r1 }
    const kept = act({ scene: scene(approved), shown: r1 })
    expect(kept.primary).toMatchObject({ kind: 'produce' })
    expect(kept.secondary[0]).toEqual({ kind: 'show-current', label: 'Review r2', recordId: 't2' })
  })

  it('plans again when the plan on show is out of date, and only looks at an earlier revision', () => {
    expect(act({ scene: scene({ state: 'stale', latest: r1, current: r1, reviewed: r1, staleBecause: 'the brief changed' }), shown: r1 }).primary).toMatchObject({ kind: 'revise', label: 'Plan again from the current inputs' })
    const earlier = record('t0', 0, 'reviewed')
    expect(act({ scene: scene({ state: 'candidate', latest: r2, current: r2, reviewed: r1 }), shown: earlier }).primary).toMatchObject({ kind: 'show-current', label: 'Show r2' })
  })
})

describe('a scene in the list of scenes', () => {
  it('shows the one thing it needs next', () => {
    expect(railStateOf(scene({ state: 'ready-to-plan' }), null)).toEqual({ label: 'Plan it', tone: 'idle' })
    expect(railStateOf(scene({ state: 'planning', latest: record('t3', 3, 'running') }), null)).toEqual({ label: 'Planning r3…', tone: 'busy' })
    expect(railStateOf(scene({ state: 'candidate', latest: r2, current: r2 }, { preview: preview('t2', 'running') }), null)).toEqual({ label: 'Previewing r2…', tone: 'busy' })
    expect(railStateOf(scene({ state: 'candidate', latest: r2, current: r2 }), null)).toEqual({ label: 'Review r2', tone: 'new' })
    const approved = { state: 'reviewed' as const, latest: r1, current: r1, reviewed: r1 }
    expect(railStateOf(scene(approved, { delivery: 'human' }), null)).toEqual({ label: 'Record it', tone: 'warn' })
    expect(railStateOf(scene(approved), null)).toEqual({ label: 'Approved r1', tone: 'good' })
    expect(railStateOf(scene(approved, { production: production('ready', {}) }), null)).toEqual({ label: 'Output to review', tone: 'new' })
    expect(railStateOf(scene(approved, { production: production('reviewed', undefined, { current: true }) }), null)).toEqual({ label: 'Done', tone: 'good' })
  })

  it('keeps the chosen revision on show, else the current plan', () => {
    const records = [r1, r2]
    const row = scene({ state: 'candidate', latest: r2, current: r2, reviewed: r1 })
    expect(shownRecordOf(row, records, 't1')?.id).toBe('t1')
    expect(shownRecordOf(row, records, '')?.id).toBe('t2')
    expect(shownRecordOf(row, records, 'gone')?.id).toBe('t2')
  })
})
