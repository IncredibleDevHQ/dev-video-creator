// Plan Episode: the agent turns the episode's pages into its storyboard
// (storyboard-master/workflows/plan-episode.md). The studio gives it the
// episode's brief, its pages with their scripts, the source and the design,
// checks the plan it submits, and writes STORYBOARD.md and SCRIPT.md.
import { readdirSync } from 'node:fs'
import { writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Snapshot } from '../../shared/api'
import { readyCapture } from '../../shared/capture'
import type { Slide } from '../../shared/model'
import type {
  BuildType,
  EpisodePlan,
  LengthGoal
} from '../../shared/storyboard'
import { sentencesOf } from '../card-words'
import {
  askOnce,
  claimProblem,
  limitsFor,
  overclaims,
  type Limit,
  type Passage
} from '../claims'
import {
  runValidatedJsonStage,
  type CreativeSelection
} from '../creative/stage'
import { fingerprintOf } from '../planning/fingerprint'
import { fitOf, wordBudget } from '../../shared/length'
import {
  checkEpisodePlan,
  spokenSeconds,
  voModeFor,
  type PlanPage
} from './plan-check'
import { renderScript, renderStoryboard } from './plan-files'
import { upstreamPath } from './hyperframes'

export const PLAN_SKILL_FILES = [
  'SKILL.md',
  'workflows/plan-episode.md',
  'references/build-types.md',
  'hyperframes/PROVENANCE.md',
  'hyperframes/skills/faceless-explainer/references/story-design.md',
  'hyperframes/skills/hyperframes-creative/references/story-spine.md',
  'hyperframes/skills/hyperframes-creative/references/narration.md',
  'hyperframes/skills/hyperframes/references/storyboard-format.md',
  'hyperframes/skills/hyperframes/references/script-format.md',
  'hyperframes/skills/hyperframes-animation/blueprints-index.md'
]

export const blueprintIds = () =>
  readdirSync(upstreamPath('hyperframes-animation', 'blueprints'))
    .filter((name) => name.endsWith('.md'))
    .map((name) => name.replace(/\.md$/, ''))

/** What is spoken over a page: its script. In an episode the script already
 * holds the page's line in and line out (composeNarration), so they are
 * never added again. */
export const pageScript = (slide: Slide) => (slide.narration || '').trim()

export const planPages = (snapshot: Snapshot, pages: string[]): PlanPage[] =>
  pages.map((id) => {
    const slide = snapshot.project.slides.find((entry) => entry.id === id)
    if (!slide) throw new Error(`The page ${id} is no longer in the notebook`)
    return {
      id,
      title: slide.title,
      script: pageScript(slide),
      // A finished capture, or the last good one kept, is a demo to show;
      // one still being made or that failed is not (review 7).
      capture: Boolean(readyCapture(slide.capture))
    }
  })

/** The length an episode asks for: the creator's, else its direction's,
 * else a short explainer's, flexible. */
export const lengthGoalOf = (snapshot: Snapshot): LengthGoal => {
  const settings = snapshot.project.video?.settings
  if (settings?.length) return settings.length
  if (snapshot.project.episode?.length) return snapshot.project.episode.length
  const range =
    settings?.direction?.length || snapshot.project.direction?.length
  return range
    ? { min: range[0], max: range[1], strict: false }
    : { min: 45, max: 120, strict: false }
}

const seconds = (value: number) =>
  value >= 120 ? `${Math.round(value / 60)} min` : `${Math.round(value)} s`

export type SeriesContext = {
  title: string
  about: string
  arc?: Array<{ title: string; carries: string }>
  part?: { title: string; carries: string }
  number: number
  previously?: string
  threads?: string[]
  next?: string
  /** What a viewer can do by the end of the series, and who it is for. */
  outcome?: string
  audience?: string
  /** This episode in what the series teaches: its win, what it teaches,
   * and what it builds on (from which earlier episode). */
  win?: string
  teaches?: string[]
  needs?: string[]
  /** What no card covers and the creator asked this episode to explain. */
  explain?: string[]
}

