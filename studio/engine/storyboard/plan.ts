// Plan Episode: the agent turns the episode's pages into its storyboard
// (storyboard-master/workflows/plan-episode.md). The studio gives it the
// episode's brief, its pages with their scripts, the source and the design,
// checks the plan it submits, and writes STORYBOARD.md and SCRIPT.md.
import { readdirSync } from 'node:fs'
import { writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Snapshot } from '../../shared/api'
import type { Slide } from '../../shared/model'
import type {
  BuildType,
  EpisodePlan,
  LengthGoal
} from '../../shared/storyboard'
import {
  runValidatedJsonStage,
  type CreativeSelection
} from '../creative/stage'
import { fingerprintOf } from '../planning/fingerprint'
import { checkEpisodePlan, voModeFor, type PlanPage } from './plan-check'
import { renderScript, renderStoryboard } from './plan-files'
import { upstreamPath } from './hyperframes'

export const PLAN_SKILL_FILES = [
  'SKILL.md',
  'workflows/plan-episode.md',
  'references/build-types.md',
  'hyperframes/PROVENANCE.md',
  'hyperframes/skills/faceless-explainer/references/story-design.md',
  'hyperframes/skills/hyperframes-creative/references/story-spine.md',
  'hyperframes/skills/hyperframes/references/storyboard-format.md',
  'hyperframes/skills/hyperframes/references/script-format.md',
  'hyperframes/skills/hyperframes-animation/blueprints-index.md'
]

export const blueprintIds = () =>
  readdirSync(upstreamPath('hyperframes-animation', 'blueprints'))
    .filter((name) => name.endsWith('.md'))
    .map((name) => name.replace(/\.md$/, ''))

/** What is spoken over a page in this episode: its line in, its script, its
 * line out. */
export const pageScript = (slide: Slide) =>
  [slide.bridge, slide.narration, slide.outro]
    .map((part) => (part || '').trim())
    .filter(Boolean)
    .join(' ')

export const planPages = (snapshot: Snapshot, pages: string[]): PlanPage[] =>
  pages.map((id) => {
    const slide = snapshot.project.slides.find((entry) => entry.id === id)
    if (!slide) throw new Error(`The page ${id} is no longer in the notebook`)
    return {
      id,
      title: slide.title,
      script: pageScript(slide),
      capture: Boolean(slide.capture)
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
}

/** BRIEF.md: the episode, its length, its series, what may be shown. */
export const episodeBrief = (input: {
  title: string
  length: LengthGoal
  camera: boolean
  voMode: 'verbatim' | 'restructure'
  series?: SeriesContext
  note?: string
  builds?: Record<string, BuildType>
  brand?: { name?: string; tagline?: string; logo?: string | null }
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
    input.camera
      ? 'The creator may appear on camera: a camera scene waits for their take.'
      : 'The creator stays off camera: no camera scenes.',
    input.voMode === 'verbatim'
      ? "Script: each page's script is spoken word for word."
      : "Script: the pages' scripts run longer than the strict length allows. Cut them to fit, keeping the creator's own words wherever you keep a line.",
    ''
  ]
  if (series)
    lines.push(
      '## Series',
      '',
      `Episode ${series.number} of "${series.title}": ${series.about}`,
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
  if (input.note) lines.push('## The creator asks', '', input.note.trim(), '')
  return lines.join('\n')
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
}) => {
  const { snapshot } = input
  const pages = planPages(snapshot, input.pages)
  const length = lengthGoalOf(snapshot)
  const camera = (snapshot.project.video?.settings.presence || 'off') !== 'off'
  const voMode = voModeFor(pages, length)
  const brief = episodeBrief({
    title: snapshot.project.title,
    length,
    camera,
    voMode,
    series: input.series,
    note: input.note,
    builds: input.builds,
    brand: {
      name: snapshot.project.branding?.name,
      tagline: snapshot.project.branding?.tagline,
      logo: input.logo
    }
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
    validate: (raw) =>
      checkEpisodePlan(raw, {
        pages,
        camera,
        length,
        blueprints,
        builds: input.builds,
        voMode,
        logo: Boolean(input.logo)
      })
  })
  return { plan, length, brief }
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
