import { describe, expect, it } from 'vitest'
import { createStageChoices, defaultStageView, handOffFor, type PreviewWait, type StageNow } from './preview-intent'

const wait: PreviewWait = { projectId: 'v1', sceneId: 's1', planRecordId: 't2', revision: 2, previewJobId: 'p9', generation: 3 }
const now: StageNow = { projectId: 'v1', selectedScene: 's1', shownPlanRecord: 't2', generation: 3, busy: false }
const ready = { status: 'ready', current: true } as const

describe('handing a finished preview to the stage', () => {
  it('loads it for a creator still waiting on that scene and revision', () => {
    expect(handOffFor(wait, ready, now)).toBe('load')
  })

  it('keeps waiting while it builds, or while another notebook is open', () => {
    expect(handOffFor(wait, { status: 'building' }, now)).toBe('wait')
    expect(handOffFor(wait, ready, { ...now, projectId: 'v2' })).toBe('wait')
  })

  it('offers it when the creator chose another view or revision since asking', () => {
    expect(handOffFor(wait, ready, { ...now, generation: 4 })).toBe('offer')
    expect(handOffFor(wait, ready, { ...now, shownPlanRecord: 't1' })).toBe('offer')
  })

  it('never navigates: another scene on show only hears it is ready', () => {
    expect(handOffFor(wait, ready, { ...now, selectedScene: 's2' })).toBe('elsewhere')
  })

  it('lets a recording or a playback go on, then offers rather than loads', () => {
    expect(handOffFor(wait, ready, { ...now, busy: true })).toBe('hold')
    expect(handOffFor({ ...wait, interrupted: true }, ready, now)).toBe('offer')
  })

  it('keeps a failed, out-of-date or replaced preview as history only', () => {
    expect(handOffFor(wait, { status: 'failed' }, now)).toBe('drop')
    expect(handOffFor(wait, { status: 'gone' }, now)).toBe('drop')
    expect(handOffFor(wait, { status: 'ready', current: false }, now)).toBe('drop')
  })
})

describe('the stage choices kept per scene', () => {
  const memory = () => {
    const values = new Map<string, string>()
    return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => void values.set(key, value) }
  }

  it('advances a scene\'s generation with every explicit choice, and keeps the choice', () => {
    const store = memory()
    const choices = createStageChoices(() => store, () => 'v1')
    expect(choices.generation('s1')).toBe(0)
    expect(choices.chosen('s1')).toBeNull()
    choices.choose('s1', 'reference')
    choices.choose('s1', 'preview')
    expect(choices.generation('s1')).toBe(2)
    expect(choices.chosen('s1')).toBe('preview')
    expect(choices.generation('s2')).toBe(0)
    // Another notebook keeps its own.
    expect(createStageChoices(() => store, () => 'v2').generation('s1')).toBe(0)
  })

  it('remembers one waiting preview per scene across a reopen, and forgets it when settled', () => {
    const store = memory()
    createStageChoices(() => store, () => 'v1').wait(wait)
    const reopened = createStageChoices(() => store, () => 'v1')
    expect(reopened.waiting('s1')).toEqual(wait)
    reopened.wait({ ...wait, previewJobId: 'p10', revision: 3, planRecordId: 't3' })
    expect(reopened.waits()).toHaveLength(1)
    expect(reopened.waiting('s1')?.previewJobId).toBe('p10')
    reopened.update('s1', { interrupted: true })
    expect(reopened.waiting('s1')?.interrupted).toBe(true)
    reopened.clear('s1')
    expect(reopened.waits()).toEqual([])
  })

  it('survives storage that is missing or refuses', () => {
    const choices = createStageChoices(() => null, () => 'v1')
    choices.choose('s1', 'preview')
    expect(choices.generation('s1')).toBe(0)
    const broken = createStageChoices(() => ({ getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }), () => 'v1')
    expect(() => broken.wait(wait)).not.toThrow()
    expect(broken.waits()).toEqual([])
  })

  it('opens a scene on its production, else its preview, else its reference', () => {
    expect(defaultStageView({ produced: true, preview: true })).toBe('output')
    expect(defaultStageView({ produced: false, preview: true })).toBe('preview')
    expect(defaultStageView({ produced: false, preview: false })).toBe('reference')
  })
})
