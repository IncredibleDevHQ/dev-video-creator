import { sanitizeOutline } from '../source-outline'
import { type readSourceNarrative } from '../source-document'
import { fingerprintOf, quotedIn } from '../planning/fingerprint'
import { runValidatedJsonStage, type CreativeSelection } from './stage'
import { EVIDENCE_LABELS, type StoryPlanBrief } from '../../shared/narratives'

type DraftScene = {
  title?: string
  kind?: string
  narration?: string
  source?: string[]
  seconds?: number
  beats?: unknown
  needs?: unknown
}

/**
 * With a narrative, the pages come from its beats: within the telling's page
 * range, each page naming the beats it carries, every core beat on a page,
 * in the story's order (a cold open or result-first story may open on a
 * later beat), the lengths inside the range, and each page's evidence either
 * quoted from the source or left for the creator to supply.
 */
const storyProblems = (
  scenes: DraftScene[],
  story: StoryPlanBrief,
  text: string
) => {
  const problems: string[] = []
  const [fewest, most] = story.pages
  if (scenes.length < fewest || scenes.length > most)
    problems.push(
      `This telling needs ${fewest}–${most} pages for ${story.lengthLabel}`
    )
  const order = story.beats.map((beat) => beat.id)
  const carried: string[][] = scenes.map((scene, index) => {
    const beats = Array.isArray(scene?.beats) ? scene.beats : []
    if (!beats.length && !['title', 'close'].includes(scene?.kind || ''))
      problems.push(`Scene ${index + 1} needs the beats it carries`)
    for (const id of beats)
      if (!order.includes(String(id)))
        problems.push(`Scene ${index + 1} names a beat the story does not have`)
    return beats.map(String).filter((id) => order.includes(id))
  })
  for (const beat of story.beats)
    if (
      beat.core &&
      beat.told &&
      !carried.some((list) => list.includes(beat.id))
    )
      problems.push(`No scene carries the core beat "${beat.name}"`)
  const teaser = ['cold-open', 'result-first'].includes(story.structure)
  let reached = -1
  carried.forEach((list, index) => {
    if (teaser && index === 0) return
    for (const id of list) {
      const at = order.indexOf(id)
      if (at < reached)
        problems.push(
          `Scene ${index + 1} goes back to an earlier beat; keep the story’s order`
        )
      reached = Math.max(reached, at)
    }
  })
  const seconds = scenes.reduce((sum, scene) => sum + (scene?.seconds || 0), 0)
  if (
    seconds < Math.round(story.length[0] * 0.8) ||
    seconds > Math.round(story.length[1] * 1.2)
  )
    problems.push(`The scenes should add up to ${story.lengthLabel}`)
  scenes.forEach((scene, index) => {
    if (!Array.isArray(scene?.needs)) {
      problems.push(`Scene ${index + 1} needs its list of evidence needs`)
      return
    }
    for (const raw of scene.needs) {
      const need = (raw || {}) as {
        kind?: string
        what?: string
        source?: unknown
      }
      if (!need.what || !Object.hasOwn(EVIDENCE_LABELS, String(need.kind)))
        problems.push(
          `Scene ${index + 1} has an evidence need without a kind and a what`
        )
      else if (
        need.source !== null &&
        (typeof need.source !== 'string' || !quotedIn(need.source, text))
      )
        problems.push(
          `Scene ${index + 1}: evidence "${need.what}" quotes the source wrongly; quote it exactly or leave source null to ask the creator`
        )
    }
  })
  return problems
}

export const validateCreativeStory = (
  raw: unknown,
  source: ReturnType<typeof readSourceNarrative>,
  story?: StoryPlanBrief
) => {
  const problems: string[] = []
  const draft = raw as { scenes?: DraftScene[] }
  const scenes = Array.isArray(draft?.scenes) ? draft.scenes : []
  if (story) problems.push(...storyProblems(scenes, story, source.text))
  else if (
    !Array.isArray(draft?.scenes) ||
    scenes.length < 6 ||
    scenes.length > 14
  )
    problems.push('An outline needs 6–14 scenes')
  if (scenes[0]?.kind !== 'title' || scenes.at(-1)?.kind !== 'close')
    problems.push('Open with a title scene and end with a close scene')
  for (const [index, scene] of scenes.entries()) {
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
  if (value.scenes.length !== scenes.length)
    problems.push('Every submitted scene needs a title')
  return { ok: problems.length === 0, problems, warnings: [], value }
}
export const prepareCreativeStory = (
  projectId: string,
  source: ReturnType<typeof readSourceNarrative>,
  selection: CreativeSelection,
  origin: string,
  brief?: import('./explanation-brief').ExplanationBriefV1,
  targetScenes?: number,
  // With a narrative the pages come from its beats, not a target count.
  story?: StoryPlanBrief
) =>
  runValidatedJsonStage({
    projectId,
    inputKey: fingerprintOf({
      source,
      brief,
      targetScenes: story ? undefined : targetScenes,
      // Absent without a narrative, so those outlines keep their key.
      ...(story ? { story } : {})
    }),
    checkpoint: 'creative-story',
    stage: 'story',
    route: 'Plan Story',
    stageContext: {
      source,
      brief,
      wordingPolicy: 'draft',
      ...(story ? { story } : targetScenes ? { targetScenes } : {})
    },
    file: 'story/outline.json',
    tool: 'story_submit_outline',
    packet: {
      'packet/SOURCE.md': source.text,
      ...(brief ? { 'packet/BRIEF.json': JSON.stringify(brief) } : {}),
      ...(story ? { 'packet/STORY.json': JSON.stringify(story, null, 1) } : {})
    },
    selection,
    origin,
    validate: (raw) => validateCreativeStory(raw, source, story)
  })