/** How the pages' scripts meet the length: spoken as they are, paced to
 * land inside it, or cut to its word budget. */
const scriptLine = (
  voMode: 'verbatim' | 'restructure',
  length: LengthGoal,
  spoken?: number
) => {
  const [few, many] = wordBudget(length)
  if (voMode === 'restructure')
    return `Script: the pages' scripts run longer than the strict length allows. Cut them to about ${few}–${many} words in all, keeping the creator's own words wherever you keep a line.`
  const said = "Script: each page's script is spoken word for word."
  if (!spoken) return said
  const runs = `${said} Spoken, the scripts run about ${seconds(spoken)}`
  const fit = fitOf(spoken, length)
  return fit === 'short'
    ? `${runs}, short of ${seconds(length.min)}: keep every word, and reach the length with room: frames that breathe, a held frame where the message lands, a silent beat between scenes, each given its seconds.`
    : fit === 'long'
      ? `${runs}, past the ${seconds(length.max)} aimed for: pace them tightly, with no held frames.`
      : `${runs}: pace the frames to land inside the length.`
}

/** BRIEF.md: the episode, its length, its series, what may be shown. */
export const episodeBrief = (input: {
  title: string
  length: LengthGoal
  camera: boolean
  voMode: 'verbatim' | 'restructure'
  /** How long the pages' scripts run, spoken. */
  spoken?: number
  series?: SeriesContext
  note?: string
  builds?: Record<string, BuildType>
  brand?: { name?: string; tagline?: string; logo?: string | null }
  /** The creator's limits and caveats on what the pages say. */
  limits?: Limit[]
}) => {
  const { length, series, brand } = input
  const lines = [
    '---',
    'workflow: faceless-explainer',
    'flow: automation',
    'storyboard: yes',
    'aspect: 1920x1080',
    'language: en',
    `length: ${Math.round((length.min + length.max) / 2)}s`,
    '---',
    '',
    `# ${input.title}`,
    '',
    '## Intent',
    '',
    `One episode, told as one storyboard. Length: ${seconds(length.min)} to ${seconds(length.max)}, ${length.strict ? 'strict: the plan must fit' : 'flexible: a target, not a limit'}.`,
    'Pace, as narration.md and story-design.md say: about 2.5 words a second, the script a little shorter than the video; a 3–5 s hook; one or two sentences a frame (6–20 words); a held frame where the message lands.',
    input.camera
      ? 'The creator may appear on camera: a camera scene waits for their take.'
      : 'The creator stays off camera: no camera scenes.',
    scriptLine(input.voMode, length, input.spoken),
    ''
  ]
  if (series)
    lines.push(
      '## Series',
      '',
      `Episode ${series.number} of "${series.title}": ${series.about}`,
      ...(series.outcome
        ? ['', `By the end of the series, viewers can: ${series.outcome}`]
        : []),
      ...(series.audience ? [`For: ${series.audience}`] : []),
      ...(series.win
        ? [
            '',
            `This episode's win (what the viewer can do after it): ${series.win}`,
            ...(series.teaches?.length
              ? [`It teaches: ${series.teaches.join('; ')}`]
              : []),
            ...(series.explain?.length
              ? [
                  `Explain in a line, as no page does: ${series.explain.join('; ')}`
                ]
              : []),
            ...(series.needs?.length
              ? [
                  `It builds on: ${series.needs.join('; ')}. Say each in a line, never teach it again.`
                ]
              : [])
          ]
        : []),
      ...(series.arc?.length
        ? [
            '',
            'The arc:',
            ...series.arc.map(
              (part, index) => `${index + 1}. ${part.title}: ${part.carries}`
            )
          ]
        : []),
      ...(series.part
        ? [
            '',
            `This episode's part: ${series.part.title}: ${series.part.carries}`
          ]
        : []),
      ...(series.previously ? ['', `Previously: ${series.previously}`] : []),
      ...(series.threads?.length
        ? ['', `Open threads: ${series.threads.join('; ')}`]
        : []),
      ...(series.next ? ['', `Next: ${series.next}`] : []),
      '',
      'Keep the series one story: call back to what came before in the first frame, hand off to what comes next in the last, and keep the threads alive.',
      ''
    )
  if (brand?.name || brand?.logo)
    lines.push(
      '## Brand',
      '',
      ...(brand.name
        ? [`Name: ${brand.name}${brand.tagline ? ` — ${brand.tagline}` : ''}`]
        : []),
      brand.logo
        ? `Logo: ${brand.logo}. Set "logo": true on the frames that show it (an end card, a corner mark); never invent or redraw one.`
        : 'There is no logo: no frame shows one.',
      ''
    )
  const chosen = Object.entries(input.builds || {})
  if (chosen.length)
    lines.push(
      '## Builds the creator chose',
      '',
      ...chosen.map(([page, build]) => `- ${page}: ${build}`),
      ''
    )
  // The planner writes words of its own (a call-back, a hand-off, a line it
  // restructured): it reads the limits they must keep, as the segue writer
  // does (review 8, round 2's audit: its brief carried none).
  if (input.limits?.length)
    lines.push(
      "## The creator's limits",
      '',
      'Promise no more than these allow: no never, always or guarantee past them, and a frame that touches one keeps its caveat.',
      '',
      ...input.limits.map((limit) => `- “${limit.says}” (${limit.from})`),
      ''
    )
  if (input.note) lines.push('## The creator asks', '', input.note.trim(), '')
  return lines.join('\n')
}

