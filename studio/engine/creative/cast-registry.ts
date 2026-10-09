// One cast across the video (the orchestrator's continuity rule): the actors
// other scenes' current plans established, with their artwork and where each
// scene left them. A scene that brings one back keeps its identity, and the
// check below holds it to that.
import type { Project } from '../../shared/model'
import { readRow } from '../persistence'
import type { SceneTreatmentV1 } from './scene-treatment'
import { planFits } from '../scene-model'

export type CastEntry = {
  entity: string
  role: string
  appearance: string
  asset: { status: string; ref?: string }
  /** The scenes it plays in, in order, with how each ends. */
  scenes: Array<{ scene: string; number: number; exit: string }>
}

/** The cast established by the video's other scenes, their plans current. */
export const castRegistry = async (
  project: Project,
  sceneId: string,
  /**
   * This scene's asset library: an actor whose artwork is not in it is
   * built native to match, never named by an asset the scene cannot use.
   */
  library?: string[]
): Promise<CastEntry[]> => {
  const video = project.video
  if (!video) return []
  const cast = new Map<string, CastEntry>()
  for (const [index, scene] of video.scenes.entries()) {
    if (scene.id === sceneId || !scene.planKey) continue
    const record = await readRow<{
      inputKey: string
      treatment: SceneTreatmentV1
    }>('creative-scenes', scene.id)
    // A plan made for other inputs is not what the scene shows any more.
    if (!record || !planFits(record.inputKey, scene)) continue
    for (const object of record.treatment.objects || []) {
      if (object.asset?.status === 'omit') continue
      const ref = object.asset?.ref
      const usable = ref && (!library || library.includes(ref))
      const entry = cast.get(object.entity) || {
        entity: object.entity,
        role: object.role,
        appearance: object.appearance,
        asset: usable
          ? { status: object.asset?.status || 'undecided', ref }
          : ref
            ? { status: 'native' }
            : { status: object.asset?.status || 'undecided' },
        scenes: []
      }
      entry.scenes.push({
        scene: scene.id,
        number: index + 1,
        exit: record.treatment.continuity?.exit || ''
      })
      cast.set(object.entity, entry)
    }
  }
  return [...cast.values()]
}

/**
 * An actor the cast already has keeps its artwork: a plan that brings it
 * back under the same id names the same asset, or builds it native.
 */
export const castProblems = (
  treatment: Pick<SceneTreatmentV1, 'objects'>,
  cast: CastEntry[]
) =>
  (treatment.objects || []).flatMap((object) => {
    const known = cast.find((entry) => entry.entity === object.entity)
    const ref = known?.asset.ref
    if (
      !known ||
      !ref ||
      object.asset?.status === 'native' ||
      object.asset?.status === 'omit' ||
      object.asset?.ref === ref
    )
      return []
    return [
      `"${object.entity}" is already in the video (scene ${known.scenes[0].number}) as ${ref}: keep that asset (reuse, adapt or enrich ${ref}), so it stays one actor`
    ]
  })
