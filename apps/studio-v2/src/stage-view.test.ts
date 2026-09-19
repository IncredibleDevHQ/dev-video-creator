import { describe, expect, it } from 'vitest'
import { stageRowsFor } from './stage-view'

describe('stageRowsFor', () => {
  it('labels the known states in plain language', () => {
    const rows = stageRowsFor([
      { stage: 'preview', status: 'succeeded' },
      { stage: 'narrate', status: 'running' },
      { stage: 'finish', status: 'pending' },
    ])
    expect(rows.map(row => row.text)).toEqual(['preview · done', 'narrate · running…', 'finish · pending'])
    expect(rows.map(row => row.tone)).toEqual(['quiet', 'active', 'quiet'])
  })

  it('renders needs-input as waiting for a person, never as a failure', () => {
    const rows = stageRowsFor([
      {
        stage: 'align-take',
        status: 'needs-input',
        detail: { scene: 's2', review: [{ beat: 3, note: 'The take skips the second sentence.' }] },
      },
    ])
    expect(rows[0]).toEqual({ text: 'align-take · waiting for you', tone: 'waiting', indent: false })
    expect(rows[1]).toEqual({ text: 'beat 3: The take skips the second sentence.', tone: 'waiting', indent: true })
  })

  it('marks failed and cancelled as failures, and passes unknown states through', () => {
    const rows = stageRowsFor([
      { stage: 'export', status: 'failed' },
      { stage: 'review', status: 'cancelled' },
      { stage: 'custom', status: 'mystery' },
    ])
    expect(rows.map(row => row.tone)).toEqual(['failed', 'failed', 'quiet'])
    expect(rows[2].text).toBe('custom · mystery')
  })

  it('leaves a needs-input stage without review notes as a single row', () => {
    expect(stageRowsFor([{ stage: 'align-take', status: 'needs-input' }])).toHaveLength(1)
  })
})
