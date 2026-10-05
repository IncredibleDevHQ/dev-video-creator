import { expect, it, vi } from 'vitest'
import type { Moment, Scene } from '../shared/model'
import { practiceControls } from '../app/practice-controls'
it('offers one primary action without a stop button before starting', () => {
  const html = practiceControls('ready')
  expect(html).toContain('Start practice')
  expect(html).not.toContain('Finish practice')
  expect(html).not.toContain('record-moment')
  expect(html.match(/class="primary"/g)).toHaveLength(1)
})
it('shows only relevant controls during countdown and rehearsal', () => {
  expect(practiceControls('countdown')).toContain('Cancel countdown')
  expect(practiceControls('countdown')).not.toContain('Record instead')
  expect(practiceControls('running')).toContain('Finish practice')
  expect(practiceControls('running')).not.toContain('Start practice')
  expect(practiceControls('running', 'Next moment')).toContain(
    'Enter to skip ahead'
  )
})

it('finishes rehearsal independently of exiting the focused studio', () => {
  expect(practiceControls('running')).toContain('data-action="practice-finish"')
  expect(practiceControls('countdown')).toContain(
    'data-action="practice-finish"'
  )
  expect(practiceControls('running')).not.toContain('data-action="practice"')
})

it('practices the whole scene when asked, every moment in turn', async () => {
  vi.mock('../app/api', () => ({ api: {} }))
  const { practiceMoments } = await import('../app/recording-controller')
  const moment = { id: 'm1' } as Moment
  const scene = {
    moments: [moment, { id: 'm2' }, { id: 'm3' }]
  } as Scene
  expect(practiceMoments(scene, 1, 'moment')).toEqual(['m2'])
  expect(practiceMoments(scene, 1, 'scene')).toEqual(['m1', 'm2', 'm3'])
  // A scene of one moment has no whole scene beyond it.
  expect(practiceMoments({ moments: [moment] } as Scene, 0, 'scene')).toEqual([
    'm1'
  ])
  expect(practiceControls('ready', undefined, 3)).toContain(
    'All 3 moments · 3-second countdown'
  )
  expect(practiceControls('ready')).not.toContain('moments')
})
