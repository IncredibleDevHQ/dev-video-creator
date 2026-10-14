import { expect, it } from 'vitest'
import { pathToFileURL } from 'node:url'
import {
  checkEpisodePlan,
  scriptDifference,
  voModeFor,
  wordsOf
} from './plan-check'
import { renderScript, renderStoryboard } from './plan-files'
import { upstreamPath } from './hyperframes'
import { episodeBrief } from './plan'

const pages = [
  {
    id: 'p1',
    title: 'The limit',
    script: 'Your request ended. Your stream didn’t.',
    capture: false
  },
  {
    id: 'p2',
    title: 'The pipeline',
    script: 'A frame goes in, changes, and comes back out.',
    capture: false
  }
]
const frame = (over: Record<string, unknown> = {}) => ({
  title: 'The request runs out',
  scene: 'A countdown hits zero while the picture keeps going',
  voiceover: 'Your request ended.',
  duration: 3,
  transition: 'cut',
  type: 'hook',
  persuasion: 'Before/after',
  beat: 'tension',
  narrativeRole: 'Makes the limit felt.',
  keyMessage: 'A request has a timer.',
  ...over
})
const plan = (over: Record<string, unknown> = {}) => ({
  message: 'A request has a timer; a stream does not',
  audience: 'developers',
  structure: 'story-explainer',
  hook: 'Stakes / consequence',
  direction: {
    palette: 'ink on paper',
    motion: 'reveal on cue',
    held: 'frame 3',
    never: 'no slideshow'
  },
  scenes: [
    {
      pageId: 'p1',
      build: 'camera',
      buildReason: 'The creator states the limit',
      frames: [
        frame(),
        frame({
          title: 'The stream',
          voiceover: 'Your stream didn’t.',
          transition: 'crossfade',
          type: 'pain_point'
        })
      ]
    },
    {
      pageId: 'p2',
      build: 'faceless',
      buildReason: 'A mechanism to show',
      frames: [
        frame({
          title: 'The trip',
          voiceover: 'A frame goes in, changes, and comes back out.',
          duration: 4,
          transition: 'crossfade',
          type: 'feature_showcase',
          blueprint: 'kinetic-type-beats'
        })
      ]
    }
  ],
  ...over
})
const rules = { pages, camera: true, blueprints: ['kinetic-type-beats'] }

it('accepts a plan that speaks every script and gives every frame its job', () => {
  const report = checkEpisodePlan(plan(), rules)
  expect(report.problems).toEqual([])
  expect(
    report.value.scenes.flatMap((scene) => scene.frames.map((f) => f.number))
  ).toEqual([1, 2, 3])
})

it('refuses a script not spoken word for word, and says where', () => {
  const changed = plan()
  changed.scenes[1].frames[0].voiceover = 'A frame goes in and comes back out.'
  const report = checkEpisodePlan(changed, rules)
  expect(report.ok).toBe(false)
  expect(report.problems.join(' ')).toMatch(/word for word.*changes/)
})

it('lets a strict length cut the scripts when they cannot fit', () => {
  expect(voModeFor(pages, { min: 2, max: 4, strict: true })).toBe('restructure')
  expect(voModeFor(pages, { min: 2, max: 40, strict: true })).toBe('verbatim')
  const cut = plan()
  cut.scenes[1].frames[0].voiceover = 'A frame changes on the way.'
  expect(
    checkEpisodePlan(cut, { ...rules, voMode: 'restructure' }).problems
  ).toEqual([])
})

it('holds the pages, the builds, the transitions and the length', () => {
  const report = checkEpisodePlan(
    plan({ scenes: [...plan().scenes].reverse() }),
    { ...rules, camera: false, length: { min: 30, max: 60, strict: true } }
  )
  expect(report.problems.join(' ')).toMatch(/in this order: p1, p2/)
  expect(report.problems.join(' ')).toMatch(/not on camera/)
  expect(report.problems.join(' ')).toMatch(/Frame 1 enters with a cut/)
  expect(report.problems.join(' ')).toMatch(/episode asks for 30–60 s/)
})

