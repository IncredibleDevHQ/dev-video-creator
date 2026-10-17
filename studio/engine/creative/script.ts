import { scriptEditProblems } from '../moment-edit-scope'
import type { Moment, Presence } from '../../shared/model'
import { normalizeMoments } from '../moment-plan'
import { unsupportedFigures } from './figures'
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
    /** What figures may be said: the source, its brief, the creator's own. */
    sourceText?: string
    brief?: unknown
    evidence?: string
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
    // The video's close never points at a scene or part to come.
    const closing = moments.at(-1)?.lines || ''
    if (
      input.role === 'ending' &&
      /\b(comes next|coming up|up next|next (scene|section|part|chapter)|in a moment)\b/i.test(
        closing
      )
    )
      throw new Error(
        `Moment ${moments.at(-1)!.id} closes the video: land what the viewer now understands, and do not point at a part to come`
      )
    if (input.sourceText) {
      const stated = [
        input.sourceText,
        JSON.stringify(input.brief ?? ''),
        input.evidence || ''
      ].join('\n')
      for (const moment of moments) {
        const said = unsupportedFigures(moment.lines, stated)
        if (said.length)
          throw new Error(
            `Moment ${moment.id} says ${said.join(', ')}, which the source does not give: say only figures the source states, or say an example as one ("Say a moment runs six seconds…")`
          )
      }
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
  /** The creator's own evidence for the page: its figures may be said. */
  evidence?: string
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