const plainWords = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
/**
 * What a page's frames may say unchecked, by page: its own script, not the
 * segues written around it (the line in, the line out), unless the creator
 * kept that line as it is. The outro the live run flagged was in the script
 * the planner speaks, and so went unchecked (review 8, round 2's audit).
 */
export const ownScripts = (snapshot: Snapshot, pages: string[]) =>
  Object.fromEntries(
    pages.map((id) => {
      const slide = snapshot.project.slides.find((entry) => entry.id === id)
      const kept = snapshot.project.segueChecks?.[id]
      const lines = (['bridge', 'outro'] as const).flatMap((line) =>
        slide?.[line] && kept?.[line]?.kept && kept[line]!.line === slide[line]
          ? [slide[line]!]
          : []
      )
      return [id, [slide?.base ?? slide?.narration ?? '', ...lines].join(' ')]
    })
  )

/**
 * What the plan's frames promise past the creator's words: only what a
 * frame says that no page's own script does (its own call-back or hand-off,
 * a line it restructured, a segue it speaks), checked against the creator's
 * material (review 8).
 */
export const frameClaims = (
  plan: EpisodePlan,
  pages: PlanPage[],
  material: Passage[],
  own: Record<string, string> = {}
) => {
  const scripts = pages.map((page) => plainWords(own[page.id] ?? page.script))
  return plan.scenes
    .flatMap((scene) => scene.frames)
    .flatMap((frame) => {
      const own = sentencesOf(frame.voiceover || '').filter(
        (sentence) =>
          !scripts.some((script) => script.includes(plainWords(sentence)))
      )
      const [claim] = own.length ? overclaims(own.join(' '), material) : []
      return claim ? [{ number: frame.number, claim }] : []
    })
}

