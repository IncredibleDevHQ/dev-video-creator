import { describe, expect, it } from 'vitest'
import { baseNextStep, videoNextStep, type VideoScene } from './next-step'

const scene = (index: number, state: VideoScene['state'], extra: Partial<VideoScene> = {}): VideoScene => ({ id: `s${index + 1}`, index, title: `Scene ${index + 1}`, state, delivery: 'generated', take: 'none', ...extra })
const ready = { ready: true, stale: false, preparing: false, failed: false }

describe('the one next step of a notebook', () => {
  it('offers a base its video: to start one, to create it, or to open it', () => {
    expect(baseNextStep({ pages: 0, videos: [] }).action).toBe('create-explainer')
    expect(baseNextStep({ pages: 3, videos: [] })).toMatchObject({ action: 'create-video', label: 'Create video' })
    expect(baseNextStep({ pages: 3, videos: [{ id: 'v2', title: 'The video' }, { id: 'v1', title: 'Older' }] })).toMatchObject({ action: 'open-video', label: 'Open video' })
    // A base with a video leads to it, whatever its pages are.
    expect(baseNextStep({ pages: 0, videos: [{ id: 'v1', title: 'The video' }] })).toMatchObject({ action: 'open-video' })
  })

  it('starts a video with its brief', () => {
    const scenes = [scene(0, 'needs-brief')]
    expect(videoNextStep({ scenes, brief: { ...ready, ready: false }, selected: null, desktop: true })).toMatchObject({ action: 'brief', label: 'Prepare the brief', disabled: false })
    expect(videoNextStep({ scenes, brief: { ...ready, stale: true }, selected: null, desktop: true })).toMatchObject({ action: 'brief', label: 'Update the brief' })
    expect(videoNextStep({ scenes, brief: { ...ready, ready: false, preparing: true }, selected: null, desktop: true })).toMatchObject({ action: 'wait', disabled: true })
    // In a browser the step is named, and waits for the desktop app.
    expect(videoNextStep({ scenes, brief: { ...ready, ready: false }, selected: null, desktop: false })).toMatchObject({ action: 'brief', disabled: true })
  })

  it('follows the selected scene: plan, review, record', () => {
    const selected = 's2'
    expect(videoNextStep({ scenes: [scene(0, 'reviewed'), scene(1, 'ready-to-plan')], brief: ready, selected, desktop: true })).toMatchObject({ action: 'plan', label: 'Plan scene 2', sceneId: 's2' })
    expect(videoNextStep({ scenes: [scene(0, 'reviewed'), scene(1, 'stale')], brief: ready, selected, desktop: true })).toMatchObject({ action: 'plan', label: 'Revise scene 2' })
    expect(videoNextStep({ scenes: [scene(0, 'reviewed'), scene(1, 'candidate')], brief: ready, selected, desktop: true })).toMatchObject({ action: 'review', label: 'Review scene 2' })
    expect(videoNextStep({ scenes: [scene(0, 'reviewed'), scene(1, 'reviewed', { delivery: 'human' })], brief: ready, selected, desktop: true })).toMatchObject({ action: 'record', label: 'Record scene 2' })
    expect(videoNextStep({ scenes: [scene(0, 'reviewed'), scene(1, 'reviewed', { delivery: 'human', take: 'earlier' })], brief: ready, selected, desktop: true })).toMatchObject({ action: 'record', label: 'Re-record scene 2' })
  })

  it('moves on from a scene that needs nothing, round to the start, and waits only when nothing else can be done', () => {
    const done = { production: 'accepted', produced: true } as const
    const scenes = [scene(0, 'candidate'), scene(1, 'reviewed', done), scene(2, 'planning')]
    expect(videoNextStep({ scenes, brief: ready, selected: 's2', desktop: true })).toMatchObject({ action: 'review', label: 'Review scene 1', sceneId: 's1' })
    expect(videoNextStep({ scenes: [scene(0, 'reviewed', done), scene(1, 'planning')], brief: ready, selected: 's1', desktop: true })).toMatchObject({ action: 'wait', label: 'Planning scene 2…', disabled: true })
  })

  it('produces an approved scene with a generated voice or silence, then asks for its output to be reviewed', () => {
    const at = (extra: Partial<VideoScene>) => videoNextStep({ scenes: [scene(0, 'reviewed', extra)], brief: ready, selected: 's1', desktop: true })
    expect(at({})).toMatchObject({ action: 'produce', label: 'Produce scene 1', sceneId: 's1', disabled: false })
    expect(at({ delivery: 'silent', production: 'failed' })).toMatchObject({ action: 'produce', label: 'Produce scene 1' })
    expect(at({ production: 'failed' }).title).toMatch(/last attempt failed/)
    expect(at({ production: 'producing' })).toMatchObject({ action: 'wait', label: 'Producing scene 1…', disabled: true })
    expect(at({ production: 'ready' })).toMatchObject({ action: 'review-output', label: 'Review scene 1 output' })
    expect(at({ production: 'stale', produced: true })).toMatchObject({ action: 'produce', label: 'Produce scene 1 again' })
    // In a browser the step is named, and waits for the desktop app.
    expect(videoNextStep({ scenes: [scene(0, 'reviewed')], brief: ready, selected: 's1', desktop: false })).toMatchObject({ action: 'produce', disabled: true })
  })

  it('produces a scene you present once your take is in, and asks for it again when it cannot set the clock', () => {
    const presented = (extra: Partial<VideoScene>) => videoNextStep({ scenes: [scene(0, 'reviewed', { delivery: 'human', take: 'current', ...extra })], brief: ready, selected: 's1', desktop: true })
    expect(presented({})).toMatchObject({ action: 'produce', label: 'Produce scene 1' })
    expect(presented({ production: 'ready' })).toMatchObject({ action: 'review-output' })
    const off = presented({ productionWaits: 'Your take was not recorded against the approved plan\'s lines.' })
    expect(off).toMatchObject({ action: 'record', label: 'Re-record scene 1' })
    expect(off.title).toMatch(/cannot be produced from your take yet: Your take was not recorded/)
    // Once produced, the take is not asked for again.
    expect(presented({ production: 'accepted', produced: true, productionWaits: 'anything' })).toMatchObject({ action: 'export', label: 'Export video' })
  })

  it('names what production waits for, and moves on to a scene that can go ahead', () => {
    const waits = scene(0, 'reviewed', { productionWaits: 'Choose how this scene is delivered.' })
    const alone = videoNextStep({ scenes: [waits], brief: ready, selected: 's1', desktop: true })
    expect(alone).toMatchObject({ action: 'produce', disabled: true })
    expect(alone.title).toMatch(/cannot be produced yet: Choose how this scene is delivered/)
    expect(videoNextStep({ scenes: [waits, scene(1, 'candidate')], brief: ready, selected: 's1', desktop: true })).toMatchObject({ action: 'review', sceneId: 's2' })
  })

  it('ends at the export: the video once every scene plays its accepted production, a draft that says so otherwise', () => {
    const done = { production: 'accepted', produced: true } as const
    const all = videoNextStep({ scenes: [scene(0, 'reviewed', done), scene(1, 'reviewed', { ...done, delivery: 'silent' })], brief: ready, selected: 's1', desktop: true })
    expect(all).toMatchObject({ action: 'export', label: 'Export video', disabled: false })
    // The second scene's production is accepted, but the notebook plays its own scene.
    const some = videoNextStep({ scenes: [scene(0, 'reviewed', done), scene(1, 'reviewed', { delivery: 'human', take: 'current', production: 'accepted', produced: false })], brief: ready, selected: 's1', desktop: true })
    expect(some).toMatchObject({ action: 'export', label: 'Export draft' })
    expect(some.title).toMatch(/1 of 2 scenes play the production you accepted/)
    // Accepted, but the creator stopped using it: the notebook's own scene plays.
    const released = videoNextStep({ scenes: [scene(0, 'reviewed', { production: 'accepted', produced: false })], brief: ready, selected: 's1', desktop: true })
    expect(released).toMatchObject({ action: 'export', label: 'Export draft' })
    expect(released.title).toMatch(/No scene plays a production/)
  })
})
