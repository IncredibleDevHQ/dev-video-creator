import { expect, it } from 'vitest'
import type { Snapshot } from '../shared/api'
import { stageStatus } from '../app/stage-status'
import {
  wireframeProgress,
  wireframeRunBar,
  wireframeCanvasStatus
} from '../app/wireframe-progress'

const snapshot = (): Snapshot => ({
  status: 'building',
  error: null,
  events: [],
  plannedSlides: 11,
  project: {
    id: 'fixture',
    title: 'Example',
    source: '',
    video: null,
    slides: Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      title: 'Page',
      svg: '<svg/>',
      draft: true
    }))
  }
})
it('uses the full planned count when a retry restores only some drafts', () => {
  const input = snapshot()
  expect(stageStatus(input, 'presentation')).toContain('5/11')
  expect(stageStatus(input, 'presentation')).not.toContain('5/5')
  expect(wireframeRunBar(input)).toContain('5 of 11 saved')
  expect(wireframeRunBar(input)).toContain('max="11" value="5"')
  expect(wireframeCanvasStatus(input, 0, false, true)).toContain('Draft saved')
})
it('keeps full draft counts in validation until the engine accepts the deck', () => {
  const input = snapshot()
  input.plannedSlides = 5
  expect(wireframeProgress(input).label).toBe('Checking wireframes')
  expect(stageStatus(input, 'presentation')).toContain('checking')
  expect(wireframeRunBar(input)).not.toContain('Wireframes ready')
  input.status = 'ready'
  expect(wireframeRunBar(input)).toContain('Wireframes ready')
  expect(wireframeRunBar(input)).not.toContain('activity-orbit')
})
it('stops activity indicators on failure, stopping, read-only and disconnection', () => {
  for (const patch of [
    { status: 'failed' as const },
    { stopping: true },
    { readOnly: true }
  ]) {
    const input = { ...snapshot(), ...patch }
    expect(wireframeProgress(input).active).toBe(false)
    expect(wireframeRunBar(input)).not.toContain('activity-orbit')
  }
  expect(wireframeRunBar(snapshot(), false)).toContain('Reconnecting')
  expect(wireframeRunBar(snapshot(), false)).not.toContain('activity-orbit')
  expect(wireframeCanvasStatus(snapshot(), 0, false, false)).not.toContain(
    'activity-orbit'
  )
})
it('does not invent counts during planning and distinguishes single-page edits', () => {
  const input = snapshot()
  input.project.slides = []
  delete input.plannedSlides
  input.progress = {
    label: 'Understanding the source',
    startedAt: '2026-10-05T01:00:00Z'
  }
  expect(wireframeRunBar(input)).toContain('Understanding the source')
  expect(wireframeRunBar(input)).not.toContain('<progress')
  const ready = { ...snapshot(), status: 'ready' as const }
  expect(wireframeCanvasStatus(ready, 0, true, true)).toContain(
    'Updating this wireframe'
  )
})
