import { describe, expect, it } from 'vitest'
import { stageTrackFromStoryboard } from 'markdown-composition'
import { planShots, recordingBriefFor, stageTrackFromShots, validateShots } from './shot-plan'
import type { StoryboardEntry } from './director'
import type { ScriptBeat } from './script-plan'

const beat = (index: number, title: string, text: string): ScriptBeat =>
  ({ index, title, text, directions: [] }) as unknown as ScriptBeat

const beats = [
  beat(0, 'Why storms happen', 'When the service comes back, every client retries at once.'),
  beat(1, 'The burst', 'Several requests converge on the recovering service and it falls over again.'),
  beat(2, 'Backoff with jitter', 'Each client waits a different interval, so arrivals spread out.'),
]

const storyboard: StoryboardEntry[] = [
  { label: 'Open', family: 'speaker-full', note: 'You, full frame', beats: [0], why: 'the first line belongs to your face' },
  { label: 'The burst', family: 'content-card', note: 'requests converge', beats: [1], why: 'the mechanism needs the frame' },
  { label: 'Backoff with jitter', family: 'speaker-panel', note: 'beside the mechanism', beats: [2], why: 'explain the fix beside the settled result' },
]

describe('planShots', () => {
  const shots = planShots(storyboard, beats)

  it('maps the storyboard to views: speaker leads, mechanism takes over, then shared', () => {
    expect(shots.map(shot => shot.view)).toEqual(['camera-full', 'animation-full', 'shared'])
    expect(shots.map(shot => shot.focus)).toEqual(['speaker', 'mechanism', 'shared'])
  })

  it('chooses transitions from the relationship: expand into animation, cut back to the speaker', () => {
    expect(shots[0].transitionOut).toEqual({ kind: 'object-expand', durationMs: 450 })
    expect(shots[1].transitionOut).toEqual({ kind: 'cut', durationMs: 250 })
    expect(shots[2].transitionOut).toEqual({ kind: 'hold', durationMs: 0 })
  })

  it('carries a short headline as emphasis only on camera-led shots', () => {
    expect(shots[0].emphasis).toBe('Why storms happen')
    expect(shots[1].emphasis).toBeUndefined()
  })

  it('keeps every reason with its shot', () => {
    expect(shots[1].reason).toBe('the mechanism needs the frame')
  })

  it('passes its own coherence check', () => {
    expect(validateShots(shots, beats.length)).toEqual([])
  })

  it('holds on a stable composition instead of switching for novelty', () => {
    const stable: StoryboardEntry[] = [
      { label: 'One', family: 'speaker-panel', note: '', beats: [0] },
      { label: 'Two', family: 'speaker-panel', note: '', beats: [1, 2] },
    ]
    const same = planShots(stable, beats)
    expect(same[0].transitionOut).toEqual({ kind: 'hold', durationMs: 0 })
  })
})

describe('stageTrackFromShots', () => {
  const offsets = [0, 5000, 12000]
  const durations = [5000, 7000, 6000]
  const geometry = (track: ReturnType<typeof stageTrackFromShots>) => track.map(({ transitionIn: _transitionIn, ...rest }) => rest)

  it('produces the track the storyboard would, from the applied shot plan', () => {
    expect(geometry(stageTrackFromShots(planShots(storyboard, beats), offsets, durations)))
      .toEqual(stageTrackFromStoryboard(storyboard, offsets, durations))
  })

  it('honours a lead-out entry the same way', () => {
    const withLead: StoryboardEntry[] = [
      ...storyboard.slice(0, 2),
      { label: 'Lead', family: 'speaker-full', note: 'you alone', beats: [2], fromEndMs: 1100 },
    ]
    expect(geometry(stageTrackFromShots(planShots(withLead, beats), offsets, durations)))
      .toEqual(stageTrackFromStoryboard(withLead, offsets, durations))
  })

  it('carries the boundary treatment from the outgoing shot onto the incoming segment', () => {
    const track = stageTrackFromShots(planShots(storyboard, beats), offsets, durations)
    expect(track[0].transitionIn).toBeUndefined()
    expect(track[1].transitionIn).toEqual({ kind: 'object-expand', durationMs: 450 })
    expect(track[2].transitionIn).toEqual({ kind: 'cut', durationMs: 250 })
  })

  it('writes nothing for a hold boundary', () => {
    const stable: StoryboardEntry[] = [
      { label: 'One', family: 'speaker-panel', note: '', beats: [0] },
      { label: 'Two', family: 'speaker-panel', note: '', beats: [1, 2] },
    ]
    const track = stageTrackFromShots(planShots(stable, beats), offsets, durations)
    expect(track.every(segment => !segment.transitionIn)).toBe(true)
  })
})

describe('validateShots', () => {
  it('catches a beat in two shots, a gap, and a runaway transition', () => {
    const shots = planShots(storyboard, beats)
    const broken = [
      { ...shots[0], beats: [0, 1] },
      { ...shots[1], beats: [1], transitionOut: { kind: 'dissolve' as const, durationMs: 900 } },
    ]
    const problems = validateShots(broken, beats.length)
    expect(problems.some(problem => problem.includes('two shots'))).toBe(true)
    expect(problems.some(problem => problem.includes('beat 2 is in no shot'))).toBe(true)
    expect(problems.some(problem => problem.includes('900 ms'))).toBe(true)
  })
})

describe('recordingBriefFor', () => {
  it('turns the shot plan into scene guidance', () => {
    const shots = planShots(storyboard, beats)
    const brief = recordingBriefFor(shots, beats, { arcRole: 'build', kind: 'diagram' })
    expect(brief.objective).toBe('build: diagram')
    expect(brief.say).toHaveLength(3)
    expect(brief.shots[0].record).toContain('lens')
    expect(brief.shots[1].record).toContain('voice continues')
    expect(brief.next).toContain('voice continues')
  })

  it('says so when the speaker holds the frame throughout', () => {
    const allSpeaker: StoryboardEntry[] = [
      { label: 'One', family: 'speaker-full', note: '', beats: [0] },
      { label: 'Two', family: 'speaker-full', note: '', beats: [1, 2] },
    ]
    const brief = recordingBriefFor(planShots(allSpeaker, beats), beats, { arcRole: 'hook', kind: 'title' })
    expect(brief.next).toBe('You hold the frame throughout.')
  })
})
