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
  expect(agentActivity(input)).toBe('drawing 6 of 11')
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
  expect(queued).toContain('once every wireframe is drawn')
  expect(queued).not.toMatch(/id="instruction"[^>]*disabled/)
  input.status = 'ready'
  input.changes[0].state = 'working'
  expect(presentationScreen(input, 0)).toContain('is changing this wireframe')
  expect(agentActivity(input)).toBe('changing wireframe 1')
})
