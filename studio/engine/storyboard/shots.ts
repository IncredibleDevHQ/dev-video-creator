// Design Shots: one agent call per scene writes each frame's time-coded
// shot (storyboard-master/workflows/design-shots.md), against the frame's
// measured duration and its spoken words with their times, and onto the
// still the creator approved for it.
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import type { Snapshot } from '../../shared/api'
import {
  frameId,
  type EpisodePlan,
  type FrameShot
} from '../../shared/storyboard'
import {
  runValidatedJsonStage,
  type CreativeSelection
} from '../creative/stage'
import { fingerprintOf } from '../planning/fingerprint'
import type { EpisodeFrame, FrameVoice } from './voice'

export const SHOT_SKILL_FILES = [
  'SKILL.md',
  'workflows/design-shots.md',
  'references/build-types.md',
  'hyperframes/skills/faceless-explainer/references/visual-design.md',
  'hyperframes/skills/faceless-explainer/references/motion-language.md',
  'hyperframes/skills/faceless-explainer/references/cut-catalog.md',
  'hyperframes/skills/hyperframes-animation/blueprints-index.md',
  'hyperframes/skills/hyperframes-animation/rules-index.md'
]

const words = (value: unknown, limit: number) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit)

const POSTURE = /^([a-z0-9-]+)\s*\((Reproduce|Adapt)\)$/i

/** The shots of one scene, checked against its frames' measured lengths. */
export const checkShots = (
  raw: unknown,
  frames: Array<{ number: number; duration: number; voiceover: string }>,
  blueprints: string[]
) => {
  const problems: string[] = []
  const given = Array.isArray((raw as { frames?: unknown })?.frames)
    ? ((raw as { frames: unknown[] }).frames as Array<Record<string, unknown>>)
    : []
  const shots: FrameShot[] = []
  const numbers = given.map((entry) => Number(entry?.number))
  const wanted = frames.map((frame) => frame.number)
  if (numbers.join(',') !== wanted.join(','))
    problems.push(
      `Write one shot per frame, in order: frames ${wanted.join(', ')}`
    )
  for (const frame of frames) {
    const entry = given.find((item) => Number(item?.number) === frame.number)
    const label = `Frame ${frame.number}`
    if (!entry) continue
    const blueprint = words(entry.blueprint, 80)
    const posture = POSTURE.exec(blueprint)
    if (blueprint !== 'compose' && !posture)
      problems.push(
        `${label}: blueprint is "<id> (Reproduce)", "<id> (Adapt)" or "compose"`
      )
    else if (posture && !blueprints.includes(posture[1]))
      problems.push(`${label}: ${posture[1]} is not a blueprint in the index`)
    const adapt = words(entry.adapt, 300)
    if (posture?.[2].toLowerCase() === 'adapt' && !adapt)
      problems.push(
        `${label}: an Adapt says what it keeps and what changes (adapt)`
      )
    const focal = words(entry.focal, 200)
    const roles = words(entry.roles, 500)
    if (!focal) problems.push(`${label}: name the focal element`)
    if (!roles) problems.push(`${label}: give each element its role (roles)`)
    const windows = (Array.isArray(entry.windows) ? entry.windows : []).map(
      (item) => {
        const window = (item ?? {}) as Record<string, unknown>
        return {
          from: Math.round(Number(window.from) * 100) / 100,
          to: Math.round(Number(window.to) * 100) / 100,
          text: words(window.text, 600)
        }
      }
    )
    if (!windows.length)
      problems.push(`${label}: write its shot as time-coded windows`)
    let at = 0
    for (const [index, window] of windows.entries()) {
      if (!window.text)
        problems.push(`${label}: window ${index + 1} says nothing`)
      if (
        !Number.isFinite(window.from) ||
        !Number.isFinite(window.to) ||
        window.to <= window.from
      )
        problems.push(
          `${label}: window ${index + 1} needs a start before its end`
        )
      else if (Math.abs(window.from - at) > 0.15)
        problems.push(
          `${label}: window ${index + 1} starts at ${window.from} s; the windows run on from 0 without gaps`
        )
      at = window.to
    }
    if (windows.length && Math.abs(at - frame.duration) > 0.25)
      problems.push(
        `${label}: its windows end at ${at} s; the frame runs ${frame.duration} s`
      )
    const spoken = frame.voiceover.split(/\s+/).filter(Boolean).length
    if (spoken >= 10 && windows.length < 2)
      problems.push(
        `${label}: a ${spoken}-word line gives several cues: reveal across more than one window`
      )
    shots.push({
      number: frame.number,
      blueprint,
      ...(adapt ? { adapt } : {}),
      focal,
      roles,
      windows
    })
  }
  return {
    ok: problems.length === 0,
    problems,
    warnings: [] as string[],
    value: shots
  }
}

