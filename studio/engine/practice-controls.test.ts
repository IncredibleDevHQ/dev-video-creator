import { expect, it } from 'vitest'
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
    'Enter to advance'
  )
})

it('finishes rehearsal independently of exiting the focused studio', () => {
  expect(practiceControls('running')).toContain('data-action="practice-finish"')
  expect(practiceControls('countdown')).toContain(
    'data-action="practice-finish"'
  )
  expect(practiceControls('running')).not.toContain('data-action="practice"')
})
