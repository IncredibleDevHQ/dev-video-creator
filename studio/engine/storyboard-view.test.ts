import { expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { FrameSummary, Storyboard } from '../shared/storyboard'
import { projectViews } from '../shared/state'
import { Recording } from '../app/recording'
vi.mock('../app/api', () => ({ api: {} }))
const { storyboardScreen, takeMoments, episodeClock } =
  await import('../app/storyboard-view')
const { sceneLink } = await import('../app/scene-link')

const frame = (number: number, duration: number): FrameSummary => ({
  number,
  title: `Frame ${number}`,
  scene: `What frame ${number} shows`,
  voiceover: `Line ${number} is spoken here.`,
  duration,
  transition:
    number === 1 ? 'cut' : number === 3 ? 'crossfade' : 'push-slide LEFT',
  type: 'hook',
  beat: 'curiosity',
  narrativeRole: `Why frame ${number} is there`,
  keyMessage: `Frame ${number} leaves this`,
  status: 'outline'
})

const storyboard = (change: Partial<Storyboard> = {}): Storyboard => ({
  id: 'sb-1',
  pages: ['p1', 'p2'],
  stage: 'review',
  status: 'waiting',
  plan: {
    message: 'A request has a timer; a stream doesn’t.',
    audience: 'developers new to streaming',
    structure: 'concept-explainer',
    hook: 'Rhetorical question',
    continuity: 'Opens on last episode’s timer.',
    scenes: [
      {
        pageId: 'p1',
        build: 'faceless',
        buildReason: 'It explains.',
        frames: [frame(1, 4), frame(2, 6)]
      },
      {
        pageId: 'p2',
        build: 'camera',
        buildReason: 'It is the creator’s verdict.',
        take: null,
        frames: [frame(3, 5), frame(4, 3)]
      }
    ]
  },
  updatedAt: '2026-10-15T00:00:00.000Z',
  ...change
})

const snapshot = (value: Storyboard): Snapshot => {
  const project = {
    id: 'n',
    title: 'Fixture',
    source: 'Fixture',
    slides: ['p1', 'p2', 'p3'].map((id) => ({
      id,
      title: `Page ${id}`,
      svg: `<svg id="${id}" viewBox="0 0 1280 720"></svg>`
    })),
    video: {
      settings: {
        presence: 'high',
        voice: { kind: 'ai', id: 'v' },
        production: 'storyboard'
      },
      scenes: [],
      transitions: [],
      inputKey: 'v',
      produced: null,
      storyboard: value
    }
  } as unknown as Snapshot['project']
  return {
    project,
    status: 'ready',
    error: null,
    events: [],
    views: projectViews(project, [])
  }
}

const idle = () =>
  new Recording(
    () => {},
    () => {}
  )

it('lays the plan out like the Wireframe page: scenes in the rail, the page on the stage', () => {
  const html = storyboardScreen(snapshot(storyboard()), null, idle(), null)
  expect(html).toContain('class="rail scene-rail"')
  expect(html).toContain('data-action="sb-scene" data-index="1"')
  expect(html).toMatch(
    /thumbnail selected" data-action="sb-scene" data-index="0"/
  )
  // Reviewed, the whole proposal shows, and the plan can be changed.
  expect(html).toContain('For developers new to streaming')
  expect(html).toContain('Opens on last episode’s timer.')
  expect(html).toContain('data-action="sb-approve"')
  expect(html).toContain('data-action="sb-change"')
  expect(html).toContain('data-sb-build')
  // The first scene's page, its frames, and its first frame's line.
  expect(html).toContain('<svg id="p1"')
  expect(html).toContain('data-action="sb-frame" data-number="2"')
  expect(html).toContain('“Line 1 is spoken here.”')
})

it('shows a camera scene with its stand-in until its take, and offers Record', () => {
  const html = storyboardScreen(
    snapshot(storyboard({ stage: 'voice', approved: true })),
    { projectId: 'n', scene: 1, frame: 4 },
    idle(),
    null
  )
  expect(html).toContain('presenter-layout-beside-slide')
  expect(html).toContain('Your take goes here')
  expect(html).toContain(
    'data-action="sb-record" data-page="p2" class="primary"'
  )
  expect(html).toContain('data-action="sb-upload" data-page="p2"')
  expect(html).toContain('One scene waits for your take')
  expect(html).toContain('“Line 4 is spoken here.”')
})

it('plays the made episode on the stage, with one line about it', () => {
  const html = storyboardScreen(
    snapshot(
      storyboard({
        stage: 'done',
        status: 'done',
        produced: { objectKey: 'k.mp4', duration: 18 },
        posterKey: 'p.jpg'
      })
    ),
    null,
    idle(),
    null
  )
  expect(html).toContain(
    '<video class="sb-player" data-sb-player src="/objects/k.mp4" poster="/objects/p.jpg"'
  )
  expect(html).not.toContain('For developers new to streaming')
  expect(html).toContain('Concept explainer · 18 s')
})

it('records a camera scene in place, a line at a time on the prompter', () => {
  const value = storyboard({ stage: 'voice', approved: true })
  const capture = idle()
  capture.phase = 'ready'
  capture.moments = takeMoments(value.plan!.scenes[1])
  const html = storyboardScreen(
    snapshot(value),
    { projectId: 'n', scene: 1, frame: null },
    capture,
    'p2'
  )
  expect(html).toContain('storyboard-workspace is-focused')
  expect(html).toContain('Get ready to record')
  expect(html).toContain('<video data-camera autoplay muted playsinline>')
  expect(html).toContain('<span data-prompter>Line 3 is spoken here.</span>')
  expect(html).toContain('Then: Line 4 is spoken here.')
  expect(html).toContain('2 lines · 3-second countdown')
})

it('cuts a take across a scene’s spoken frames and times the episode', () => {
  const value = storyboard()
  expect(
    takeMoments(value.plan!.scenes[1]).map((m) => [m.id, m.camera])
  ).toEqual([
    ['f03-frame-3', 'full'],
    ['f04-frame-4', 'full']
  ])
  const clock = episodeClock(value)
  expect(clock.map((scene) => [scene.start, scene.end])).toEqual([
    [0, 10],
    [10, 18]
  ])
  expect(clock[1].frames[1]).toEqual({ number: 4, start: 15, end: 18 })
})

it('says under a wireframe where its storyboard scene stands', () => {
  const made = snapshot(storyboard())
  expect(sceneLink(made, 1, false).line).toContain(
    'Scene 2 · On camera · waits for your take'
  )
  expect(sceneLink(made, 0, false).line).toContain('data-action="open-scene"')
  expect(sceneLink(made, 2, false).line).toContain('Not in this video')
  expect(sceneLink(made, 0, false).line).not.toContain('make-scene')
})

it('shows how each frame enters, and the change of scene in words', () => {
  const html = storyboardScreen(
    snapshot(storyboard({ stage: 'done', status: 'done' })),
    { projectId: 'n', scene: 1, frame: 3 },
    idle(),
    null
  )
  // Between scenes 1 and 2, in the rail: a crossfade into a scene runs longer.
  expect(html).toContain('Between scenes 1 and 2: Crossfade · 0.8 s')
  expect(html).toMatch(
    /sb-scene-change" data-action="sb-transition" data-number="3"/
  )
  // Between frames 3 and 4, in the strip, as a mark.
  expect(html).toContain('title="Into frame 4: Push left"')
  expect(html).toContain('<dt>Enters with</dt><dd>Crossfade · 0.8 s</dd>')
  // While the episode is made, nothing changes it.
  const working = storyboardScreen(
    snapshot(
      storyboard({ stage: 'frames', status: 'working', approved: true })
    ),
    { projectId: 'n', scene: 0, frame: null },
    idle(),
    null
  )
  expect(working).toMatch(
    /data-action="sb-transition" data-number="2"[^>]*disabled/
  )
})

const posed = (value: Storyboard, numbers: number[]) => ({
  ...value,
  plan: {
    ...value.plan!,
    scenes: value.plan!.scenes.map((scene) => ({
      ...scene,
      frames: scene.frames.map((entry) =>
        numbers.includes(entry.number)
          ? { ...entry, status: 'built' as const, still: `t${entry.number}` }
          : entry
      )
    }))
  }
})

it('shows the stills for the creator’s go: the stage, the strip and the rail', () => {
  const value = posed(
    storyboard({
      stage: 'board',
      status: 'waiting',
      waitingFor: 'approval',
      approved: true
    }),
    [1, 2, 3, 4]
  )
  const html = storyboardScreen(
    snapshot(value),
    { projectId: 'n', scene: 0, frame: 2 },
    idle(),
    null
  )
  expect(html).toContain('The stills are ready: approve them, or change one')
  // The chosen frame's still on the stage, every frame's small in the strip,
  // each scene's first still in the rail.
  expect(html).toContain(
    '<img class="sb-shot" src="/api/projects/n/storyboard/frames/f02-frame-2/still?v=t2" alt="Frame 2, its still">'
  )
  expect(html).toContain(
    '<img class="sb-thumb" src="/api/projects/n/storyboard/frames/f01-frame-1/still?v=t1" alt="">'
  )
  expect(html).toContain(
    '<img class="sb-rail-still" src="/api/projects/n/storyboard/frames/f03-frame-3/still?v=t3" alt="">'
  )
  expect(html).not.toContain('<svg id="p1"')
  expect(html).toContain('data-action="sb-still" data-number="2"')
  expect(html).toMatch(
    /data-action="sb-approve" class="primary"\s*>Approve the stills<\/button>/
  )
  // Nothing is made yet: no nudge for the camera scene's take.
  expect(html).not.toContain('recording-nudge')
  // A camera scene's still carries its own layout: no stand-in beside it.
  const camera = storyboardScreen(
    snapshot(value),
    { projectId: 'n', scene: 1, frame: 3 },
    idle(),
    null
  )
  expect(camera).not.toContain('Your take goes here')
  // Record is there, and does not compete with the approval.
  expect(camera).toMatch(/data-action="sb-record" data-page="p2"\s+>Record</)
  expect(camera).toContain('f03-frame-3/still?v=t3" alt="Frame 3, its still"')
})

it('poses the stills in view: blanks hold their place, and a note says it is posed again', () => {
  const value = posed(
    storyboard({
      stage: 'stills',
      status: 'working',
      approved: true,
      frameNotes: { 1: 'Make the timer bigger' }
    }),
    [1]
  )
  const html = storyboardScreen(
    snapshot(value),
    { projectId: 'n', scene: 0, frame: 1 },
    idle(),
    null
  )
  expect(html).toContain('Posing the stills · 1 of 4')
  expect(html).toContain('<span class="sb-thumb is-empty" aria-hidden="true">')
  expect(html).toContain('Posing this still again')
  expect(html).toContain('Your note: “Make the timer bigger”')
  expect(html).toContain('Hook · Posing again')
  expect(html).toContain('Hook · Posing</small>')
  expect(html).toMatch(/sb-rail-state is-working.*Posing/)
  // Being posed again, it is not offered for another change; no approval yet.
  expect(html).not.toContain('data-action="sb-still"')
  expect(html).not.toContain('data-action="sb-approve"')
  // A posed frame can take a note while the others are posed.
  const other = storyboardScreen(
    snapshot({ ...value, frameNotes: undefined }),
    { projectId: 'n', scene: 0, frame: 1 },
    idle(),
    null
  )
  expect(other).toContain('data-action="sb-still" data-number="1"')
  // The plan itself is approved before any still is posed.
  const plan = storyboardScreen(snapshot(storyboard()), null, idle(), null)
  expect(plan).toContain('>Approve the plan</button>')
})
