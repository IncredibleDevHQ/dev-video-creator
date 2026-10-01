import type { SourceRead } from '../source'
import { sanitizeOutline, SCENE_KINDS } from '../source'
import type { Slide } from '../../shared/model'
import { fingerprintOf, quotedIn } from '../planning/fingerprint'
import { runValidatedJsonStage, type CreativeSelection } from './stage'
export const validateSlideRevision = (raw: unknown, source: SourceRead) => {
  const candidate = raw as {
    scenes?: Array<{
      kind?: string
      seconds?: number
      source?: string[]
      narration?: string
    }>
  }
  const problems: string[] = []
  if (!Array.isArray(candidate?.scenes) || candidate.scenes.length !== 1)
    problems.push('Revise exactly one slide')
  const scene = candidate?.scenes?.[0]
  if (!scene || !(SCENE_KINDS as readonly string[]).includes(scene.kind || ''))
    problems.push('Choose a supported slide kind')
  if (
    !Number.isFinite(scene?.seconds) ||
    scene!.seconds! < 2 ||
    scene!.seconds! > 90
  )
    problems.push('Use a duration between 2 and 90 seconds')
  if (typeof scene?.narration !== 'string' || !scene.narration.trim())
    problems.push('Keep a natural spoken draft')
  if (
    !['title', 'close'].includes(scene?.kind || '') &&
    (!Array.isArray(scene?.source) || !scene.source.length)
  )
    problems.push('Keep supporting source passages')
  for (const passage of Array.isArray(scene?.source) ? scene.source : [])
    if (typeof passage !== 'string' || !quotedIn(passage, source.text))
      problems.push('Every source passage must come from the retained article')
  const value = sanitizeOutline(raw, source.title, source.text)
  if (value.scenes.length !== 1)
    problems.push('The revised slide needs a title')
  return { ok: !problems.length, problems, warnings: [], value }
}
export const prepareCreativeSlideRevision = (input: {
  projectId: string
  slide: Slide
  index: number
  instruction: string
  source: SourceRead
  selection: CreativeSelection
  origin: string
}) =>
  runValidatedJsonStage({
    projectId: input.projectId,
    sceneId: `scene-${input.slide.id}`,
    inputKey: fingerprintOf({
      slide: input.slide,
      index: input.index,
      instruction: input.instruction,
      source: input.source
    }),
    checkpoint: 'creative-slide-revision',
    timeoutMs: 120000,
    idleTimeoutMs: 45000,
    maxToolCalls: 20,
    stage: 'story',
    route: 'Revise Slide',
    file: 'story/slide.json',
    tool: 'story_submit_slide',
    stageContext: {
      source: input.source,
      slide: input.slide,
      index: input.index,
      instruction: input.instruction
    },
    packet: {
      'packet/SOURCE.md': input.source.text,
      'packet/SLIDE.json': JSON.stringify(input.slide),
      'packet/EDIT.txt': input.instruction
    },
    selection: input.selection,
    origin: input.origin,
    validate: (raw) => validateSlideRevision(raw, input.source)
  })
