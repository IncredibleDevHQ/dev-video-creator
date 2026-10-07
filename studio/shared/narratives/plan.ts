// Wireframes from beats: how many pages a telling suggests, what the story
// planner is told, which beats the pages carry, and what evidence is still
// missing. The planner decides the pages; these say what it must honour.
import { allocateBeats } from './allocate'
import {
  directionSettings,
  narrativeById,
  presetById,
  presetFor
} from './catalog'
import {
  DRAMA_LABELS,
  ELABORATION_LABELS,
  lengthLabel,
  type Direction,
  type DirectionSettings,
  type Elaboration,
  type EvidenceAnswer,
  type EvidenceKind,
  type EvidenceNeed,
  type LengthRange,
  type Narrative,
  type Structure
} from './model'

/** How long one page runs, by how much the telling elaborates. */
const PAGE_SECONDS: Record<Elaboration, [number, number]> = {
  brief: [15, 30],
  standard: [20, 45],
  thorough: [30, 60]
}

/** How many pages a telling suggests: its length over how long a page runs. */
export const pageRange = (settings: DirectionSettings): [number, number] => {
  const [short, long] = PAGE_SECONDS[settings.elaboration]
  const min = Math.min(39, Math.max(3, Math.ceil(settings.length[0] / long)))
  const max = Math.min(
    40,
    Math.max(min + 1, Math.floor(settings.length[1] / short))
  )
  return [min, max]
}

/** What the story planner is told when the notebook has a narrative. */
export type StoryPlanBrief = {
  narrative: string
  name: string
  line: string
  audience: string
  rules: string[]
  needs: string[]
  direction: string
  length: LengthRange
  lengthLabel: string
  pages: [number, number]
  elaboration: string
  drama: string
  structure: Structure
  leads: EvidenceKind[]
  beats: Array<{
    id: string
    name: string
    function: string
    core: boolean
    told: boolean
    know: string
    evidence: EvidenceKind[]
    expansions: string[]
    seconds: LengthRange
  }>
}
export const storyPlanBrief = (
  narrative: Narrative,
  direction?: Partial<Direction> | null
): StoryPlanBrief => {
  const settings = directionSettings(narrative, direction)
  return {
    narrative: narrative.id,
    name: narrative.name,
    line: narrative.line,
    audience: narrative.audience,
    rules: narrative.rules,
    needs: narrative.needs,
    direction: presetById(presetFor(narrative, direction?.preset))!.name,
    length: settings.length,
    lengthLabel: lengthLabel(settings.length),
    pages: pageRange(settings),
    elaboration: ELABORATION_LABELS[settings.elaboration],
    drama: DRAMA_LABELS[settings.drama],
    structure: settings.structure,
    leads: settings.leads,
    beats: allocateBeats(narrative, settings).map((plan) => ({
      id: plan.beat.id,
      name: plan.beat.name,
      function: plan.beat.function,
      core: plan.beat.core,
      told: plan.told,
      know: plan.beat.know,
      evidence: plan.beat.evidence,
      expansions: plan.expanded ? plan.beat.expansions : [],
      seconds: plan.seconds
    }))
  }
}

type Page = {
  id?: string
  beats?: string[]
  needs?: EvidenceNeed[]
  answers?: EvidenceAnswer[]
}

/**
 * Which pages carry each beat this telling tells, and the core beats no page
 * carries. Null when no page names its beats, as before narratives.
 */
export const coverage = (
  narrative: Narrative,
  direction: Partial<Direction> | null | undefined,
  pages: Page[]
) => {
  if (!pages.some((page) => page.beats?.length)) return null
  const plans = allocateBeats(
    narrative,
    directionSettings(narrative, direction)
  )
  const beats = plans
    .map((plan) => ({
      beat: plan.beat,
      told: plan.told,
      pages: pages.flatMap((page, index) =>
        page.beats?.includes(plan.beat.id) ? [index] : []
      )
    }))
    .filter((item) => item.told || item.pages.length)
  return {
    beats,
    missing: beats
      .filter((item) => item.told && item.beat.core && !item.pages.length)
      .map((item) => item.beat)
  }
}

/**
 * The evidence pages still need from the creator, page by page. A diagram
 * is drawn from the source, and you on camera is a take: neither is asked.
 */
export const openRequests = (pages: Page[]) =>
  pages.flatMap((page, index) =>
    (page.needs || [])
      .filter(
        (need) =>
          !need.source &&
          need.kind !== 'diagram' &&
          need.kind !== 'creator' &&
          !page.answers?.some((answer) => answer.what === need.what)
      )
      .map((need) => ({ slideId: page.id, index, need }))
  )

/**
 * Each page's planned beats, when the video tells the story the pages were
 * planned for: beat ids belong to one narrative, so another story's pages
 * fall back to their share in order.
 */
export const plannedPages = (project: {
  narrative?: string
  slides: Page[]
  video?: { settings: { narrative?: string } } | null
}) =>
  project.narrative &&
  project.video?.settings.narrative === project.narrative &&
  narrativeById(project.narrative)
    ? project.slides.map((slide) => slide.beats)
    : undefined
