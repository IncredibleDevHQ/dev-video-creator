// The episode plan, checked: the pages in their order, every script spoken
// word for word, every frame with its job, the transitions from the
// registry, and the length the creator asked for (story-design.md's final
// checklist, the parts a program can hold the plan to).
import {
  BUILD_TYPES,
  FRAME_TYPES,
  HOOK_STRATEGIES,
  STRUCTURES,
  TRANSITIONS,
  type BuildType,
  type EpisodePlan,
  type FrameTransition,
  type FrameType,
  type LengthGoal,
  type PlanFrame,
  type PlanScene
} from '../../shared/storyboard'
import { fitOf } from '../../shared/length'

export type PlanPage = {
  id: string
  title: string
  /** The words spoken over the page, exactly; '' when it has none. */
  script: string
  /** A product capture exists for a screen scene. */
  capture: boolean
}

export type PlanRules = {
  pages: PlanPage[]
  /** The creator may be on camera in this episode. */
  camera: boolean
  length?: LengthGoal
  /** Blueprint ids that exist (blueprints-index.md). */
  blueprints: string[]
  /** The build the creator chose for a page: the plan keeps it. */
  builds?: Record<string, BuildType>
  /** 'verbatim': every script spoken word for word. 'restructure': the
   * scripts are too long for a strict length, so the plan may cut them
   * (Hyperframes' VO_MODE). */
  voMode?: 'verbatim' | 'restructure'
  /** The brand has a logo a frame may show. */
  logo?: boolean
}

const text = (value: unknown, limit: number) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit)

/** The words of a line, for "word for word": case, quotes and punctuation
 * aside. */