export const planEpisode = async (input: {
  snapshot: Snapshot
  dir: string
  productionId: string
  pages: string[]
  selection: CreativeSelection
  origin: string
  series?: SeriesContext
  note?: string
  previous?: EpisodePlan
  builds?: Record<string, BuildType>
  logo?: string | null
  /** The creator's material its words may promise no more than. */
  material?: Passage[]
}) => {
  const { snapshot } = input
  const pages = planPages(snapshot, input.pages)
  const length = lengthGoalOf(snapshot)
  const camera = (snapshot.project.video?.settings.presence || 'off') !== 'off'
  const voMode = voModeFor(pages, length)
  const material = input.material || []
  const own = ownScripts(snapshot, input.pages)
  const brief = episodeBrief({
    title: snapshot.project.title,
    length,
    camera,
    voMode,
    spoken: spokenSeconds(pages.map((page) => page.script).join(' ')),
    series: input.series,
    note: input.note,
    builds: input.builds,
    brand: {
      name: snapshot.project.branding?.name,
      tagline: snapshot.project.branding?.tagline,
      logo: input.logo
    },
    limits: limitsFor(
      material,
      pages.map((page) => `${page.title} ${page.script}`).join(' ')
    )
  })
  const frameDesign = await readFile(join(input.dir, 'frame.md'), 'utf8')
  const blueprints = blueprintIds()
  const packet: Record<string, string> = {
    'packet/BRIEF.md': brief,
    'packet/PAGES.json': JSON.stringify(
      pages.map((page) => {
        const slide = snapshot.project.slides.find(
          (entry) => entry.id === page.id
        )!
        return {
          id: page.id,
          title: page.title,
          script: page.script,
          ...(slide.idea ? { idea: slide.idea } : {}),
          ...(slide.pageKind ? { kind: slide.pageKind } : {}),
          ...(slide.parts?.length ? { parts: slide.parts } : {}),
          ...(slide.beats?.length ? { beats: slide.beats } : {}),
          ...(slide.evidence?.length ? { evidence: slide.evidence } : {}),
          capture: page.capture,
          ...(slide.svg ? { picture: `packet/pages/${page.id}.svg` } : {})
        }
      }),
      null,
      1
    ),
    'packet/SOURCE.md': snapshot.project.source,
    'packet/FRAME.md': frameDesign
  }
  for (const page of pages) {
    const svg = snapshot.project.slides.find(
      (entry) => entry.id === page.id
    )?.svg
    if (svg && /^[a-zA-Z0-9_.-]+$/.test(page.id))
      packet[`packet/pages/${page.id}.svg`] = svg
  }
  if (input.previous)
    packet['packet/PREVIOUS.json'] = JSON.stringify(input.previous, null, 1)
  const plan = await runValidatedJsonStage<EpisodePlan>({
    projectId: snapshot.project.id,
    inputKey: fingerprintOf({
      production: input.productionId,
      brief,
      pages,
      frameDesign,
      previous: input.previous ?? null,
      harness: input.selection
    }),
    checkpoint: 'storyboard-plan',
    stage: 'storyboard',
    route: 'Plan Episode',
    stageContext: { productionId: input.productionId },
    file: 'plan/episode.json',
    tool: 'storyboard_submit_plan',
    operation: 'storyboard',
    skillFiles: PLAN_SKILL_FILES,
    packet,
    selection: input.selection,
    origin: input.origin,
    // A frame's own words that promise past the creator's go back once.
    validate: askOnce(
      (raw) =>
        checkEpisodePlan(raw, {
          pages,
          camera,
          length,
          blueprints,
          builds: input.builds,
          voMode,
          logo: Boolean(input.logo)
        }),
      (plan) =>
        frameClaims(plan, pages, material, own).map((item) =>
          claimProblem(`Frame ${item.number}`, item.claim)
        )
    )
  })
  // What still promises past them after the rewrite: flagged on its frame.
  const claims = frameClaims(plan, pages, material, own)
  return { plan, length, brief, claims }
}

/** BRIEF.md, STORYBOARD.md and SCRIPT.md in the project, from the plan. */
export const writePlanFiles = async (
  dir: string,
  plan: EpisodePlan,
  brief: string,
  options: {
    target: number
    voice: string
    mode?: 'collaborative' | 'autonomous'
  }
) => {
  await writeFile(join(dir, 'BRIEF.md'), brief)
  await writeFile(
    join(dir, 'STORYBOARD.md'),
    renderStoryboard(plan, {
      format: '1920x1080',
      target: options.target,
      mode: options.mode
    })
  )
  await writeFile(
    join(dir, 'SCRIPT.md'),
    renderScript(plan, { name: options.voice })
  )
}
