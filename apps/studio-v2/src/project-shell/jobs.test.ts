import { describe, expect, it } from 'vitest'
import { jobsSummaryOf, type JobView } from './jobs'

const job = (tone: JobView['tone'], id = tone): JobView => ({ id, title: 'Scene 1 · Dispatch', stage: 'Planning r2', tone })

describe('the Jobs control', () => {
  it('says nothing when nothing runs', () => {
    expect(jobsSummaryOf([], [])).toEqual({ running: 0, attention: 0, text: '' })
  })
  it('counts what runs, and what waits to start, as running', () => {
    expect(jobsSummaryOf([job('running'), job('waiting')], [])).toMatchObject({ running: 2, attention: 0, text: '2 running' })
  })
  it('counts a failure and something to collect as needing you', () => {
    expect(jobsSummaryOf([job('failed'), job('done'), job('running')], [])).toMatchObject({ running: 1, attention: 2, text: '1 running · 2 need you' })
    expect(jobsSummaryOf([job('failed')], []).text).toBe('1 needs you')
  })
  it('counts the notices the panel keeps for itself — the export, the older build', () => {
    expect(jobsSummaryOf([], [{ running: 1, attention: 0 }, { running: 0, attention: 1 }])).toMatchObject({ running: 1, attention: 1, text: '1 running · 1 needs you' })
  })
})
