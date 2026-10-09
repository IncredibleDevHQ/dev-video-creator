import { expect, it } from 'vitest'
import type { Snapshot } from '../shared/api'
import { stageStatus } from '../app/stage-status'
import { wireframeProgress } from '../app/wireframe-progress'
import { agentActivity } from '../app/workspace-header'
import { presentationScreen, wireframeTiles } from '../app/presentation-screen'

const snapshot = (): Snapshot => ({
  status: 'building',
  error: null,
  events: [],
  plannedSlides: 11,
  plan: Array.from({ length: 11 }, (_, i) => ({
    id: String(i),
    title: `Scene ${i + 1}`,
    narration: `Script ${i + 1}`
  })),
  project: {
    id: 'fixture',
    title: 'Example',
    source: '',
    video: null,
    harness: { adapter: 'kimi' },
    slides: Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      title: 'Page',
      svg: '<svg/>',
      draft: true
    }))
  }
})
it('counts the run once, in the agent pill, with the full planned count', () => {
  const input = snapshot()
  // Drafts are shown as they arrive; only pages the checks kept are done.
  expect(agentActivity(input)).toBe('drawing 1 of 11')
  input.kept = [0, 1, 2, 3, 4]
  expect(agentActivity(input)).toBe('drawing 6 of 11')
  input.drawing = [5, 6]
  expect(agentActivity(input)).toBe('drawing 6 and 7 of 11 · 5 done')
  delete input.drawing
  // The tab says one word; it does not count again.
  expect(stageStatus(input, 'presentation')).toContain('drawing')
  expect(stageStatus(input, 'presentation')).not.toContain('/11')
  const screen = presentationScreen(input, 0)
  expect(screen).not.toMatch(/saved|Generation in progress|Building your/)
})
it('shows every planned scene in the rail, marking the ones being drawn', () => {
  const input = snapshot()
  const tiles = wireframeTiles(input)
  expect(tiles).toHaveLength(11)
  expect(tiles.filter((tile) => tile.kind === 'plan')).toHaveLength(6)
  const screen = presentationScreen(input, 0, false, true, { plan: '7' })
  expect(screen).toContain('Scene 8')
  expect(screen.match(/Drawing…/g)).toHaveLength(2)
  expect(screen).toContain('Waiting to be drawn.')
  expect(screen).toContain('Script 8')
})
it('keeps checking counts until the engine accepts the deck', () => {
  const input = snapshot()
  input.plannedSlides = 5
  input.plan = input.plan!.slice(0, 5)
  // Five drafts are not five done pages: it is still drawing.
  expect(wireframeProgress(input).label).toBe('Generating wireframes')
  expect(stageStatus(input, 'presentation')).toContain('drawing')
  input.kept = [0, 1, 2, 3, 4]
  expect(wireframeProgress(input).label).toBe('Checking wireframes')
  expect(stageStatus(input, 'presentation')).toContain('checking')
  expect(agentActivity(input)).toBe('checking the wireframes')
})
it('says a stop once, in the warning tone, with what Try again does', () => {
  const input = {
    ...snapshot(),
    status: 'failed' as const,
    error:
      'Kimi ran out of time on wireframe 6 of 11, after three tries. 5 of 11 are drawn; Try again continues from wireframe 6.'
  }
  const screen = presentationScreen(input, 0)
  expect(screen).toContain('run-notice is-stopped')
  expect(screen.match(/ran out of time/g)).toHaveLength(1)
  expect(screen).toContain('data-action="retry-slides"')
  expect(stageStatus(input, 'presentation')).toContain('stopped')
  expect(agentActivity(input)).toBe('')
  expect(screen).toContain(
    'Not drawn yet. Try again continues from here.'.slice(0, 0)
  )
})
it('shows a queued or running change on its wireframe, and lets a drawn wireframe take changes while the rest are drawn', () => {
  const input = snapshot()
  input.changes = [
    {
      id: 'c',
      slideId: '0',
      instruction: 'Move the label',
      state: 'queued',
      at: '2026-10-05T01:00:00Z'
    }
  ]
  const queued = presentationScreen(input, 0)
  expect(queued).toContain('Waiting: “Move the label”')
  expect(queued).toContain('once all 11 wireframes are done (0 so far)')
  expect(queued).not.toMatch(/id="instruction"[^>]*disabled/)
  input.status = 'ready'
  input.changes[0].state = 'working'
  expect(presentationScreen(input, 0)).toContain('is changing this wireframe')
  expect(agentActivity(input)).toBe('changing wireframe 1')
})

it('marks each page: being drawn now, a draft waiting, or done', () => {
  const input = snapshot()
  input.kept = [0, 1]
  input.drawing = [2]
  const screen = (selected: number) => presentationScreen(input, selected)
  const badges = screen(0).match(/tile-badge is-(drawing|draft)/g)
  expect(badges).toEqual([
    'tile-badge is-drawing',
    'tile-badge is-draft',
    'tile-badge is-draft'
  ])
  expect(screen(0)).toContain('Wireframe 1 of 11<')
  expect(screen(2)).toContain('Wireframe 3 of 11 · being drawn now')
  expect(screen(3)).toContain(
    'Wireframe 4 of 11 · draft, drawn again before it is done'
  )
  input.status = 'ready'
  expect(presentationScreen(input, 3)).not.toContain('tile-badge is-draft')
})

it('opens the video while the deck is drawn, once every page has a draft', async () => {
  const { workspaceHeader } = await import('../app/workspace-header')
  const { sceneChoice } = await import('../app/scene-link')
  const { donePages, sceneView } = await import('../shared/state')
  const input = snapshot()
  const tab = (html: string) =>
    /<button data-stage="video"([^>]*)>/.exec(html)![1]
  // Five drafts of eleven: not every page has one yet.
  expect(tab(workspaceHeader(input, 'presentation', true))).toContain(
    'title="The video opens once every wireframe has a first draft"'
  )
  input.plannedSlides = 5
  input.plan = input.plan!.slice(0, 5)
  input.kept = [0, 1]
  const header = workspaceHeader(input, 'presentation', true)
  expect(tab(header)).not.toContain('disabled')
  expect(header).toMatch(/data-action="make-video"(?![^>]*disabled)/)
  // The dialog says which scenes start once their page is drawn.
  const choice = sceneChoice(
    input.project.slides,
    null,
    false,
    donePages(input)
  )
  expect(choice.match(/starts once drawn/g)).toHaveLength(3)
  const waiting = sceneView(
    {
      id: 's',
      slideId: '3',
      phase: 'idle',
      presence: null,
      afterDrawing: true,
      moments: [],
      inputKey: '',
      produced: null,
      error: null
    },
    { kind: 'record' }
  )
  expect(waiting.state).toBe('Starts once its wireframe is done')
  expect(waiting.display).toMatchObject({
    label: 'Waiting for its wireframe',
    railLabel: 'Waiting for its wireframe',
    actionLabel: 'Starts once drawn',
    inVideo: true
  })
})
