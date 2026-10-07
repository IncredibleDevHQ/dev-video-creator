import { expect, it } from 'vitest'
import type { Snapshot } from '../shared/api'
import { RESTARTED, settleNotebook, settleSeries } from './studio-recovery'

it('marks work a restart cut off as stopped, and leaves the rest', () => {
  const snapshot = {
    project: {
      id: 'n',
      title: '',
      source: '',
      video: null,
      slides: [
        {
          id: 'a',
          title: '',
          svg: '',
          capture: { url: 'u', steps: [], state: 'capturing', at: '' }
        },
        {
          id: 'b',
          title: '',
          svg: '',
          capture: { url: 'u', steps: [], state: 'ready', at: '' }
        }
      ],
      release: {
        teasers: [
          {
            id: 't',
            channel: 'x',
            aspect: '1:1',
            segments: [],
            state: 'cutting',
            at: ''
          },
          {
            id: 'u',
            channel: 'x',
            aspect: '1:1',
            segments: [],
            state: 'ready',
            at: ''
          }
        ],
        campaign: [
          {
            id: 'c',
            channel: 'x',
            asset: 'episode',
            kind: 'launch',
            words: 'w',
            offsetDays: 0,
            time: '09:00',
            state: 'posting'
          }
        ],
        drafting: { state: 'drafting', at: '' },
        youtube: { state: 'uploading', at: '' }
      }
    },
    repoAsks: {
      k: { slideId: 'a', what: 'w', state: 'asking', at: '' },
      j: { slideId: 'a', what: 'v', state: 'failed', error: 'old', at: '' }
    },
    status: 'ready',
    error: null,
    events: []
  } as unknown as Snapshot
  expect(settleNotebook(snapshot, 'now')).toBe(true)
  expect(snapshot.repoAsks!.k).toMatchObject({
    state: 'failed',
    error: RESTARTED
  })
  expect(snapshot.repoAsks!.j.error).toBe('old')
  expect(snapshot.project.slides.map((slide) => slide.capture!.state)).toEqual([
    'failed',
    'ready'
  ])
  const release = snapshot.project.release!
  expect(release.teasers.map((item) => item.state)).toEqual(['failed', 'ready'])
  expect(release.drafting).toMatchObject({ state: 'failed', error: RESTARTED })
  // It may have gone out: back to approved, with a word to check first.
  expect(release.campaign[0]).toMatchObject({ state: 'approved' })
  expect(release.campaign[0].note).toContain('Check the channel')
  expect(release.youtube!.error).toContain('Check YouTube Studio first')
  // Nothing left to settle the second time.
  expect(settleNotebook(snapshot)).toBe(false)
  const series = {
    planning: { state: 'planning', at: '' }
  } as unknown as import('../shared/series').Series
  expect(settleSeries(series, 'now')).toBe(true)
  expect(series.planning).toEqual({
    state: 'failed',
    error: RESTARTED,
    at: 'now'
  })
})
