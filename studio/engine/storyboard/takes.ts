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

/** After the frames: every scene built goes on to assembly; a scene whose
 * take came in meanwhile is voiced next; otherwise the rest waits. */
export const afterFrames = (
  scenes: Array<Pick<SceneSummary, 'pageId' | 'take'>>,
  voiced: string[]
) => {
  const unvoiced = scenes.filter((scene) => !voiced.includes(scene.pageId))
  if (!unvoiced.length) return 'assemble' as const
  return unvoiced.some((scene) => scene.take)
    ? ('voice' as const)
    : ('wait' as const)
}