it('keeps the build the creator chose', () => {
  const report = checkEpisodePlan(plan(), {
    ...rules,
    builds: { p2: 'motion' }
  })
  expect(report.problems).toContain(
    'Scene 2 (The pipeline): the creator chose motion; keep it'
  )
})

it('compares words, not punctuation or quotes', () => {
  expect(wordsOf('Your stream didn’t — really.')).toEqual([
    'your',
    'stream',
    "didn't",
    'really'
  ])
  expect(scriptDifference('One, two. Three!', 'one two three')).toBe('')
  expect(scriptDifference('One two three', 'one two')).toMatch(/stops before/)
})

it('writes STORYBOARD.md that Hyperframes’ own parser reads back', async () => {
  const report = checkEpisodePlan(plan(), rules)
  const markdown = renderStoryboard(report.value, {
    format: '1920x1080',
    target: 45,
    durations: { 1: 2.4 },
    statuses: { 2: 'animated' },
    media: { 1: 'assets/takes/01.mp4' },
    shots: {
      3: {
        number: 3,
        blueprint: 'kinetic-type-beats (Adapt)',
        adapt: 'Keep the swap',
        focal: 'the word',
        roles: 'word = foreground subject',
        windows: [
          { from: 0, to: 1.5, text: 'The word enters' },
          { from: 1.5, to: 4, text: 'It swaps and holds' }
        ]
      }
    }
  })
  const { parseStoryboard } = await import(
    pathToFileURL(
      upstreamPath('faceless-explainer', 'scripts', 'lib', 'storyboard.mjs')
    ).href
  )
  const parsed = parseStoryboard(markdown)
  expect(parsed.globals.message).toBe(
    'A request has a timer; a stream does not'
  )
  expect(parsed.globals.arc).toBe('story-explainer')
  expect(parsed.frames.map((f: { number: number }) => f.number)).toEqual([
    1, 2, 3
  ])
  expect(parsed.frames[0].durationSeconds).toBe(2.4)
  expect(parsed.frames[0].src).toBe(
    'compositions/frames/f01-the-request-runs-out.html'
  )
  expect(parsed.frames[0].voiceover).toBe('Your request ended.')
  expect(parsed.frames[0].extra.media).toBe('assets/takes/01.mp4')
  expect(parsed.frames[1].status).toBe('animated')
  expect(parsed.frames[2].extra.blueprint).toBe('kinetic-type-beats (Adapt)')
  expect(parsed.frames[2].narrative).toMatch(
    /Scene 2 \(1\.5–4\.0s\): It swaps and holds/
  )
  expect(markdown.indexOf('## Video direction')).toBeLessThan(
    markdown.indexOf('## Frame 1')
  )
  const script = renderScript(report.value, { name: 'Test voice' })
  expect(script).toMatch(/## Line 3 — The trip \(Frame 3\)/)
  expect(script).toMatch(/\n {4}A frame goes in, changes, and comes back out\./)
})

it('briefs the episode with its length, the series around it and the creator’s note', () => {
  const brief = episodeBrief({
    title: 'Streams',
    length: { min: 60, max: 90, strict: true },
    camera: false,
    voMode: 'verbatim',
    series: {
      title: 'Video on Workers',
      about: 'Building video pipelines',
      number: 2,
      previously: 'We met the request timer.',
      threads: ['cost'],
      next: 'Part 3: what it costs'
    },
    note: 'Open on the numbers'
  })
  expect(brief).toMatch(/strict: the plan must fit/)
  expect(brief).toMatch(/Episode 2 of "Video on Workers"/)
  expect(brief).toMatch(/Previously: We met the request timer\./)
  expect(brief).toMatch(/Open on the numbers/)
  expect(brief).toMatch(/no camera scenes/)
})
