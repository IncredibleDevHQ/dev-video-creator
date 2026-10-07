import { expect, it } from 'vitest'
import {
  EVIDENCE_LABELS,
  FUNCTION_LABELS,
  LENGTHS,
  NARRATIVES,
  PRESETS,
  STORY_GROUPS,
  allocateBeats,
  allowedPresets,
  assignBeats,
  directionSettings,
  groupNarratives,
  legacyNarrative,
  lengthLabel,
  narrativeAt,
  narrativeBrief,
  narrativeById,
  openRequests,
  pageRange,
  plannedPages,
  storyPlanBrief,
  coverage,
  presenceFor,
  presenterLayoutFor,
  sceneNarrative,
  speakerFor,
  validDirection,
  type DirectionSettings
} from '../shared/narratives'
import { templateSketch } from '../app/template-sketches'

const every = (fn: (settings: DirectionSettings, where: string) => void) => {
  for (const narrative of NARRATIVES)
    for (const preset of allowedPresets(narrative))
      fn(
        directionSettings(narrative, { preset: preset.id }),
        `${narrative.id} ${preset.id}`
      )
}

it('holds sixty-one narratives in seven groups, each with a spine', () => {
  expect(NARRATIVES).toHaveLength(61)
  expect(new Set(NARRATIVES.map((item) => item.id)).size).toBe(61)
  for (const group of STORY_GROUPS)
    expect(groupNarratives(group.id).length).toBeGreaterThanOrEqual(3)
  for (const narrative of NARRATIVES) {
    const where = narrative.id
    expect(STORY_GROUPS.some((group) => group.id === narrative.group)).toBe(
      true
    )
    expect(narrative.name && narrative.line && narrative.audience).toBeTruthy()
    // A length belongs to the direction, never to the narrative.
    expect(narrative.line, where).not.toMatch(/\b(minute|second)s?\b/)
    expect(narrative.rules.length, where).toBeGreaterThan(0)
    expect(narrative.needs.length, where).toBeGreaterThan(0)
    expect(narrative.excludes, where).not.toContain(narrative.preset)
    for (const id of [narrative.preset, ...narrative.excludes])
      expect(
        PRESETS.some((preset) => preset.id === id),
        where
      ).toBe(true)
    const ids = narrative.beats.map((beat) => beat.id)
    expect(new Set(ids).size, where).toBe(ids.length)
    expect(
      narrative.beats.filter((beat) => beat.core).length,
      where
    ).toBeGreaterThanOrEqual(2)
    for (const beat of narrative.beats) {
      expect(FUNCTION_LABELS[beat.function], `${where} ${beat.id}`).toBeTruthy()
      expect(beat.name && beat.know, `${where} ${beat.id}`).toBeTruthy()
      expect(beat.evidence.length, `${where} ${beat.id}`).toBeGreaterThan(0)
      for (const kind of beat.evidence)
        expect(EVIDENCE_LABELS[kind], `${where} ${beat.id}`).toBeTruthy()
    }
  }
})

it('draws an example for every beat, with no speaker in it', () => {
  const blank = templateSketch('none')
  for (const narrative of NARRATIVES)
    for (const beat of narrative.beats) {
      const where = `${narrative.id} ${beat.id}`
      const sketch = templateSketch(beat.example)
      expect(sketch, where).not.toBe(blank)
      // The direction places the speaker; an example never fixes it.
      expect(/sk-cam|sk-ring/.test(sketch), where).toBe(false)
      expect(beat.example, where).not.toBe('keynote')
    }
})

it('offers six directions, each length a range', () => {
  expect(PRESETS.map((preset) => preset.id)).toEqual([
    'short-dramatic',
    'briefing',
    'explainer',
    'deep-dive',
    'demo-led',
    'faceless'
  ])
  for (const [min, max] of LENGTHS) expect(min).toBeLessThan(max)
  for (const preset of PRESETS.filter((item) => item.id !== 'faceless'))
    expect(preset.length![0]).toBeLessThan(preset.length![1])
  expect(Object.keys(PRESETS.at(-1)!)).toEqual([
    'id',
    'name',
    'line',
    'onCamera'
  ])
  expect(lengthLabel([45, 90])).toBe('45–90 s')
  expect(lengthLabel([120, 240])).toBe('2–4 min')
  expect(lengthLabel([120, 300])).toBe('2–5 min')
  expect(lengthLabel([1200, 1500])).toBe('20–25 min')
})

