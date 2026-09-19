// The shot layer (D6): a scene is a sequence of shots, each with a focal
// subject, a view, an explicit boundary transition, and a reason — chosen
// from the director's scored storyboard, not a fixed template. The recording
// brief turns the same plan into per-scene guidance for the person.
// Transitions keep spoken audio continuous and never reset object state;
// they are validated as a small, coherent vocabulary.
import type { StoryboardEntry } from './director'
import type { ScriptBeat } from './script-plan'
import { isStageFamily, isStageTreatment, isStageVariant, sanitizeStageTrack, type StageSegment, type StageVariant } from 'markdown-composition'

export type ShotFocus = 'speaker' | 'mechanism' | 'shared'
export type ShotView = 'camera-full' | 'camera-text' | 'shared' | 'animation-full'
export type ShotTransitionKind = 'hold' | 'cut' | 'reframe' | 'object-expand' | 'reveal' | 'dissolve'

export type DirectedShot = {
  id: string
  beats: number[]
  focus: ShotFocus
  view: ShotView
  // The existing stage family this view maps onto (D6): the renderer plays
  // the stage families; the shot layer never creates a second one.
  stage: { family: string; treatment?: string; variant?: string; fromEndMs?: number }
  // A sparse, deliberate headline in safe space; only camera-led shots carry one.
  emphasis?: string
  transitionOut: { kind: ShotTransitionKind; durationMs: number }
  reason: string
}

// The stage family becomes the view: the person leads (camera), shares the
// frame, or hands it to the mechanism.
const viewFor = (entry: StoryboardEntry): { view: ShotView; focus: ShotFocus } => {
  if (entry.family === 'speaker-full') {
    if (entry.treatment) return { view: 'camera-text', focus: 'speaker' }
    return { view: 'camera-full', focus: 'speaker' }
  }
  if (entry.family === 'speaker-panel' || entry.family === 'speaker-lead' || entry.family === 'split') {
    return { view: 'shared', focus: 'shared' }
  }
  return { view: 'animation-full', focus: 'mechanism' }
}

// The transition belongs to the relationship between the outgoing and
// incoming attention. Durations are restrained; a clean cut is always valid.
const transitionBetween = (out: ShotView, into: ShotView): { kind: ShotTransitionKind; durationMs: number } => {
  if (out === into) return { kind: 'hold', durationMs: 0 }
  if (out === 'animation-full' || into === 'animation-full') {
    // The mechanism being discussed expands into the frame; the speaker
    // returns on a clean cut once the result is visible.
    return into === 'animation-full' ? { kind: 'object-expand', durationMs: 450 } : { kind: 'cut', durationMs: 250 }
  }
  if (out === 'camera-full' || into === 'camera-full' || out === 'camera-text' || into === 'camera-text') {
    return { kind: 'reframe', durationMs: 300 }
  }
  return { kind: 'cut', durationMs: 250 }
}

export const planShots = (storyboard: StoryboardEntry[], beats: ScriptBeat[]): DirectedShot[] => {
  const shots = storyboard.map((entry, index): DirectedShot => {
    const { view, focus } = viewFor(entry)
    const firstBeat = beats[entry.beats[0]]
    // A short headline rides a camera-led shot; a camera-text treatment
    // already says the page lands behind the speaker.
    const title = firstBeat?.title || ''
    const emphasis = (view === 'camera-full' || view === 'camera-text') && title && title.length <= 48 ? title : undefined
    return {
      id: `shot-${index + 1}`,
      beats: [...entry.beats],
      focus,
      view,
      stage: {
        family: entry.family,
        ...(entry.treatment ? { treatment: entry.treatment } : {}),
        ...(entry.variant ? { variant: entry.variant } : {}),
        ...(entry.fromEndMs ? { fromEndMs: entry.fromEndMs } : {}),
      },
      ...(emphasis ? { emphasis } : {}),
      transitionOut: { kind: 'hold' as const, durationMs: 0 },
      reason: entry.why || entry.note,
    }
  })
  shots.forEach((shot, index) => {
    const next = shots[index + 1]
    if (next) shot.transitionOut = transitionBetween(shot.view, next.view)
  })
  return shots
}

