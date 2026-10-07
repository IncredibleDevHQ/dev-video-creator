import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, expect, it } from 'vitest'
import type { Project } from '../shared/model'
import {
  EVIDENCE_LABELS,
  FUNCTION_LABELS,
  SPEAKER_LABELS
} from '../shared/narratives'
import {
  SHOTS,
  directedPresence,
  orchestrate,
  presenceAt,
  seamPlan,
  shotBrief
} from '../shared/orchestration'
import { templateSketch } from '../app/template-sketches'
const root = await mkdtemp(join(tmpdir(), 'minimal-orchestration-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const { writeRow } = await import('./persistence')
const { castProblems, castRegistry } = await import('./creative/cast-registry')
const { shotProblems } = await import('./creative/orchestration')
const { renderScenePacket } = await import('./creative/brief-adapter')
afterAll(() => rm(root, { recursive: true, force: true }))

it('names only recipes the pinned catalog has, and shots it can draw', async () => {
  const catalog = JSON.parse(
    await readFile(
      new URL('../skills/video-planner/capabilities.json', import.meta.url),
      'utf8'
    )
  ) as { entries: Array<{ id: string }> }
  const known = new Set(catalog.entries.map((entry) => entry.id))
  expect(new Set(SHOTS.map((shot) => shot.id)).size).toBe(SHOTS.length)
  for (const shot of SHOTS) {
    for (const recipe of shot.recipes)
      expect(known.has(recipe), recipe).toBe(true)
    for (const kind of shot.serves) expect(EVIDENCE_LABELS[kind]).toBeTruthy()
    for (const fn of shot.suits) expect(FUNCTION_LABELS[fn]).toBeTruthy()
    for (const place of shot.speaker) expect(SPEAKER_LABELS[place]).toBeTruthy()
    expect(templateSketch(shot.example)).not.toBe(templateSketch('none'))
  }
})

it('gives each scene its presence by its place in the video', () => {
  const at = (onCamera: Parameters<typeof directedPresence>[0]) =>
    [0, 1, 2].map((index) => directedPresence(onCamera, index, 3))
  expect(at('none')).toEqual(['off', 'off', 'off'])
  expect(at('ends')).toEqual(['high', 'off', 'low'])
  expect(at('guide')).toEqual(['high', 'low', 'low'])
  expect(at('leads')).toEqual(['high', 'high', 'high'])
  const settings = {
    presence: 'low' as const,
    voice: { kind: 'record' as const },
    narrative: 'incident',
    direction: { preset: 'briefing' as const }
  }
  expect(presenceAt(settings, 1, 3)).toBe('off')
  expect(presenceAt(settings, 1, 3, 'high')).toBe('high')
  expect(presenceAt({ ...settings, narrative: undefined }, 1, 3)).toBe('low')
})

const project = (scenes: Array<{ shot?: string }> = []) =>
  ({
    id: 'p',
    title: 'Outage',
    source: '',
    narrative: 'incident',
    slides: [
      {
        id: 'a',
        title: 'Outage',
        svg: '<svg/>',
        pageKind: 'title',
        beats: ['impact']
      },
      {
        id: 'b',
        title: 'The spike',
        svg: '<svg/>',
        pageKind: 'numbers',
        beats: ['timeline'],
        needs: [{ kind: 'numbers', what: 'failures', source: null }]
      },
      {
        id: 'c',
        title: 'Why',
        svg: '<svg/>',
        pageKind: 'diagram',
        beats: ['cause']
      },
      {
        id: 'd',
        title: 'Fix',
        svg: '<svg/>',
        pageKind: 'diagram',
        beats: ['cause', 'fix']
      },
      {
        id: 'e',
        title: 'Lessons',
        svg: '<svg/>',
        pageKind: 'close',
        beats: ['changes']
      }
    ],
    video: {
      settings: {
        presence: 'low',
        voice: { kind: 'record' },
        narrative: 'incident',
        direction: { preset: 'briefing' }
      },
      scenes: ['a', 'b', 'c', 'd', 'e'].map((id, index) => ({
        id: `scene-${id}`,
        slideId: id,
        phase: 'waiting',
        presence: null,
        moments: [],
        inputKey: '',
        produced: null,
        error: null,
        ...scenes[index]
      })),
      transitions: [],
      inputKey: '',
      produced: null
    }
  }) as unknown as Project

it('chooses a shot for every scene from its page, its beats and the direction', () => {
  const shots = orchestrate(project())!
  expect(shots.map((scene) => scene.shot.id)).toEqual([
    'title-reveal',
    'chart-read',
    'diagram-build',
    'side-by-side',
    'points-land'
  ])
  expect(shots[2].why).toBe(
    'its page is a diagram; “Cause” is pictured this way'
  )
  expect(shots[1].why).toContain('its page is about numbers')
  expect(shots.map((scene) => scene.presence)).toEqual([
    'high',
    'off',
    'off',
    'off',
    'low'
  ])
  expect(shots[2].speaker).toBe('off')
  // The creator's choice wins, and leaves the other scenes as they were.
  const chosen = orchestrate(project([{}, {}, { shot: 'code-focus' }]))!
  expect(chosen[2]).toMatchObject({
    chosenBy: 'creator',
    why: 'you chose it'
  })
  expect(chosen[2].shot.id).toBe('code-focus')
  expect(chosen.map((scene) => scene.suggested.id)).toEqual(
    shots.map((scene) => scene.shot.id)
  )
  // Without a template there is nothing to orchestrate.
  const plain = project()
  delete plain.video!.settings.narrative
  expect(orchestrate(plain)).toBeNull()
})

it('plans the seams in one direction, and tells each scene its own', () => {
  const shots = orchestrate(project())!
  const seams = seamPlan(shots)
  expect(seams).toEqual(['push-left', 'push-left', 'crossfade', 'push-left'])
  expect(seamPlan(shots, 'cold-open')[0]).toBe('wipe')
  expect(shotBrief(shots, 0, seams)).toMatchObject({
    id: 'title-reveal',
    entry: null,
    exit: 'push-left'
  })
  expect(shotBrief(shots, 3, seams)).toMatchObject({
    entry: 'crossfade',
    exit: 'push-left',
    speaker: 'Speaker off'
  })
})

it('holds a plan to its shot, and its actors to the cast', async () => {
  const shot = shotBrief(orchestrate(project())!, 2, [])
  const moment = (recipes: Array<{ id: string; catalog: string }>) => ({
    moments: [{ recipes }]
  })
  expect(
    shotProblems(
      moment([{ id: 'svg-path-draw', catalog: 'rule' }]) as never,
      shot
    )
  ).toEqual([])
  expect(
    shotProblems(moment([{ id: 'my-own', catalog: 'adapted' }]) as never, shot)
  ).toEqual([])
  expect(
    shotProblems(
      moment([{ id: 'kinetic-beat-slam', catalog: 'rule' }]) as never,
      shot
    )[0]
  ).toContain('This scene is a "Diagram build" shot')
  // The cast comes from the other scenes' current plans.
  const video = project()
  video.video!.scenes[0].planKey = 'k0'
  video.video!.scenes[1].planKey = 'k1'
  const object = (entity: string, ref: string) => ({
    entity,
    role: 'Limits traffic',
    appearance: 'A gate',
    performance: '',
    asset: { status: 'reuse', ref }
  })
  await writeRow('creative-scenes', 'scene-a', {
    inputKey: 'k0',
    treatment: {
      objects: [object('limiter', 'lib:limiter')],
      continuity: { exit: 'Gate closed' }
    }
  })
  await writeRow('creative-scenes', 'scene-b', {
    inputKey: 'stale',
    treatment: {
      objects: [object('queue', 'lib:queue')],
      continuity: { exit: '' }
    }
  })
  const cast = await castRegistry(video, 'scene-c')
  expect(cast).toEqual([
    {
      entity: 'limiter',
      role: 'Limits traffic',
      appearance: 'A gate',
      asset: { status: 'reuse', ref: 'lib:limiter' },
      scenes: [{ scene: 'scene-a', number: 1, exit: 'Gate closed' }]
    }
  ])
  expect(
    castProblems({ objects: [object('limiter', 'lib:limiter')] } as never, cast)
  ).toEqual([])
  expect(
    castProblems(
      { objects: [object('limiter', 'lib:other')] } as never,
      cast
    )[0]
  ).toContain('"limiter" is already in the video (scene 1) as lib:limiter')
  expect(
    castProblems(
      {
        objects: [{ ...object('limiter', ''), asset: { status: 'native' } }]
      } as never,
      cast
    )
  ).toEqual([])
})

it('tells the planner its shot, its seams and the cast so far', () => {
  const shots = orchestrate(project())!
  const text = renderScenePacket({
    videoTitle: 'Outage',
    scene: { id: 'scene-d', title: 'Fix', index: 3, originScenes: ['d'] },
    presentation: [],
    script: '',
    units: [],
    adjacent: [],
    direction: { video: '', scene: '' },
    delivery: 'human',
    shot: shotBrief(shots, 3, seamPlan(shots)),
    castSize: 2,
    reviewed: null,
    assets: []
  })
  expect(text).toContain('## The shot')
  expect(text).toContain(
    'The orchestrator chose a "Side by side" shot for this scene'
  )
  expect(text).toContain(
    'Start from its recipes — comparison-split, split-tilt-cards'
  )
  expect(text).toContain(
    'The scene opens from a dissolve: the same beat goes on, so keep the frame close.'
  )
  expect(text).toContain('It hands over with a push forward, to the next beat.')
  expect(text).toContain('packet/CAST.json lists the 2 actors')
})
