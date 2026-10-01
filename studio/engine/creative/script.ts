import { scriptEditProblems } from '../moment-edit-scope'
import type { Moment, Presence } from '../../shared/model'
import { normalizeMoments } from '../moment-plan'
import { fingerprintOf } from '../planning/fingerprint'
import type { ExplanationBriefV1 } from './explanation-brief'
import type { SceneTreatmentV1 } from './scene-treatment'
import { runValidatedJsonStage, type CreativeSelection } from './stage'
import type { HarnessEvent } from '../harness/types'
export const validateCreativeScript = (
  raw: unknown,
  input: {
    plan: SceneTreatmentV1
    presence: Presence
    role: string
    previous?: Moment[]
    editMomentId?: string
  }
) => {
  try {
    const submitted = (raw as { moments?: Array<{ id?: unknown }> })?.moments
    if (
      !Array.isArray(submitted) ||
      submitted.length !== input.plan.moments.length ||
      submitted.some(
        (moment, index) => moment.id !== input.plan.moments[index].id
      )
    )
      throw new Error(
        'Use the exact accepted plan moment IDs in the same order'
      )
    const moments = normalizeMoments(
      raw,
      input.plan.scene,
      input.presence,
      input.role,
      input.previous
    )
    const scopeProblems = scriptEditProblems(
      input.previous || [],
      moments,
      input.editMomentId
    )
    if (scopeProblems.length) throw new Error(scopeProblems.join('; '))
    for (const [index, moment] of moments.entries()) {
      const visible = input.plan.moments[index].presenter?.visibility
      if (visible === 'hidden' && moment.camera !== 'none')
        throw new Error(`Moment ${moment.id} must keep the presenter hidden`)
      if (
        (visible === 'full' || visible === 'shared') &&
        moment.camera === 'none'
      )
        throw new Error(
          `Moment ${moment.id} must include its planned presenter`
        )
      if (visible === 'full' && moment.layout !== 'full-screen')
        throw new Error(
          `Moment ${moment.id} requires the planned full-screen presenter`
        )
      if (visible === 'shared' && moment.layout === 'full-screen')
        throw new Error(
          `Moment ${moment.id} must share the frame with the explanation`
        )
    }
    return { ok: true, problems: [], warnings: [], value: moments }
  } catch (error) {
    return {
      ok: false,
      problems: [
        error instanceof Error ? error.message : 'Invalid spoken lines'
      ],
      warnings: [],
      value: [] as Moment[]
    }
  }
}
/** Spoken lines are a separate accepted artifact; a treatment is not a script. */
export const prepareCreativeScript = async (input: {
  projectId: string
  plan: SceneTreatmentV1
  brief: ExplanationBriefV1
  presence: Presence
  role: string
  videoTitle: string
  sourceText: string
  previous: Moment[]
  editMomentId?: string
  instructions: unknown
  selection: CreativeSelection
  origin: string
  onEvent?: (event: HarnessEvent) => Promise<void> | void
}) => {
  const context = {
    editScope: input.editMomentId
      ? {
          momentId: input.editMomentId,
          instruction:
            'Preserve unrelated moment words, timing, camera, layout and overlays exactly.'
        }
      : null,
    plan: input.plan,
    presence: input.presence,
    role: input.role,
    videoTitle: input.videoTitle,
    instructions: input.instructions
  }
  return runValidatedJsonStage({
    projectId: input.projectId,
    sceneId: input.plan.scene,
    inputKey: fingerprintOf({
      context,
      brief: input.brief,
      source: input.sourceText,
      previous: input.previous.map((moment) => ({
        id: moment.id,
        lines: moment.lines,
        segments: moment.segments
      }))
    }),
    checkpoint: 'creative-script',
    route: 'Write Spoken Lines',
    file: 'planning/script.json',
    tool: 'plan_submit_script',
    selection: input.selection,
    origin: input.origin,
    onEvent: input.onEvent,
    packet: {
      'packet/PLAN.json': JSON.stringify(input.plan, null, 2),
      'packet/EXPLANATION.json': JSON.stringify(input.brief, null, 2),
      'packet/SOURCE.md': input.sourceText,
      'packet/CONTEXT.json': JSON.stringify(context, null, 2),
      'packet/PREVIOUS_SCRIPT.json': JSON.stringify(input.previous, null, 2)
    },
    validate: (raw) => validateCreativeScript(raw, input)
  })
}