it('resolves a direction: the default, the preset, then the creator', () => {
  const incident = narrativeById('incident')!
  expect(directionSettings(incident)).toMatchObject({
    length: [120, 240],
    onCamera: 'ends',
    drama: 'calm'
  })
  expect(
    directionSettings(incident, { preset: 'short-dramatic' })
  ).toMatchObject({
    length: [45, 90],
    drama: 'dramatic',
    structure: 'cold-open'
  })
  // An excluded preset falls back to the narrative's default.
  const security = narrativeById('security')!
  expect(allowedPresets(security).map((preset) => preset.id)).not.toContain(
    'short-dramatic'
  )
  expect(
    directionSettings(security, { preset: 'short-dramatic' }).length
  ).toEqual([120, 240])
  // Faceless keeps the narrative's own default and takes you off camera.
  expect(
    directionSettings(narrativeById('myths')!, { preset: 'faceless' })
  ).toMatchObject({ length: [45, 90], drama: 'dramatic', onCamera: 'none' })
  expect(
    directionSettings(incident, { preset: 'briefing', length: [1200, 1500] })
      .length
  ).toEqual([1200, 1500])
})

it('checks a direction the creator sends', () => {
  const incident = narrativeById('incident')!
  const security = narrativeById('security')!
  expect(validDirection(incident, { preset: 'briefing' })).toEqual({
    preset: 'briefing'
  })
  expect(
    validDirection(incident, {
      preset: 'deep-dive',
      length: [1200.4, 1500],
      leads: ['code', 'code', 'demo'],
      audience: 'leaders'
    })
  ).toEqual({
    preset: 'deep-dive',
    length: [1200, 1500],
    leads: ['code', 'demo'],
    audience: 'leaders'
  })
  for (const bad of [
    { preset: 'thriller' },
    { preset: 'briefing', length: [240, 120] },
    { preset: 'briefing', length: [120, 120] },
    { preset: 'briefing', length: [5, 90] },
    { preset: 'briefing', length: 120 },
    { preset: 'briefing', drama: 'constructor' },
    { preset: 'briefing', leads: ['slides'] }
  ])
    expect(() => validDirection(incident, bad)).toThrow()
  expect(() => validDirection(security, { preset: 'short-dramatic' })).toThrow(
    'Choose one of the narrative’s directions'
  )
})

it('tells the core beats always, and the optional ones when there is room', () => {
  every((settings, where) => {
    const narrative = narrativeById(where.split(' ')[0])!
    const plans = allocateBeats(narrative, settings)
    const room = settings.length[1] >= 120 && settings.elaboration !== 'brief'
    for (const plan of plans) {
      expect(plan.told, where).toBe(plan.beat.core || room)
      if (!plan.told) expect(plan.seconds, where).toEqual([0, 0])
      if (plan.expanded)
        expect(plan.told && settings.length[1] >= 600).toBe(true)
    }
    const told = plans.filter((plan) => plan.told)
    const [min, max] = told.reduce(
      ([a, b], plan) => [a + plan.seconds[0], b + plan.seconds[1]],
      [0, 0]
    )
    expect(Math.abs(min - settings.length[0]), where).toBeLessThanOrEqual(
      told.length
    )
    expect(Math.abs(max - settings.length[1]), where).toBeLessThanOrEqual(
      told.length
    )
  })
  const incident = narrativeById('incident')!
  const short = allocateBeats(
    incident,
    directionSettings(incident, { preset: 'short-dramatic' })
  )
  expect(short.find((plan) => plan.beat.id === 'changes')!.told).toBe(false)
  const deep = allocateBeats(
    incident,
    directionSettings(incident, { preset: 'deep-dive' })
  )
  expect(deep.every((plan) => plan.told && plan.expanded)).toBe(true)
  // Material that leads gets more of the time.
  const plain = allocateBeats(incident, directionSettings(incident))
  const led = allocateBeats(
    incident,
    directionSettings(incident, { preset: 'briefing', leads: ['code'] })
  )
  const cause = (plans: typeof plain) =>
    plans.find((plan) => plan.beat.id === 'cause')!.seconds[1]
  expect(cause(led)).toBeGreaterThan(cause(plain))
})

