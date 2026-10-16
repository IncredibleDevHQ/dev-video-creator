// When a creator's take may come in, and where the production goes once the
// frames that can be built are built.
import type { SceneSummary, Storyboard } from '../../shared/storyboard'

const BUILDING = ['shots', 'frames', 'assemble', 'render']

/** Why a take can't be saved now, or null. A scene's first take is welcome
 * any time (the scenes being built don't use it); a take is replaced only
 * between steps. */
export const takeRefusal = (storyboard: Storyboard, scene: SceneSummary) =>
  scene.take &&
  BUILDING.includes(storyboard.stage) &&
  storyboard.status === 'working'
    ? 'Wait until this step finishes to replace a take'
    : null

type Spoken = Pick<SceneSummary, 'build'> & {
  frames: Array<{ voiceover: string }>
}

/** A scene that needs the creator's take: a camera scene, for its picture,
 * or one with words to say while the creator speaks the episode. One with
 * nothing to say needs none: Record has no line to take (review 7). */
export const needsTake = (scene: Spoken, recordVoice: boolean) =>
  scene.build === 'camera' ||
  (recordVoice && scene.frames.some((frame) => frame.voiceover.trim()))

/** After the frames: every scene built goes on to assembly; a scene whose
 * take came in meanwhile is voiced next; otherwise the rest waits. */
export const afterFrames = (
  scenes: Array<Pick<SceneSummary, 'pageId' | 'take'> & Spoken>,
  voiced: string[],
  recordVoice = false
) => {
  const unvoiced = scenes.filter((scene) => !voiced.includes(scene.pageId))
  if (!unvoiced.length) return 'assemble' as const
  // A scene voiced without a take (the voice is no longer the creator's)
  // or whose take came is voiced next; only one that needs a take waits.
  return unvoiced.some((scene) => scene.take || !needsTake(scene, recordVoice))
    ? ('voice' as const)
    : ('wait' as const)
}
