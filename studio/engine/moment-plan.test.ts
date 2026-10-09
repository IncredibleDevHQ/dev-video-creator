import { describe, it, expect } from 'vitest'
import { normalizeMoments } from './moment-plan'
const entry = (camera = 'none', extra = {}) => ({
  title: 'Moment',
  lines: 'A request spends one token.',
  seconds: 4,
  camera,
  layout: 'corner',
  overlay: null,
  cue: 'Explain the request',
  ...extra
})
describe('camera staging is checked before a scene lands', () => {
  it('rejects camera in an Off scene', () =>
    expect(() =>
      normalizeMoments({ moments: [entry('full')] }, 'scene', 'off', 'body')
    ).toThrow(/Off/))
  it('Low records only the closing moment', () => {
    expect(
      normalizeMoments(
        { moments: [entry(), entry('full')] },
        'scene',
        'low',
        'body'
      ).map((moment) => moment.camera)
    ).toEqual(['none', 'full'])
    expect(() =>
      normalizeMoments(
        { moments: [entry('full'), entry('full')] },
        'scene',
        'low',
        'body'
      )
    ).toThrow(/earlier/)
  })
  it('High opens and closes with the presenter', () =>
    expect(() =>
      normalizeMoments(
        { moments: [entry(), entry('full')] },
        'scene',
        'high',
        'body'
      )
    ).toThrow(/opens/))
  it('the title scene starts full screen with a title card at High', () => {
    expect(() =>
      normalizeMoments({ moments: [entry('full')] }, 'scene', 'high', 'title')
    ).toThrow(/title card/)
    expect(
      normalizeMoments(
        {
          moments: [
            entry('full', { layout: 'full-screen', overlay: 'title-card' })
          ]
        },
        'scene',
        'high',
        'title'
      )
    ).toHaveLength(1)
  })
  it('an ending closes full screen', () =>
    expect(() =>
      normalizeMoments({ moments: [entry('full')] }, 'scene', 'high', 'ending')
    ).toThrow(/end card/))
  it('refuses empty speech and invalid timing', () => {
    expect(() =>
      normalizeMoments(
        { moments: [entry('none', { seconds: -4 })] },
        'scene',
        'off',
        'body'
      )
    ).toThrow(/length/)
    expect(() =>
      normalizeMoments(
        { moments: [entry('none', { lines: '' })] },
        'scene',
        'off',
        'body'
      )
    ).toThrow(/words/)
  })
})
it('a replan keeps a matching take after a new earlier moment, and invalidates changed words', () => {
  const old = normalizeMoments(
    { moments: [entry('full', { seconds: 3.1 })] },
    'scene',
    'high',
    'body'
  )
  old[0].take = {
    id: 't1',
    recordingKey: old[0].recordingKey,
    objectKey: 'take.webm'
  }
  const changed = normalizeMoments(
    {
      moments: [
        entry('full', { seconds: 7.2, lines: 'Here is the bucket.' }),
        entry('full', { seconds: 3.1 })
      ]
    },
    'scene',
    'high',
    'body',
    old
  )
  expect(changed[1].take?.id).toBe('t1')
  expect(
    normalizeMoments(
      {
        moments: [
          entry('full', { seconds: 3.1, lines: 'Now two tokens are spent.' })
        ]
      },
      'scene',
      'high',
      'body',
      old
    )[0].take
  ).toBeNull()
})

it('keeps semantic identities and take links when earlier moments are inserted', () => {
  const old = normalizeMoments(
    { moments: [entry('none', { id: 'spend-token' })] },
    'scene',
    'off',
    'body'
  )
  old[0].take = {
    id: 'take',
    recordingKey: old[0].recordingKey,
    objectKey: 'fixture.webm'
  }
  const next = normalizeMoments(
    {
      moments: [
        entry('none', { id: 'introduce-bucket', lines: 'Here is the bucket.' }),
        entry('none', { id: 'spend-token' })
      ]
    },
    'scene',
    'off',
    'body',
    old
  )
  expect(next.map((moment) => moment.id)).toEqual([
    'introduce-bucket',
    'spend-token'
  ])
  expect(next[1].take?.id).toBe('take')
  expect(next[1].segments?.[0].id).toBe('spend-token-segment-1')
})
it('preserves prior identity for legacy candidates without IDs and refuses duplicate IDs', () => {
  const old = normalizeMoments({ moments: [entry()] }, 'scene', 'off', 'body')
  const next = normalizeMoments(
    { moments: [entry('none', { lines: 'Here is the bucket.' }), entry()] },
    'scene',
    'off',
    'body',
    old
  )
  expect(next[1].id).toBe(old[0].id)
  expect(() =>
    normalizeMoments(
      {
        moments: [entry('none', { id: 'same' }), entry('none', { id: 'same' })]
      },
      'scene',
      'off',
      'body'
    )
  ).toThrow('unique')
  expect(() =>
    normalizeMoments(
      { moments: [entry('none', { id: '../escape' })] },
      'scene',
      'off',
      'body'
    )
  ).toThrow('identity')
})

it('keeps repeated lines tied to their own moment takes across reordering and duplication', () => {
  const old = normalizeMoments(
    {
      moments: [
        entry('full', { id: 'opening' }),
        entry('full', { id: 'closing' })
      ]
    },
    'scene',
    'high',
    'body'
  )
  for (const moment of old)
    moment.take = {
      id: `take-${moment.id}`,
      recordingKey: moment.recordingKey,
      objectKey: `${moment.id}.webm`
    }
  const next = normalizeMoments(
    {
      moments: [
        entry('full', { id: 'closing' }),
        entry('full', { id: 'duplicate' }),
        entry('full', { id: 'opening', layout: 'beside-slide' })
      ]
    },
    'scene',
    'high',
    'body',
    old
  )
  expect(next.map((moment) => moment.take?.id || null)).toEqual([
    'take-closing',
    null,
    'take-opening'
  ])
})
