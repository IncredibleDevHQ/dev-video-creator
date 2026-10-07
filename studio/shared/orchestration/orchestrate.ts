// The orchestrator: one plan above the scenes. For each scene it picks the
// shot, says where the speaker is and when, and plans the seams between
// scenes in one direction, so the video reads as one piece. It runs for a
// video that tells a narrative; each scene's planner develops its shot.
import { readyCapture } from '../capture'
import type { Presence, Project, Transition, VideoSettings } from '../model'
import {
  FUNCTION_LABELS,
  SPEAKER_LABELS,
  directionSettings,
  narrativeAt,
  narrativeById,
  plannedPages,
  speakerFor,
  type DirectionSettings,
  type EvidenceKind,
  type OnCamera,
  type SceneNarrative,
  type SpeakerPlace
} from '../narratives'
import { SHOTS, shotById, sketchShot, type Shot, type ShotId } from './shots'

/** What a page's kind says it shows. */
const KIND_EVIDENCE: Record<string, EvidenceKind[]> = {
  title: ['quote'],
  list: ['quote'],
  diagram: ['diagram'],
  numbers: ['numbers'],
  quote: ['quote', 'creator'],
  close: ['quote']
}
/** Evidence as it reads in a reason: "rests on a timeline". */
const EVIDENCE_WORDS: Record<EvidenceKind, string> = {
  numbers: 'numbers',
  timeline: 'a timeline',
  code: 'code',
  diff: 'a diff',
  diagram: 'a diagram',
  demo: 'a product demo',
  terminal: 'a terminal',
  quote: 'a statement',
  creator: 'you on camera'
}
const named = (name: string) => `“${name}”`
const KIND_WORDS: Record<string, string> = {
  title: 'it opens the video',
  list: 'its page is a list',
  diagram: 'its page is a diagram',
  numbers: 'its page is about numbers',
  quote: 'its page is one statement',
  close: 'it closes the video'
}

/** The presence the direction gives a scene by its place in the video. */
export const directedPresence = (
  onCamera: OnCamera,
  index: number,
  count: number
): Presence => {
  const first = index === 0
  const last = index === count - 1
  if (onCamera === 'none') return 'off'
  if (onCamera === 'leads') return 'high'
  if (onCamera === 'ends') return first ? 'high' : last ? 'low' : 'off'
  return first ? 'high' : 'low'
}

/**
 * The presence a scene follows: the creator's for it, else, with a
 * narrative, the direction's for its place in the video, else the
 * notebook's.
 */
export const presenceAt = (
  settings: VideoSettings,
  index: number,
  count: number,
  own?: Presence | null
): Presence => {
  if (own) return own
  const narrative = narrativeById(settings.narrative)
  return narrative
    ? directedPresence(
        directionSettings(narrative, settings.direction).onCamera,
        index,
        count
      )
    : settings.presence
}
export const scenePresence = (
  video: {
    settings: VideoSettings
    scenes: Array<{ id: string; presence: Presence | null }>
  },
  sceneId: string
) => {
  const index = video.scenes.findIndex((scene) => scene.id === sceneId)
  return presenceAt(
    video.settings,
    Math.max(0, index),
    video.scenes.length,
    video.scenes[index]?.presence
  )
}

type ShotInput = {
  shape: SceneNarrative
  settings: DirectionSettings
  kind?: string
  needs: EvidenceKind[]
  place: SpeakerPlace
  previous?: ShotId
  intro: boolean
  /** A demo was captured for the page: the capture is there to be shown. */
  captured?: boolean
  /** The page is drawn: what it shows outranks how its beat usually looks. */
  drawn?: boolean
}

/** How well a shot serves a scene, and the reasons that count most. */
const score = (shot: Shot, input: ShotInput) => {
  const beats = input.shape.beats.map((plan) => plan.beat)
  const fromKind = KIND_EVIDENCE[input.kind || ''] || []
  const reasons: Array<[number, string]> = []
  let total = 0
  const add = (points: number, reason?: string) => {
    total += points
    if (reason && points > 0) reasons.push([points, reason])
  }
  // What the page shows counts by the best match, not by how many kinds a
  // shot can serve.
  const kinds = shot.serves.map((kind) => {
    const parts: Array<[number, string | undefined]> = []
    // A drawn page is the real picture; the beat's evidence is a habit.
    if (fromKind.includes(kind))
      parts.push([input.drawn ? 4 : 3, KIND_WORDS[input.kind || '']])
    if (input.needs.includes(kind))
      parts.push([2, `it needs ${EVIDENCE_WORDS[kind]}`])
    const leading = beats.find((beat) => beat.evidence[0] === kind)
    if (leading)
      parts.push([
        input.drawn && !fromKind.includes(kind) ? 1 : 2,
        `${named(leading.name)} rests on ${EVIDENCE_WORDS[kind]}`
      ])
    else if (beats.some((beat) => beat.evidence.includes(kind)))
      parts.push([1, undefined])
    if (input.settings.leads.includes(kind))
      parts.push([1.5, `${EVIDENCE_WORDS[kind]} leads this telling`])
    return parts
  })
  const sums = kinds.map((parts) => parts.reduce((sum, [n]) => sum + n, 0))
  const best = sums.indexOf(Math.max(0, ...sums))
  kinds.forEach((parts, index) =>
    index === best
      ? parts.forEach(([points, reason]) => add(points, reason))
      : add(sums[index] * 0.25)
  )
  // The way the narrative says the beat could look names a shot.
  const pictured = beats.find((beat) => sketchShot(beat.example) === shot.id)
  // The beat's usual picture counts in full when the drawn page agrees with
  // it, and less when the page was drawn as something else.
  const agrees = fromKind.some((kind) => shot.serves.includes(kind))
  if (pictured)
    add(
      input.drawn && !agrees ? 1.5 : 2.5,
      `${named(pictured.name)} is pictured this way`
    )
  const suited = beats.find((beat) => shot.suits.includes(beat.function))
  if (suited)
    add(
      1.5,
      `${named(suited.name)} is the ${FUNCTION_LABELS[suited.function].toLowerCase()}`
    )
  if (!shot.speaker.includes(input.place)) add(-4)
  if (shot.workflow === 'motion-graphics')
    add(
      input.settings.drama === 'dramatic'
        ? 1
        : input.settings.drama === 'calm' && !input.intro
          ? -0.5
          : 0
    )
  // Capturing a demo is the creator's own act: it outweighs the page's kind
  // (a shot the creator picks still wins over it).
  if (input.captured && shot.serves.includes('demo'))
    add(10, 'a demo was captured for it')
  if (shot.id === input.previous) add(-2.5)
  if (shot.id === 'title-reveal')
    add(input.intro ? 3 : -10, 'it opens the video')
  const why = [
    ...new Set(reasons.sort((a, b) => b[0] - a[0]).map(([, reason]) => reason))
  ]
    .slice(0, 2)
    .join('; ')
  return { shot, score: total, why }
}

