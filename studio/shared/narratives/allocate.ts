// How one telling uses a narrative's beats: which are told, roughly how long
// each runs, which scenes carry which beats, and where the speaker is. The
// seconds are a share of the length range, guidance for planning; how many
// scenes there are comes from the wireframes, never from the narrative.
import type { Moment, Presence } from '../model'
import type {
  Beat,
  BeatFunction,
  DirectionSettings,
  LengthRange,
  Narrative,
  OnCamera,
  SpeakerPlace
} from './model'

export type BeatPlan = {
  beat: Beat
  /** Core beats are always told; optional ones when there is room. */
  told: boolean
  /** A long telling grows the beat by its expansions. */
  expanded: boolean
  /** Roughly how long the beat runs, a share of the length range. */
  seconds: LengthRange
}

const WEIGHTS: Record<BeatFunction, number> = {
  hook: 0.6,
  context: 1,
  problem: 1,
  explain: 1.6,
  evidence: 1.3,
  turn: 1,
  resolution: 1.2,
  payoff: 0.9,
  action: 0.5
}

/** Optional beats need two minutes or more, and more than a brief telling. */
const hasRoom = ({ length, elaboration }: DirectionSettings) =>
  length[1] >= 120 && elaboration !== 'brief'
/** Beats grow in a thorough telling of ten minutes, or a standard one of twenty. */
const grows = ({ length, elaboration }: DirectionSettings) =>
  elaboration === 'thorough'
    ? length[1] >= 600
    : elaboration === 'standard' && length[1] >= 1200

/**
 * Which beats a telling tells and roughly how long each runs. Short tellings
 * drop the optional beats, long ones expand them, and beats whose evidence
 * leads get more of the time.
 */
export const allocateBeats = (
  narrative: Narrative,
  settings: DirectionSettings
): BeatPlan[] => {
  const room = hasRoom(settings)
  const growing = grows(settings)
  const weighed = narrative.beats.map((beat) => {
    const told = beat.core || room
    const expanded = told && growing && beat.expansions.length > 0
    const leads = beat.evidence.some((kind) => settings.leads.includes(kind))
    const weight = told
      ? WEIGHTS[beat.function] *
        (leads ? 1.4 : 1) *
        (expanded ? 1 + 0.6 * beat.expansions.length : 1)
      : 0
    return { beat, told, expanded, weight }
  })
  const total = weighed.reduce((sum, item) => sum + item.weight, 0) || 1
  const [min, max] = settings.length
  return weighed.map(({ weight, ...plan }) => ({
    ...plan,
    seconds: [
      Math.round((min * weight) / total),
      Math.round((max * weight) / total)
    ]
  }))
}

/**
 * Which told beats each scene carries, in order. Each beat takes a stretch
 * of the video by its time; a scene carries the beats that fill a fair part
 * of its stretch, or most of their own. So one beat may take several scenes,
 * several beats may share one, and every told beat is carried.
 */
export const assignBeats = (plans: BeatPlan[], sceneCount: number) => {
  const told = plans.filter((plan) => plan.told)
  if (sceneCount <= 0) return []
  if (!told.length) return Array.from({ length: sceneCount }, () => [])
  const weights = told.map((plan) => plan.seconds[0] + plan.seconds[1] || 1)
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let at = 0
  const spans = told.map((plan, index) => {
    const from = at
    at += weights[index] / total
    return { id: plan.beat.id, from, to: at }
  })
  return Array.from({ length: sceneCount }, (_, index) => {
    const from = index / sceneCount
    const to = (index + 1) / sceneCount
    const shares = spans.map((span) => ({
      id: span.id,
      own: span.to - span.from,
      share: Math.max(0, Math.min(to, span.to) - Math.max(from, span.from))
    }))
    const carried = shares.filter(
      (item) =>
        item.share > 1e-9 &&
        (item.share >= 0.4 * (to - from) - 1e-9 ||
          item.share >= 0.5 * item.own - 1e-9)
    )
    return (
      carried.length
        ? carried
        : [
            shares.reduce((best, item) =>
              item.share > best.share ? item : best
            )
          ]
    ).map((item) => item.id)
  })
}

/** Evidence the viewer has to see: anything but words and you. */
const showsMaterial = (beats: Beat[]) =>
  beats.some((beat) =>
    beat.evidence.some((kind) => kind !== 'quote' && kind !== 'creator')
  )

/**
 * Where the speaker is in a scene, from how much the creator is on camera
 * and the beats the scene carries. At the ends they open and close the
 * video; as a guide they step into the corner while material is on screen;
 * when they lead, words go over them and material sits beside them.
 */
export const speakerFor = (
  onCamera: OnCamera,
  beats: Beat[],
  first: boolean,
  last: boolean
): SpeakerPlace => {
  if (onCamera === 'none') return 'off'
  if (onCamera === 'ends') return first || last ? 'beside' : 'off'
  const material = showsMaterial(beats)
  if (onCamera === 'guide')
    return first || last ? 'beside' : material ? 'corner' : 'beside'
  return first ? 'over' : last ? 'full' : material ? 'beside' : 'over'
}

/** The presence a direction suggests, preselected for the creator. */
export const presenceFor = (onCamera: OnCamera): Presence =>
  onCamera === 'none' ? 'off' : onCamera === 'leads' ? 'high' : 'low'

/** The presenter layout a speaker place uses, or none when they are off. */
export const presenterLayoutFor = (
  place: SpeakerPlace
): Moment['layout'] | null =>
  place === 'full' || place === 'over'
    ? 'full-screen'
    : place === 'beside'
      ? 'beside-slide'
      : place === 'corner'
        ? 'corner'
        : null
