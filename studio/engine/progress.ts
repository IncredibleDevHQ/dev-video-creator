import type { Snapshot, SceneProgress } from '../shared/api'
import { listNotebookRows, readRow } from './persistence'
import type { EngineRun } from './harness/runtime'
// Derived display data, never written back into the notebook's event history.
export const withProgress = async (snapshot: Snapshot | null) => {
  if (
    !snapshot ||
    (snapshot.status !== 'building' &&
      !snapshot.project.video?.scenes.some((scene) =>
        ['writing', 'replanning', 'changing', 'producing', 'failed'].includes(
          scene.phase
        )
      ))
  )
    return snapshot
  const runs = await Promise.all(
    (await listNotebookRows('engine-runs', snapshot.project.id)).map((id) =>
      readRow<EngineRun>('engine-runs', id)
    )
  )
  const sceneProgress: Record<string, SceneProgress> = {}
  for (const run of runs
    .filter(
      (run): run is EngineRun =>
        !!run &&
        !!run.sceneId &&
        ['planning', 'composition'].includes(run.stage)
    )
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))) {
    if (sceneProgress[run.sceneId!]) continue
    const latest = [...run.events]
      .reverse()
      .find((event) => event.type === 'tool' || event.type === 'file')
    const writing =
      run.stage === 'composition'
        ? 'Building the animation'
        : 'Writing the scene plan'
    const label =
      latest?.operation === 'read' || latest?.operation === 'search'
        ? 'Reviewing scene inputs'
        : latest?.operation === 'write' || latest?.operation === 'edit'
          ? writing
          : latest?.operation === 'run'
            ? 'Checking the scene'
            : writing
    sceneProgress[run.sceneId!] = {
      stage: run.stage as SceneProgress['stage'],
      active: ['preparing', 'running'].includes(run.status),
      label,
      updatedAt:
        latest && Number.isFinite(latest.ts)
          ? new Date(latest.ts).toISOString()
          : run.startedAt
    }
  }
  const run = runs
    .filter(
      (run): run is EngineRun =>
        !!run && !run.sceneId && ['running', 'preparing'].includes(run.status)
    )
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]
  const progress =
    snapshot.status === 'building' && run
      ? {
          label:
            run.stage === 'drawing'
              ? 'Designing your slides'
              : run.stage === 'story'
                ? 'Planning the story'
                : 'Understanding the source',
          startedAt: run.startedAt
        }
      : undefined
  if (!progress && !Object.keys(sceneProgress).length) return snapshot
  return { ...snapshot, ...(progress ? { progress } : {}), sceneProgress }
}