/** Every shot ranked for a scene, the best first. */
export const rankShots = (input: ShotInput) =>
  SHOTS.map((shot) => score(shot, input)).sort((a, b) => b.score - a.score)

export type SceneShot = {
  sceneId: string
  index: number
  beats: string[]
  shot: Shot
  /** The orchestrator's choice; the creator's own wins over it. */
  suggested: Shot
  chosenBy: 'orchestrator' | 'creator'
  why: string
  speaker: SpeakerPlace
  presence: Presence
}

/**
 * The orchestration of a video that tells a narrative: a shot for every
 * scene, where the speaker is and when. Variety looks at the suggestion
 * before, never the creator's choice, so choosing one scene's shot leaves
 * the others as they were.
 */
export const orchestrate = (project: Project): SceneShot[] | null => {
  const video = project.video
  if (!video || !narrativeById(video.settings.narrative)) return null
  const pages = plannedPages(project)
  // By the wireframes' order: while the video reconciles, its scenes are
  // still being rebuilt, and scenes follow the wireframes one to one.
  const count = project.slides.length
  let previous: ShotId | undefined
  return project.slides.map((slide, index) => {
    const scene = video.scenes.find((item) => item.slideId === slide.id)
    const shape = narrativeAt(
      video.settings,
      index,
      count,
      scene?.beats,
      pages
    )!
    const presence = presenceAt(video.settings, index, count, scene?.presence)
    const place =
      presence === 'off'
        ? 'off'
        : speakerFor(
            shape.settings.onCamera,
            shape.beats.map((plan) => plan.beat),
            index === 0,
            index === count - 1
          )
    const [best] = rankShots({
      shape,
      settings: shape.settings,
      kind:
        slide.pageKind ||
        (index === 0 ? 'title' : index === count - 1 ? 'close' : undefined),
      needs: (slide.needs || []).map((need) => need.kind),
      captured: Boolean(readyCapture(slide.capture)),
      drawn: Boolean(slide.pageKind),
      place,
      previous,
      intro: index === 0
    })
    previous = best.shot.id
    const own = shotById(scene?.shot)
    return {
      sceneId: scene?.id || `scene-${slide.id}`,
      index,
      beats: shape.beats.map((plan) => plan.beat.id),
      shot: own ?? best.shot,
      suggested: best.shot,
      chosenBy: own ? 'creator' : 'orchestrator',
      why: own ? 'you chose it' : best.why || 'it suits the beat',
      speaker: place,
      presence
    }
  })
}

/**
 * The seams between scenes, in one direction: a scene that goes on with the
 * same beat dissolves into the next; a new beat pushes forward; after a cold
 * open the story wipes back to its start.
 */
export const seamPlan = (
  scenes: SceneShot[],
  structure?: string
): Transition[] =>
  scenes.slice(0, -1).map((scene, index) => {
    const next = scenes[index + 1]
    if (index === 0 && structure === 'cold-open') return 'wipe'
    return next.beats.some((beat) => scene.beats.includes(beat))
      ? 'crossfade'
      : 'push-left'
  })

/** What a scene's planner is told about its shot and its seams. */
export type ShotBrief = {
  id: ShotId
  name: string
  line: string
  workflow: string
  recipes: string[]
  why: string
  chosenBy: 'orchestrator' | 'creator'
  speaker: string
  entry: Transition | null
  exit: Transition | null
}
export const shotBrief = (
  scenes: SceneShot[],
  index: number,
  transitions: Transition[]
): ShotBrief => {
  const scene = scenes[index]
  return {
    id: scene.shot.id,
    name: scene.shot.name,
    line: scene.shot.line,
    workflow: scene.shot.workflow,
    recipes: scene.shot.recipes,
    why: scene.why,
    chosenBy: scene.chosenBy,
    speaker: SPEAKER_LABELS[scene.speaker],
    entry: index > 0 ? (transitions[index - 1] ?? null) : null,
    exit: index < scenes.length - 1 ? (transitions[index] ?? null) : null
  }
}
