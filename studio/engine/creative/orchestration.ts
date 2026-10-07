// The orchestrator, for one scene's planner: the shot it was given, the
// seams it meets, and the cast the rest of the video already established;
// and the checks that hold its plan to them.
import { inCut } from '../../shared/orchestration'
import type { Project } from '../../shared/model'
import {
  orchestrate,
  shotBrief,
  type ShotBrief
} from '../../shared/orchestration'
import { castProblems, castRegistry, type CastEntry } from './cast-registry'
import type { SceneTreatmentV1 } from './scene-treatment'

/** The orchestration a scene is planned with, or null without a narrative. */
export const sceneOrchestration = async (
  project: Project,
  sceneId: string,
  library?: string[]
) => {
  const shots = orchestrate(project)
  const index = shots?.findIndex((scene) => scene.sceneId === sceneId) ?? -1
  if (!shots || index < 0) return null
  return {
    shot: shotBrief(
      shots,
      index,
      project.video!.transitions,
      shots.map((item) =>
        inCut(project.video!.scenes.find((scene) => scene.id === item.sceneId))
      )
    ),
    cast: await castRegistry(project, sceneId, library)
  }
}

/**
 * The plan builds the shot it was given: at least one moment starts from one
 * of the shot's recipes, or names an adapted recipe that says why it does
 * not fit.
 */
export const shotProblems = (
  treatment: Pick<SceneTreatmentV1, 'moments'>,
  shot: ShotBrief
) =>
  treatment.moments.some((moment) =>
    (moment.recipes || []).some(
      (recipe) =>
        shot.recipes.includes(recipe.id) || recipe.catalog === 'adapted'
    )
  )
    ? []
    : [
        `This scene is a "${shot.name}" shot: start a moment from one of its recipes (${shot.recipes.join(', ')}), or name an adapted recipe that says why the shot does not fit`
      ]

export const orchestrationProblems = (
  treatment: SceneTreatmentV1,
  orchestration: { shot: ShotBrief; cast: CastEntry[] } | null
) =>
  orchestration
    ? [
        ...shotProblems(treatment, orchestration.shot),
        ...castProblems(treatment, orchestration.cast)
      ]
    : []
