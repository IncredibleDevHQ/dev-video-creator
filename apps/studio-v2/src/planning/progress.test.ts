import { describe, expect, it } from 'vitest'
import type { PlanningRecord, ProgressEvent } from './planning-records'
import { progressOf, sinceOf } from './progress'

let seq = 0
const event = (milestone: ProgressEvent['milestone'], extra: Partial<ProgressEvent> = {}): ProgressEvent => ({ seq: ++seq, at: '2026-09-26T10:00:00.000Z', milestone, ...extra })
const record = (kind: PlanningRecord['kind'], status: PlanningRecord['status'], events: ProgressEvent[] = [], draft: PlanningRecord['progress'] extends infer P ? P extends { draft: infer D } ? D : null : null = null) =>
  ({ kind, status, error: null, progress: { events, draft } }) as Pick<PlanningRecord, 'kind' | 'status' | 'progress' | 'error'>
const states = (progress: ReturnType<typeof progressOf>) => progress.phases.map(phase => `${phase.key}:${phase.state}`).join(' ')

describe('a scene plan in named phases', () => {
  it('waits, then starts, then reviews its references once it read its packet', () => {
    expect(progressOf(record('treatment', 'queued')).now).toBe('Waiting for the local harness to start')
    expect(progressOf(record('treatment', 'running', [event('started')])).now).toBe('The local harness started')
    const reading = progressOf(record('treatment', 'running', [event('started'), event('context')]))
    expect(states(reading)).toBe('reviewing:active explanation:todo moments:todo checking:todo ready:todo')
    // Nothing is invented while the harness works unseen: it says so.
    expect(reading.now).toBe('The harness read its packet. The next phase shows when it publishes part of the plan, or hands the plan in')
  })

  it('moves on the drafts it publishes, and shows them', () => {
    const explained = progressOf(record('treatment', 'running', [event('started'), event('context'), event('draft', { section: 'explanation' })], { question: 'What does the limiter do?', takeaway: 'It refuses the excess.', at: '' }))
    expect(states(explained)).toBe('reviewing:done explanation:done moments:active checking:todo ready:todo')
    expect(explained.draft?.question).toBe('What does the limiter do?')
    const moments = progressOf(record('treatment', 'running', [event('context'), event('draft', { section: 'explanation' }), event('draft', { section: 'moments', count: 2 })], { question: 'Q', takeaway: 'T', moments: [{ id: 'm1', title: 'A', summary: '' }, { id: 'm2', title: 'B', summary: '' }], at: '' }))
    expect(moments.now).toBe('2 moments drafted so far')
  })

  it('is checked when handed in, comes round again when refused, and is ready when accepted', () => {
    const handed = progressOf(record('treatment', 'running', [event('context'), event('submitted')]))
    // Handing the plan in proves its explanation and moments exist.
    expect(states(handed)).toBe('reviewing:done explanation:done moments:done checking:active ready:todo')
    const refused = progressOf(record('treatment', 'running', [event('context'), event('submitted'), event('refused', { count: 2 })]))
    expect(states(refused)).toBe('reviewing:done explanation:done moments:active checking:todo ready:todo')
    expect(refused).toMatchObject({ repairs: 1, now: 'The check found 2 problems; the harness is fixing them' })
    const ready = progressOf(record('treatment', 'candidate', [event('context'), event('submitted'), event('refused', { count: 1 }), event('submitted'), event('accepted')]))
    expect(states(ready)).toBe('reviewing:done explanation:done moments:done checking:done ready:done')
    expect(ready).toMatchObject({ finished: true, failed: false, repairs: 1, now: '' })
  })

  it('marks where a failed or replaced run stopped, keeping its draft', () => {
    const failed = progressOf(record('treatment', 'failed', [event('context'), event('draft', { section: 'explanation' }), event('failed', { note: 'quota' })], { question: 'Q', takeaway: 'T', at: '' }))
    expect(states(failed)).toBe('reviewing:done explanation:done moments:failed checking:todo ready:todo')
    expect(failed.draft?.takeaway).toBe('T')
    expect(progressOf(record('treatment', 'superseded', [event('context'), event('submitted')])).failed).toBe(true)
  })
})

describe('a preview and a production in named phases', () => {
  it('builds once the harness read its packet, then is checked in the player', () => {
    expect(states(progressOf(record('preview', 'queued')))).toBe('preparing:active building:todo checking:todo ready:todo')
    expect(states(progressOf(record('preview', 'running', [event('started'), event('context')])))).toBe('preparing:done building:active checking:todo ready:todo')
    const checking = progressOf(record('preview', 'verifying', [event('context'), event('submitted'), event('checking')]))
    expect(states(checking)).toBe('preparing:done building:done checking:active ready:todo')
    expect(checking.now).toBe('Playing the sketch in the pinned player to check it')
    expect(states(progressOf(record('preview', 'running', [event('context'), event('submitted'), event('checking'), event('refused', { count: 1 })])))).toBe('preparing:done building:active checking:todo ready:todo')
    expect(states(progressOf(record('production', 'ready', [event('context'), event('checking'), event('accepted')])))).toBe('preparing:done building:done checking:done ready:done')
  })

  it('never shows a draft for anything but a scene plan', () => {
    expect(progressOf(record('preview', 'running', [], { question: 'x', takeaway: 'y', at: '' })).draft).toBeNull()
  })
})

describe('elapsed time', () => {
  it('reads as seconds, then minutes and seconds', () => {
    const now = Date.parse('2026-09-26T10:01:05.000Z')
    expect(sinceOf('2026-09-26T10:00:50.000Z', now)).toBe('15s')
    expect(sinceOf('2026-09-26T10:00:00.000Z', now)).toBe('1:05')
    expect(sinceOf(null, now)).toBe('')
  })
})