it('spreads the beats over any number of scenes, in order', () => {
  every((settings, where) => {
    const narrative = narrativeById(where.split(' ')[0])!
    const plans = allocateBeats(narrative, settings)
    const order = plans.filter((plan) => plan.told).map((plan) => plan.beat.id)
    for (let count = 1; count <= 12; count++) {
      const scenes = assignBeats(plans, count)
      expect(scenes, `${where} ${count}`).toHaveLength(count)
      for (const beats of scenes)
        expect(beats.length, `${where} ${count}`).toBeGreaterThan(0)
      expect(new Set(scenes.flat()), `${where} ${count}`).toEqual(
        new Set(order)
      )
      const positions = scenes.flat().map((id) => order.indexOf(id))
      positions.forEach((at, index) =>
        expect(at, `${where} ${count}`).toBeGreaterThanOrEqual(
          positions[index - 1] ?? 0
        )
      )
    }
  })
  expect(assignBeats([], 0)).toEqual([])
})

it('gives each scene its beats, its time and where the speaker is', () => {
  const video = {
    settings: {
      narrative: 'incident',
      direction: { preset: 'briefing' as const }
    },
    scenes: [
      { id: 'a' },
      { id: 'b', beats: ['cause', 'nonsense'] },
      { id: 'c' },
      { id: 'd' }
    ]
  }
  expect(sceneNarrative({ settings: {}, scenes: video.scenes }, 'a')).toBeNull()
  expect(sceneNarrative(video, 'missing')).toBeNull()
  const chosen = sceneNarrative(video, 'b')!
  expect(chosen.beats.map((plan) => plan.beat.id)).toEqual(['cause'])
  const first = sceneNarrative(video, 'a')!
  expect(first.beats[0].beat.id).toBe('impact')
  const brief = narrativeBrief(first, 'low')
  expect(brief).toMatchObject({
    narrative: 'Incident walkthrough',
    direction: 'Briefing',
    length: '2–4 min',
    position: '1 of 4',
    speaker: 'Speaker beside'
  })
  expect(brief.spine).toEqual([
    'Impact',
    'Timeline',
    'Cause',
    'Fix',
    'What changes'
  ])
  expect(brief.rules[0]).toMatch(/Blameless/)
  expect(narrativeBrief(sceneNarrative(video, 'c')!, 'high').speaker).toBe(
    'Speaker off'
  )
  expect(narrativeBrief(first, 'off').speaker).toBe('Speaker off')
  const seconds = ['a', 'b', 'c', 'd'].map(
    (id) => sceneNarrative(video, id)!.seconds
  )
  for (const [min, max] of seconds) expect(min).toBeLessThan(max)
})

it('places the speaker by how much the creator is on camera', () => {
  const incident = narrativeById('incident')!
  const [impact, timeline] = incident.beats
  const words = { ...impact, evidence: ['quote' as const] }
  expect(speakerFor('none', [impact], true, false)).toBe('off')
  expect(speakerFor('ends', [timeline], false, false)).toBe('off')
  expect(speakerFor('ends', [impact], true, false)).toBe('beside')
  expect(speakerFor('guide', [timeline], false, false)).toBe('corner')
  expect(speakerFor('guide', [words], false, false)).toBe('beside')
  expect(speakerFor('leads', [impact], true, false)).toBe('over')
  expect(speakerFor('leads', [timeline], false, true)).toBe('full')
  expect(speakerFor('leads', [words], false, false)).toBe('over')
  expect(presenceFor('none')).toBe('off')
  expect(presenceFor('ends')).toBe('low')
  expect(presenceFor('leads')).toBe('high')
  expect(presenterLayoutFor('over')).toBe('full-screen')
  expect(presenterLayoutFor('beside')).toBe('beside-slide')
  expect(presenterLayoutFor('off')).toBeNull()
})

