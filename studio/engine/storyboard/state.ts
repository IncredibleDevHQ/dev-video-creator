// What a storyboard production keeps beside its Hyperframes project
// (.studio/state.json), and the summary the creator sees on the notebook.
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  EpisodePlan,
  FrameShot,
  FrameStatus,
  LengthGoal,
  SceneSummary,
  Storyboard
} from '../../shared/storyboard'
import { frameId } from '../../shared/storyboard'
import type { FrameVoice } from './voice'
import { planFrames, renderScript, renderStoryboard } from './plan-files'

export type Internal = {
  plan?: EpisodePlan
  brief?: string
  length?: LengthGoal
  voices?: FrameVoice[]
  durations?: Record<number, number>
  media?: Record<number, string>
  shots?: Record<number, FrameShot>
  statuses?: Record<number, FrameStatus>
  /** Why a frame failed, or what the episode check found in it. */
  problems?: Record<number, string[]>
  /** Rounds of rebuilding frames the episode check refused. */
  rounds?: number
  /** The voice the episode was spoken in, for SCRIPT.md. */
  voiceName?: string
  /** The brand's logo in the project (assets/brand/logo.*), when it has one. */
  logo?: string
  /** The pages already voiced (their take cut, or spoken). */
  voiced?: string[]
  /** Frames whose still is posed (boards/poses/<id>.html, its picture in
   * boards/stills/<id>.png), by number: when it was posed. */
  stills?: Record<number, string>
}

const statePath = (dir: string) => join(dir, '.studio', 'state.json')

export const readInternal = async (dir: string): Promise<Internal> =>
  existsSync(statePath(dir))
    ? (JSON.parse(await readFile(statePath(dir), 'utf8')) as Internal)
    : {}

export const writeInternal = async (dir: string, internal: Internal) => {
  await mkdir(join(dir, '.studio'), { recursive: true })
  await writeFile(statePath(dir), JSON.stringify(internal, null, 1))
}

/** STORYBOARD.md and SCRIPT.md as they stand: durations, media, shots and
 * statuses folded in. */
export const writeProjectFiles = async (dir: string, internal: Internal) => {
  if (!internal.plan) return
  const target = internal.length
    ? (internal.length.min + internal.length.max) / 2
    : undefined
  await writeFile(
    join(dir, 'STORYBOARD.md'),
    renderStoryboard(internal.plan, {
      format: '1920x1080',
      target,
      shots: internal.shots,
      durations: internal.durations,
      statuses: internal.statuses,
      media: internal.media,
      logo: internal.logo
    })
  )
  await writeFile(
    join(dir, 'SCRIPT.md'),
    renderScript(
      internal.plan,
      { name: internal.voiceName || 'The video’s voice' },
      internal.durations
    )
  )
}

/** The plan as the creator reviews it, with each frame's state. */
export const planSummary = (
  internal: Internal,
  takes: Record<string, SceneSummary['take']> = {}
): Storyboard['plan'] => {
  const plan = internal.plan!
  return {
    message: plan.message,
    audience: plan.audience,
    structure: plan.structure,
    hook: plan.hook,
    ...(plan.continuity ? { continuity: plan.continuity } : {}),
    scenes: plan.scenes.map((scene) => ({
      pageId: scene.pageId,
      build: scene.build,
      buildReason: scene.buildReason,
      ...(scene.build === 'camera' || takes[scene.pageId]
        ? { take: takes[scene.pageId] ?? null }
        : {}),
      frames: scene.frames.map((frame) => ({
        number: frame.number,
        title: frame.title,
        scene: frame.scene,
        voiceover: frame.voiceover,
        duration: internal.durations?.[frame.number] ?? frame.duration,
        transition: frame.transition,
        ...(frame.transitionWhy ? { transitionWhy: frame.transitionWhy } : {}),
        type: frame.type,
        beat: frame.beat,
        narrativeRole: frame.narrativeRole,
        keyMessage: frame.keyMessage,
        status: internal.statuses?.[frame.number] || 'outline',
        ...(internal.problems?.[frame.number]?.length
          ? { problem: internal.problems[frame.number][0] }
          : {}),
        ...(internal.stills?.[frame.number]
          ? { still: internal.stills[frame.number] }
          : {})
      }))
    }))
  }
}

/** The frames in order, with their ids and builds. */
export const episodeFrames = (plan: EpisodePlan) =>
  planFrames(plan).map((frame) => ({ ...frame, id: frameId(frame) }))
