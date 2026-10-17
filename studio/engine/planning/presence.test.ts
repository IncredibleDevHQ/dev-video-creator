import { describe, expect, it } from 'vitest'
import {
  presenceProblems,
  presenterMomentsOf,
  resolvePresence,
  showsTitle,
  titleMomentOf
} from './presence'

const moment = (
  id: string,
  visibility: 'full' | 'shared' | 'hidden' | 'undecided' | null,
  text: string | null = null
) => ({
  id,
  presenter: visibility ? { visibility, reason: '' } : null,
  text: text ? { content: text } : null
})

// R07 and U04 of the projects-first rereview: on camera is decided apart
// from who speaks — a video default, each scene's own over it — and the
// plan puts the presenter where the choice says.
describe('on-camera presence', () => {
  it('is the scene’s own choice, else the video’s default, else not decided', () => {
    expect(resolvePresence('low', 'high')).toEqual({
      value: 'low',
      from: 'scene'
    })
    expect(resolvePresence(null, 'high')).toEqual({
      value: 'high',
      from: 'video'
    })
    expect(resolvePresence(undefined, null)).toEqual({
      value: null,
      from: null
    })
    expect(resolvePresence('sometimes', 'off')).toEqual({
      value: 'off',
      from: 'video'
    })
  })

  it('Off shows no one on camera', () => {
    const plan = [
      moment('m1', 'hidden'),
      moment('m2', 'shared'),
      moment('m3', null)
    ]
    expect(presenceProblems(plan, 'off')).toEqual([
      expect.stringMatching(/^on-camera presence is Off .* m2 does/)
    ])
    expect(
      presenceProblems([moment('m1', 'hidden'), moment('m2', null)], 'off')
    ).toEqual([])
  })

  it('Low shows the presenter only at the scene’s end', () => {
    expect(
      presenceProblems(
        [moment('m1', 'hidden'), moment('m2', 'hidden'), moment('m3', 'full')],
        'low'
      )
    ).toEqual([])
    const early = presenceProblems(
      [moment('m1', 'shared'), moment('m2', 'hidden'), moment('m3', 'hidden')],
      'low'
    )
    expect(early).toHaveLength(2)
    expect(early[0]).toMatch(
      /only in its closing moment \(m3\).* m1 shows them earlier/
    )
    expect(early[1]).toMatch(/its closing moment \(m3\) shows the presenter/)
  })

  it('High opens and closes the scene with the presenter, and may hand over between', () => {
    expect(
      presenceProblems(
        [
          moment('m1', 'full'),
          moment('m2', 'hidden'),
          moment('m3', 'shared'),
          moment('m4', 'shared')
        ],
        'high'
      )
    ).toEqual([])
    const missing = presenceProblems(
      [moment('m1', 'hidden'), moment('m2', 'shared'), moment('m3', 'hidden')],
      'high'
    )
    expect(missing).toEqual([
      expect.stringMatching(/opens it — its first moment \(m1\)/),
      expect.stringMatching(/closes it — its last moment \(m3\)/)
    ])
  })

  it('leaves no moment undecided once presence is chosen', () => {
    expect(
      presenceProblems(
        [moment('m1', 'full'), moment('m2', 'undecided'), moment('m3', 'full')],
        'high'
      )[0]
    ).toMatch(/m2 is "undecided"/)
  })

  it('says which moments the presenter is in, for the stand-in to fill', () => {
    expect(
      presenterMomentsOf([
        moment('m1', 'full'),
        moment('m2', 'hidden'),
        moment('m3', 'shared'),
        moment('m4', 'undecided')
      ])
    ).toEqual(['m1', 'm3'])
  })
})

// U02 of the projects-first rereview: the opening scene shows the video's
// actual title, read in its first moments.
describe('the opening scene’s title', () => {
  const title = 'Scaling your API: rate limiters'
  it('is found in the first or second moment, whatever its case and punctuation', () => {
    const plan = [
      moment('m1', 'full', 'Why do APIs fall over?'),
      moment('m2', 'shared', 'SCALING YOUR API — RATE LIMITERS'),
      moment('m3', null)
    ]
    expect(titleMomentOf(plan, title)).toBe(1)
    expect(showsTitle(plan, title)).toBe(true)
  })
  it('is missing when it comes later, or not at all', () => {
    expect(
      showsTitle(
        [
          moment('m1', null, 'Hook'),
          moment('m2', null, 'Stakes'),
          moment('m3', null, title)
        ],
        title
      )
    ).toBe(false)
    expect(showsTitle([moment('m1', null, 'Rate limiters')], title)).toBe(false)
  })
})