it('opens a video saved with an old template on its narrative', () => {
  expect(legacyNarrative('incident-thriller')).toBe('incident')
  expect(legacyNarrative('pr-files')).toBe('code-change')
  expect(legacyNarrative('status-update')).toBe('maintenance')
  expect(legacyNarrative('list-told')).toBe('listicle')
  expect(legacyNarrative('nonsense')).toBeUndefined()
  expect(legacyNarrative(undefined)).toBeUndefined()
})

it('suggests a page range from the length and how much it explains', () => {
  const incident = narrativeById('incident')!
  const range = (preset: string) =>
    pageRange(directionSettings(incident, { preset: preset as never }))
  expect(range('short-dramatic')).toEqual([3, 6])
  expect(range('briefing')).toEqual([3, 12])
  expect(range('explainer')).toEqual([6, 20])
  expect(range('deep-dive')).toEqual([20, 40])
  expect(range('demo-led')).toEqual([3, 15])
  const brief = storyPlanBrief(incident, { preset: 'short-dramatic' })
  expect(brief).toMatchObject({
    narrative: 'incident',
    direction: 'Short and dramatic',
    lengthLabel: '45–90 s',
    pages: [3, 6],
    structure: 'cold-open'
  })
  expect(brief.beats.map((beat) => [beat.id, beat.told])).toEqual([
    ['impact', true],
    ['timeline', true],
    ['cause', true],
    ['fix', true],
    ['changes', false]
  ])
})

it('checks which pages carry each beat, and what they still need', () => {
  const incident = narrativeById('incident')!
  expect(coverage(incident, null, [{ id: 'a' }])).toBeNull()
  const pages = [
    { id: 'a', beats: ['impact'] },
    { id: 'b', beats: ['timeline', 'cause'] },
    { id: 'c' },
    {
      id: 'd',
      beats: ['changes'],
      needs: [
        { kind: 'numbers' as const, what: 'error rate', source: null },
        { kind: 'quote' as const, what: 'the trigger', source: 'A sentence.' },
        { kind: 'timeline' as const, what: 'when it began', source: null }
      ],
      answers: [{ what: 'when it began', answer: '14:02 UTC' }]
    }
  ]
  const checked = coverage(incident, { preset: 'briefing' }, pages)!
  expect(checked.missing.map((beat) => beat.id)).toEqual(['fix'])
  expect(checked.beats.find((item) => item.beat.id === 'cause')!.pages).toEqual(
    [1]
  )
  expect(openRequests(pages)).toEqual([
    { slideId: 'd', index: 3, need: pages[3].needs![0] }
  ])
  // Pages planned for one story give their beats only to that story.
  const project = {
    narrative: 'incident',
    slides: pages,
    video: { settings: { narrative: 'incident' } }
  }
  expect(plannedPages(project)?.[1]).toEqual(['timeline', 'cause'])
  expect(
    plannedPages({ ...project, video: { settings: { narrative: 'launch' } } })
  ).toBeUndefined()
  const settings = {
    narrative: 'incident',
    direction: { preset: 'briefing' as const }
  }
  const planned = pages.map((page) => page.beats)
  const second = narrativeAt(settings, 1, 4, null, planned)!
  expect(second.beats.map((plan) => plan.beat.id)).toEqual([
    'timeline',
    'cause'
  ])
  // A page added without beats takes its share in order.
  expect(
    narrativeAt(settings, 2, 4, null, planned)!.beats.length
  ).toBeGreaterThan(0)
  expect(narrativeAt(settings, 1, 4, ['fix'], planned)!.beats[0].beat.id).toBe(
    'fix'
  )
})
