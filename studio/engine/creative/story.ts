import { sanitizeOutline } from '../source-outline'
import { type readSourceNarrative } from '../source-document'
import { fingerprintOf, quotedIn } from '../planning/fingerprint'
import { runValidatedJsonStage, type CreativeSelection } from './stage'
export const validateCreativeStory = (
  raw: unknown,
  source: ReturnType<typeof readSourceNarrative>
) => {
  const problems: string[] = []
  const draft = raw as {
    scenes?: Array<{
      title?: string
      kind?: string
      narration?: string
      source?: string[]
      seconds?: number
    }>
  }
  if (
    !Array.isArray(draft?.scenes) ||
    draft.scenes.length < 6 ||
    draft.scenes.length > 14
  )
    problems.push('An outline needs 6–14 scenes')
  if (
    draft?.scenes?.[0]?.kind !== 'title' ||
    draft.scenes.at(-1)?.kind !== 'close'
  )
    problems.push('Open with a title scene and end with a close scene')
  for (const [index, scene] of (Array.isArray(draft?.scenes)
    ? draft.scenes
    : []
  ).entries()) {
    if (!scene || typeof scene !== 'object') {
      problems.push(`Scene ${index + 1} is invalid`)
      continue
    }
    if (typeof scene.narration !== 'string' || !scene.narration.trim())
      problems.push(`Scene ${index + 1} needs natural spoken draft lines`)
    if (
      !Number.isFinite(scene.seconds) ||
      scene.seconds! < 2 ||
      scene.seconds! > 90
    )
      problems.push(
        `Scene ${index + 1} needs a length between 2 and 90 seconds`
      )
    if (
      !['title', 'close'].includes(scene.kind || '') &&
      (!Array.isArray(scene.source) || !scene.source.length)
    )
      problems.push(`Scene ${index + 1} needs retained source evidence`)
    for (const quote of Array.isArray(scene.source) ? scene.source : [])
      if (typeof quote !== 'string' || !quotedIn(quote, source.text))
        problems.push(
          `Scene ${index + 1} includes evidence that is not in the retained source`
        )
  }
  const value = sanitizeOutline(raw, source.title, source.text)
  if (value.scenes.length !== draft?.scenes?.length)
    problems.push('Every submitted scene needs a title')
  return { ok: problems.length === 0, problems, warnings: [], value }
}
export const prepareCreativeStory = (
  projectId: string,
  source: ReturnType<typeof readSourceNarrative>,
  selection: CreativeSelection,
  origin: string,
  brief?: import('./explanation-brief').ExplanationBriefV1
) =>
  runValidatedJsonStage({
    projectId,
    inputKey: fingerprintOf({ source, brief }),
    checkpoint: 'creative-story',
    stage: 'story',
    route: 'Plan Story',
    stageContext: { source, brief, wordingPolicy: 'draft' },
    file: 'story/outline.json',
    tool: 'story_submit_outline',
    packet: {
      'packet/SOURCE.md': source.text,
      ...(brief ? { 'packet/BRIEF.json': JSON.stringify(brief) } : {})
    },
    selection,
    origin,
    validate: (raw) => validateCreativeStory(raw, source)
  })