// The shot sequence as the renderer's stage track — same timing math as the
// storyboard's, sourced from the applied plan (D6).
export const stageTrackFromShots = (shots: DirectedShot[], beatOffsetsMs: number[], beatDurationsMs: number[] = []): StageSegment[] => {
  const track: StageSegment[] = []
  shots.forEach(shot => {
    const family = isStageFamily(shot.stage.family) ? shot.stage.family : null
    if (!family || !shot.beats.length) return
    const first = Math.min(...shot.beats)
    const last = Math.max(...shot.beats)
    const fromEnd = Number(shot.stage.fromEndMs)
    const atMs =
      Number.isFinite(fromEnd) && fromEnd > 0
        ? Math.max(beatOffsetsMs[first] ?? 0, (beatOffsetsMs[last] ?? 0) + (beatDurationsMs[last] ?? 0) - fromEnd)
        : beatOffsetsMs[first] ?? 0
    const treatment = isStageTreatment(shot.stage.treatment) ? shot.stage.treatment : ''
    const variant = isStageVariant(family, shot.stage.variant) ? (shot.stage.variant as StageVariant) : undefined
    track.push({ atMs, family, ...(treatment ? { treatment } : {}), ...(variant ? { variant } : {}) })
  })
  return sanitizeStageTrack(track)
}

// Every beat is in exactly one shot, in order — the plan's coherence check.
export const validateShots = (shots: DirectedShot[], beatCount: number): string[] => {
  const problems: string[] = []
  const seen = new Set<number>()
  let previousEnd = -1
  shots.forEach(shot => {
    if (!shot.beats.length) problems.push(`${shot.id} covers no beats`)
    for (const beat of shot.beats) {
      if (beat < 0 || beat >= beatCount) problems.push(`${shot.id} names beat ${beat}, which does not exist`)
      if (seen.has(beat)) problems.push(`beat ${beat} is in two shots`)
      seen.add(beat)
      if (beat < previousEnd) problems.push(`${shot.id} goes back over beat ${beat}`)
      previousEnd = Math.max(previousEnd, beat)
    }
    if (shot.transitionOut.durationMs > 600) problems.push(`${shot.id}'s transition runs ${shot.transitionOut.durationMs} ms — restrained means under 600`)
  })
  for (let beat = 0; beat < beatCount; beat += 1) {
    if (!seen.has(beat)) problems.push(`beat ${beat} is in no shot`)
  }
  return problems
}

// ——— The recording brief: one scene at a time, in plain language ———
export type RecordingBrief = {
  // What this scene needs to communicate, and the one thought to retain.
  objective: string
  // The words, in order.
  say: string[]
  // Per shot: how it will look and how to record it.
  shots: Array<{ id: string; view: ShotView; look: string; record: string }>
  // What happens next: whether the voice continues over animation.
  next: string
}

const SHOT_GUIDANCE: Record<ShotView, { look: string; record: string }> = {
  'camera-full': { look: 'You, full frame.', record: 'Look into the lens and land the thought.' },
  'camera-text': { look: 'You, full frame, with the key phrase beside you.', record: 'Keep the space beside you clear; the phrase appears there.' },
  shared: { look: 'You beside the mechanism.', record: 'Speak naturally; the page stays large next to you.' },
  'animation-full': { look: 'The animation takes the screen.', record: 'Keep speaking at your own pace — your voice continues over it.' },
}

export const recordingBriefFor = (shots: DirectedShot[], beats: ScriptBeat[], context: { arcRole: string; kind: string }): RecordingBrief => {
  const sceneShots = shots.map(shot => ({
    id: shot.id,
    view: shot.view,
    look: SHOT_GUIDANCE[shot.view].look + (shot.emphasis ? ` “${shot.emphasis}”` : ''),
    record: SHOT_GUIDANCE[shot.view].record,
  }))
  const endsOnAnimation = shots.length > 1 && shots.some(shot => shot.view === 'animation-full')
  return {
    objective: `${context.arcRole}: ${context.kind}`,
    say: beats.map(beat => beat.text),
    shots: sceneShots,
    next: endsOnAnimation
      ? 'Your voice continues while the animation holds the frame; you return when it settles.'
      : 'You hold the frame throughout.',
  }
}