export const wordsOf = (line: string) =>
  line
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .match(/[\p{L}\p{N}]+(?:'[\p{L}\p{N}]+)*/gu) || []

/** Where two scripts first differ, in a few words; '' when they agree. */
export const scriptDifference = (expected: string, spoken: string) => {
  const want = wordsOf(expected)
  const got = wordsOf(spoken)
  const at = want.findIndex((word, index) => got[index] !== word)
  if (at < 0)
    return got.length > want.length
      ? `adds “${got.slice(want.length, want.length + 6).join(' ')}” after the script ends`
      : ''
  const near = want.slice(Math.max(0, at - 3), at + 4).join(' ')
  return got.length <= at
    ? `stops before “${near}”`
    : `differs at “${near}” (spoken: “${got.slice(Math.max(0, at - 3), at + 4).join(' ')}”)`
}

/** A frame's spoken length: about 2.6 words a second. */
export const spokenSeconds = (line: string) => wordsOf(line).length / 2.6

/** A card's running time: its script spoken, and a breath. */
export const cardSeconds = (script: string) =>
  Math.round(spokenSeconds(script) + 1)

/** Verbatim, unless the scripts alone run past a strict length. */
export const voModeFor = (pages: PlanPage[], length?: LengthGoal) =>
  length?.strict &&
  spokenSeconds(pages.map((page) => page.script).join(' ')) > length.max
    ? ('restructure' as const)
    : ('verbatim' as const)

const structureOk = (value: string) =>
  STRUCTURES.some(
    (structure) => value === structure || value.startsWith(`${structure} with `)
  )

export const checkEpisodePlan = (raw: unknown, rules: PlanRules) => {
  const value = (raw ?? {}) as Record<string, unknown>
  const problems: string[] = []
  const warnings: string[] = []
  const message = text(value.message, 240)
  const audience = text(value.audience, 200)
  const structure = text(value.structure, 80)
  const hook = text(value.hook, 60)
  const continuity = text(value.continuity, 400)
  if (!message) problems.push('Write the message: one sentence, as a claim')
  if (!audience) problems.push('Say who the episode is for (audience)')
  if (!structureOk(structure))
    problems.push(
      `Name one structure (${STRUCTURES.join(', ')}), or a compound such as "concept-explainer with process"`
    )
  if (!HOOK_STRATEGIES.includes(hook as (typeof HOOK_STRATEGIES)[number]))
    problems.push(
      `Name the hook strategy, one of: ${HOOK_STRATEGIES.join('; ')}`
    )
  const rawDirection = (value.direction ?? {}) as Record<string, unknown>
  const direction = {
    palette: text(rawDirection.palette, 600),
    motion: text(rawDirection.motion, 600),
    held: text(rawDirection.held, 400),
    never: text(rawDirection.never, 600)
  }
  for (const [key, entry] of Object.entries(direction))
    if (!entry) problems.push(`Write the video direction's ${key}`)

  const rawScenes = Array.isArray(value.scenes) ? value.scenes : []
  const ids = rules.pages.map((page) => page.id)
  const given = rawScenes.map((scene) =>
    text((scene as Record<string, unknown>)?.pageId, 120)
  )
  if (given.join('\n') !== ids.join('\n'))
    problems.push(
      `Give one scene per page, in this order: ${ids.join(', ')} (got ${given.join(', ') || 'none'})`
    )
  const scenes: PlanScene[] = []
  const kinds = new Set<string>()
  let number = 0
  let total = 0
  for (const [index, item] of rawScenes.entries()) {
    const scene = (item ?? {}) as Record<string, unknown>
    const page = rules.pages.find((entry) => entry.id === given[index])
    const label = page
      ? `Scene ${index + 1} (${page.title})`
      : `Scene ${index + 1}`
    let build = text(scene.build, 20) as BuildType
    const chosen = page && rules.builds?.[page.id]
    if (chosen && build !== chosen)
      problems.push(`${label}: the creator chose ${chosen}; keep it`)
    if (!BUILD_TYPES.includes(build)) {
      problems.push(`${label}: build is one of ${BUILD_TYPES.join(', ')}`)
      build = 'faceless'
    }
    if (build === 'camera' && !rules.camera && !chosen)
      problems.push(`${label}: the creator is not on camera in this episode`)
    if (build === 'screen' && page && !page.capture)
      problems.push(
        `${label}: no product capture exists for this page, so it cannot be a screen scene`
      )
    const buildReason = text(scene.buildReason, 300)
    if (!buildReason) problems.push(`${label}: say why it is built as ${build}`)
    const frames: PlanFrame[] = []
    const rawFrames = Array.isArray(scene.frames) ? scene.frames : []
    if (!rawFrames.length) problems.push(`${label}: give it at least one frame`)
    for (const [at, entry] of rawFrames.entries()) {
      const frame = (entry ?? {}) as Record<string, unknown>
      number += 1
      const name = `Frame ${number}`
      const parsed: PlanFrame = {
        number,
        title: text(frame.title, 80),
        scene: text(frame.scene, 300),
        voiceover: text(frame.voiceover, 1200),
        duration: Number(frame.duration),
        transition: text(frame.transition, 30) as FrameTransition,
        ...(text(frame.transitionWhy, 200)
          ? { transitionWhy: text(frame.transitionWhy, 200) }
          : {}),
        type: text(frame.type, 30) as FrameType,
        persuasion: text(frame.persuasion, 160),
        beat: text(frame.beat, 80),
        ...(text(frame.blueprint, 60)
          ? { blueprint: text(frame.blueprint, 60).replace(/\s*\(.*\)$/, '') }
          : {}),
        narrativeRole: text(frame.narrativeRole, 300),
        keyMessage: text(frame.keyMessage, 300),
        ...(frame.logo === true ? { logo: true } : {})
      }
      if (parsed.logo && !rules.logo)
        problems.push(`${name}: there is no logo to show; leave logo out`)
      for (const key of [
        'title',
        'scene',
        'persuasion',
        'beat',
        'narrativeRole',
        'keyMessage'
      ] as const)
        if (!parsed[key]) problems.push(`${name}: write its ${key}`)
      if (!FRAME_TYPES.includes(parsed.type))
        problems.push(`${name}: type is one of ${FRAME_TYPES.join(', ')}`)
      if (!TRANSITIONS.includes(parsed.transition))
        problems.push(`${name}: transition is one of ${TRANSITIONS.join(', ')}`)
      else kinds.add(parsed.transition.replace(/ .*/, ''))
      if (number === 1 && parsed.transition !== 'cut')
        problems.push('Frame 1 enters with a cut')
      // A new scene is marked: a cut there is a choice, with its reason.
      if (
        at === 0 &&
        index > 0 &&
        parsed.transition === 'cut' &&
        !parsed.transitionWhy
      )
        problems.push(
          `${name} opens scene ${index + 1} with a cut: mark the change of scene with a transition, or say why a cut in transitionWhy`
        )
      if (
        !Number.isFinite(parsed.duration) ||
        parsed.duration < 1.5 ||
        parsed.duration > 20
      )
        problems.push(`${name}: duration is 1.5 to 20 seconds`)
      else if (
        parsed.voiceover &&
        parsed.duration + 0.5 < spokenSeconds(parsed.voiceover)
      )
        problems.push(
          `${name}: its line needs about ${Math.ceil(spokenSeconds(parsed.voiceover))} s; give it that long or split it`
        )
      if (parsed.blueprint && !rules.blueprints.includes(parsed.blueprint))
        problems.push(
          `${name}: ${parsed.blueprint} is not a blueprint in the index`
        )
      if (at === 0 && index === 0 && parsed.type !== 'hook')
        warnings.push('Frame 1 is usually the hook')
      total += Number.isFinite(parsed.duration) ? parsed.duration : 0
      frames.push(parsed)
    }
    if (page?.script && rules.voMode !== 'restructure') {
      const differs = scriptDifference(
        page.script,
        frames.map((frame) => frame.voiceover).join(' ')
      )
      if (differs)
        problems.push(
          `${label}: speak its script word for word: the frames ${differs}`
        )
    }
    scenes.push({
      pageId: page?.id || given[index],
      build,
      buildReason,
      frames
    })
  }
  if (kinds.size > 3)
    problems.push(
      `Use 2–3 kinds of transition in the episode, not ${kinds.size} (${[...kinds].join(', ')})`
    )
  const types = scenes.flatMap((scene) =>
    scene.frames.map((frame) => frame.type)
  )
  if (
    types.length &&
    !types.some(
      (type) => type === 'feature_showcase' || type === 'product_intro'
    )
  )
    problems.push(
      'Give the episode a body: at least one product_intro or feature_showcase frame'
    )
  const goal = rules.length
  const fit = goal && total ? fitOf(total, goal) : 'within'
  if (goal && fit !== 'within') {
    const line = `The frames run about ${Math.round(total)} s; the episode asks for ${goal.min}–${goal.max} s`
    const fix =
      fit === 'long'
        ? 'Cut or merge frames to fit.'
        : 'Let frames breathe, or add a held frame with its seconds, to reach it.'
    if (goal.strict) problems.push(`${line}. ${fix}`)
    else warnings.push(line)
  }
  const plan: EpisodePlan = {
    message,
    audience,
    structure,
    hook,
    ...(continuity ? { continuity } : {}),
    direction,
    scenes
  }
  return { ok: problems.length === 0, problems, warnings, value: plan }
}
