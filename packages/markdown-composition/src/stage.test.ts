import { describe, expect, it } from 'vitest'
import { familyForCameraMode, mergeStageOverrides, sanitizeStageTrack, stageAt, stageCss, stageTrackFromStoryboard } from './stage'

describe('stage track', () => {
  it('sanitizes, sorts and collapses repeats', () => {
    const track = sanitizeStageTrack([
      { atMs: 5000, family: 'content-pip' },
      { atMs: 0, family: 'speaker-full', treatment: 'overlay' },
      { atMs: 5000, family: 'nope' },
      { atMs: 9000, family: 'content-pip' },
      { atMs: 12000, family: 'speaker-full' },
    ])
    expect(track).toEqual([
      { atMs: 0, family: 'speaker-full', treatment: 'overlay' },
      { atMs: 5000, family: 'content-pip' },
      { atMs: 12000, family: 'speaker-full' },
    ])
    expect(stageAt(track, 0)!.family).toBe('speaker-full')
    expect(stageAt(track, 5000)!.family).toBe('content-pip')
    expect(stageAt(track, 30000)!.family).toBe('speaker-full')
  })

  it('reads the director storyboard as a track on beat offsets', () => {
    const track = stageTrackFromStoryboard(
      [
        { family: 'speaker-full', beats: [0] },
        { family: 'content-pip', beats: [1, 2] },
        { family: 'speaker-full', beats: [3] },
      ],
      [0, 4000, 9000, 15000],
    )
    expect(track.map(segment => [segment.atMs, segment.family])).toEqual([[0, 'speaker-full'], [4000, 'content-pip'], [15000, 'speaker-full']])
  })

  it('lets live overrides replace the plan from the first press on', () => {
    const plan = sanitizeStageTrack([{ atMs: 0, family: 'speaker-full' }, { atMs: 4000, family: 'content-pip' }, { atMs: 15000, family: 'speaker-full' }])
    const merged = mergeStageOverrides(plan, [{ atMs: 6000, family: 'speaker-full' }, { atMs: 9000, family: 'split' }])
    expect(merged.map(segment => [segment.atMs, segment.family])).toEqual([[0, 'speaker-full'], [4000, 'content-pip'], [6000, 'speaker-full'], [9000, 'split']])
  })

  it('maps the legacy presenter modes onto families', () => {
    expect(familyForCameraMode('information-circle', 'hidden')).toBe('content-full')
    expect(familyForCameraMode('person-only', 'full')).toBe('speaker-full')
    expect(familyForCameraMode('split', 'split-right')).toBe('split')
    expect(familyForCameraMode('portrait-rail', 'overlay-right')).toBe('content-card')
  })

  it('emits geometry for every family with transitions', () => {
    const css = stageCss()
    for (const family of ['content-full', 'speaker-full', 'speaker-panel', 'split', 'content-pip', 'content-card', 'content-cutout']) {
      expect(css).toContain(`.scene[data-stage="${family}"]`)
    }
    expect(css).toContain('transition: left .62s')
  })
})

describe('stage track from a storyboard with lead-outs', () => {
  it('places an entry a given time before the end of its beat', () => {
    const track = stageTrackFromStoryboard(
      [
        { family: 'content-pip', beats: [0, 1] },
        { family: 'speaker-panel', beats: [1], fromEndMs: 3000 },
        { family: 'speaker-full', beats: [1], fromEndMs: 1000 },
      ],
      [0, 5000],
      [5000, 8000],
    )
    expect(track.map(segment => [segment.atMs, segment.family])).toEqual([[0, 'content-pip'], [10000, 'speaker-panel'], [12000, 'speaker-full']])
  })
})