export const designSceneShots = async (input: {
  snapshot: Snapshot
  productionId: string
  plan: EpisodePlan
  sceneIndex: number
  frames: EpisodeFrame[]
  voices: FrameVoice[]
  durations: Record<number, number>
  frameDesign: string
  blueprints: string[]
  selection: CreativeSelection
  origin: string
  /** Skill files for this scene's build (layouts for camera, …). */
  extraFiles?: string[]
  /** Each frame's approved still, by number: the picture's path. */
  stills?: Record<number, string>
}) => {
  const scene = input.plan.scenes[input.sceneIndex]
  const frames = input.frames.filter((frame) => frame.pageId === scene.pageId)
  const stills: Record<string, Buffer> = {}
  for (const frame of frames)
    if (input.stills?.[frame.number])
      stills[`packet/stills/${frameId(frame)}.png`] = await readFile(
        input.stills[frame.number]
      )
  const neighbour = (index: number) => {
    const other = input.plan.scenes[index]
    return other
      ? { build: other.build, frames: other.frames.map((frame) => frame.title) }
      : null
  }
  const sceneJson = {
    build: scene.build,
    buildReason: scene.buildReason,
    before: neighbour(input.sceneIndex - 1),
    after: neighbour(input.sceneIndex + 1),
    frames: frames.map((frame) => ({
      number: frame.number,
      title: frame.title,
      scene: frame.scene,
      voiceover: frame.voiceover,
      duration: input.durations[frame.number] ?? frame.duration,
      words: (
        input.voices.find((voice) => voice.frame === frame.number)?.words || []
      ).map((word) => `${word.start.toFixed(2)} ${word.text}`),
      transition: frame.transition,
      type: frame.type,
      persuasion: frame.persuasion,
      beat: frame.beat,
      ...(frame.blueprint ? { blueprint: frame.blueprint } : {}),
      narrativeRole: frame.narrativeRole,
      keyMessage: frame.keyMessage,
      ...(stills[`packet/stills/${frameId(frame)}.png`]
        ? { still: `packet/stills/${frameId(frame)}.png` }
        : {})
    }))
  }
  const direction = [
    `This video tells ${input.plan.audience} that ${input.plan.message}`,
    '',
    `Structure: ${input.plan.structure}. Hook: ${input.plan.hook}.`,
    '',
    '## Video direction',
    '',
    `- palette: ${input.plan.direction.palette}`,
    `- motion: ${input.plan.direction.motion}`,
    `- held frames: ${input.plan.direction.held}`,
    `- never: ${input.plan.direction.never}`
  ].join('\n')
  const rules = frames.map((frame) => ({
    number: frame.number,
    duration: input.durations[frame.number] ?? frame.duration,
    voiceover: frame.voiceover
  }))
  return runValidatedJsonStage<FrameShot[]>({
    projectId: input.snapshot.project.id,
    sceneId: undefined,
    inputKey: fingerprintOf({
      production: input.productionId,
      scene: sceneJson,
      direction,
      frameDesign: input.frameDesign,
      harness: input.selection,
      ...(Object.keys(stills).length
        ? {
            stills: Object.values(stills).map((bytes) =>
              createHash('sha1').update(bytes).digest('hex')
            )
          }
        : {})
    }),
    checkpoint: `storyboard-shots-${scene.pageId}`,
    stage: 'shots',
    route: 'Design Shots',
    stageContext: { productionId: input.productionId, pageId: scene.pageId },
    file: 'plan/shots.json',
    tool: 'storyboard_submit_shots',
    operation: 'shots',
    skillFiles: [
      ...SHOT_SKILL_FILES,
      ...input.blueprints.map(
        (id) => `hyperframes/skills/hyperframes-animation/blueprints/${id}.md`
      ),
      ...(input.extraFiles || [])
    ],
    packet: {
      'packet/SCENE.json': JSON.stringify(sceneJson, null, 1),
      'packet/DIRECTION.md': direction,
      'packet/FRAME.md': input.frameDesign,
      ...stills
    },
    selection: input.selection,
    origin: input.origin,
    validate: (raw) => checkShots(raw, rules, input.blueprints)
  })
}

/** The skill files a scene's build reads beyond the shared ones. */
export const buildFiles = (
  build: string,
  layouts: string[],
  motion: string[]
) =>
  build === 'camera'
    ? [
        'hyperframes/skills/talking-head-recut/references/DESIGN_INDEX.md',
        ...layouts.map(
          (name) =>
            `hyperframes/skills/talking-head-recut/references/layouts/${name}`
        )
      ]
    : build === 'motion'
      ? [
          'hyperframes/skills/motion-graphics/catalog-map.md',
          ...motion.map(
            (name) => `hyperframes/skills/motion-graphics/references/${name}`
          )
        ]
      : []
