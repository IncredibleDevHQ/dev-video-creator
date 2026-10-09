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

it('puts Record beside Start practice, only when something can be recorded', async () => {
  vi.mock('../app/api', () => ({ api: {} }))
  const { parseHTML } = await import('linkedom')
  const { paintPracticeActions } = await import('../app/recording-controller')
  const { document } = parseHTML(
    '<main><div class="video-actions"><div></div><div></div></div></main>'
  )
  const scene = {
    id: 's',
    phase: 'waiting',
    moments: [{ id: 'm1', lines: 'Hello.', camera: 'none', take: null }]
  }
  const app = {
    root: document.querySelector('main'),
    practiceOpen: true,
    startRehearsal: () => Promise.resolve(),
    practiceCountdown: 0,
    practice: { active: false },
    practiceMomentIds: ['m1'],
    selected: 0,
    momentIndex: 0,
    snapshot: {
      project: {
        video: { settings: { voice: { kind: 'record' } }, scenes: [scene] }
      },
      views: { scenes: { s: { openMomentIds: ['m1'] } } }
    }
  } as never
  const row = () => document.querySelector('.video-actions>div:last-child')!
  paintPracticeActions(app)
  expect(row().innerHTML).toMatch(
    /Start practice[\s\S]*data-action="record-moment"/
  )
  expect(row().innerHTML.match(/class="primary"/g)).toHaveLength(1)
  expect(row().innerHTML).toContain('aria-label="Record this moment"')
  // A scene that can't take a take: no Record.
  scene.phase = 'failed'
  paintPracticeActions(app)
  expect(row().innerHTML).not.toContain('record-moment')
  scene.phase = 'waiting'
  // Recorded already, in the creator's own voice: Record takes the moment
  // on show again, and says so.
  const state = app as {
    snapshot: {
      project: { video: { settings: { voice: { kind: string } } } }
      views: { scenes: { s: { openMomentIds: string[] } } }
    }
  }
  state.snapshot.views.scenes.s.openMomentIds = []
  paintPracticeActions(app)
  expect(row().innerHTML).toContain('aria-label="Record this moment"')
  // An AI voice and no camera: nothing to record, no Record.
  state.snapshot.project.video.settings.voice = { kind: 'ai' }
  paintPracticeActions(app)
  expect(row().innerHTML).not.toContain('record-moment')
})
