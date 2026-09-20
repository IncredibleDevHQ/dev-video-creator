// Continue from accepted work (issue #8): when the last Build Explainer run
// for this notebook stopped or parked on a person, the next build names that
// run explicitly in its inputs. The harness carries the prior run's reviewed
// artifacts into the new run's own directory, so:
//  - `accepted` scenes — still carrying exactly the revision the prior run
//    applied — are never regenerated or re-reviewed;
//  - `waiting` carries the per-scene/per-object checkpoints that still need a
//    person (with their pickup beats), so the run resumes the person-facing
//    work instead of restarting it.
// A finished or live run is never resumed: a done run means the next build is
// fresh work; a running/gated run is still in flight.
import type { BuildStageRow } from './stage-view'

export type ExplainerResume = {
  runId: string
  projectDir: string
  accepted: string[]
  waiting: Array<{
    stage: string
    subject?: string
    scene?: string
    review?: Array<{ beat: number; note: string }>
  }>
}

export const resumeBlockFor = (args: {
  run: { id: string; status: string; projectDir?: string } | null
  stages: BuildStageRow[]
  receipt: { applied?: Record<string, unknown> } | null
  scenes: Array<{ id: string; revision?: string }>
}): ExplainerResume | null => {
  const { run, stages, receipt, scenes } = args
  if (!run?.projectDir || run.status === 'done' || run.status === 'running' || run.status === 'gate') return null
  // A scene is accepted only while it still carries exactly what the earlier
  // run applied (the shared scene-revision digest, §3.9): an edit since then
  // makes it fresh work for the new run.
  const applied = receipt?.applied || {}
  const accepted = scenes
    .filter(scene => typeof scene.revision === 'string' && scene.revision !== '' && applied[scene.id] === scene.revision)
    .map(scene => scene.id)
  const waiting = stages
    .filter(stage => stage.status === 'needs-input')
    .map(stage => ({
      stage: stage.stage,
      ...(stage.subject ? { subject: stage.subject } : {}),
      ...(stage.detail?.scene ? { scene: stage.detail.scene } : {}),
      ...(stage.detail?.review?.length ? { review: stage.detail.review } : {}),
    }))
  return { runId: run.id, projectDir: run.projectDir, accepted, waiting }
}
