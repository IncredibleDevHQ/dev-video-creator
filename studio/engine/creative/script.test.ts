import { expect, it } from 'vitest'
import { validateCreativeScript } from './script'
import type { SceneTreatmentV1 } from './scene-treatment'
const context = {
  plan: {
    scene: 'scene',
    moments: [{ id: 'explain', presenter: { visibility: 'hidden' } }]
  } as unknown as SceneTreatmentV1,
  presence: 'off' as const,
  role: 'body'
}
const moment = {
  id: 'explain',
  title: 'Explain',
  lines: 'Requests spend tokens.',
  seconds: 4,
  segments: [{ lines: 'Requests spend tokens.', camera: false, seconds: 4 }],
  camera: 'none',
  layout: 'corner',
  overlay: null,
  cue: 'Explain the request'
}
it('accepts exact semantic IDs and retains the spoken segment clock', () => {
  const report = validateCreativeScript({ moments: [moment] }, context)
  expect(report.ok).toBe(true)
  expect(report.value[0].id).toBe('explain')
  expect(report.value[0].end).toBe(4)
})
it('refuses script identity drift and invented extra moments', () => {
  expect(
    validateCreativeScript({ moments: [{ ...moment, id: 'other' }] }, context)
      .ok
  ).toBe(false)
  expect(
    validateCreativeScript({ moments: [moment, moment] }, context).ok
  ).toBe(false)
})
it('refuses a script that changes the treatment presenter layout', () => {
  const full = {
    ...context,
    presence: 'high' as const,
    plan: {
      ...context.plan,
      moments: [{ id: 'explain', presenter: { visibility: 'full' } }]
    } as unknown as SceneTreatmentV1
  }
  expect(
    validateCreativeScript(
      {
        moments: [
          {
            ...moment,
            camera: 'full',
            segments: [{ lines: moment.lines, camera: true, seconds: 4 }]
          }
        ]
      },
      full
    ).problems
  ).toContain('Moment explain requires the planned full-screen presenter')
})

it('closes the video on its ending, and says only the source’s figures', () => {
  const said = (lines: string, extra: object = {}) =>
    validateCreativeScript(
      {
        moments: [
          {
            ...moment,
            lines,
            segments: [{ lines, camera: false, seconds: 4 }]
          }
        ]
      },
      { ...context, ...extra }
    ).problems
  // Seen live: the last scene in the cut pointed at a part left out.
  expect(
    said('The false alarms stopped. What we learned comes next.', {
      role: 'ending'
    })
  ).toEqual([
    'Moment explain closes the video: land what the viewer now understands, and do not point at a part to come'
  ])
  expect(said('What we learned comes next.')).toEqual([])
  // Seen live: figures no source gave, said as measurements.
  expect(
    said('This frame reads four percent of the title.', {
      sourceText: 'We flag when 12% of the text is covered.'
    })
  ).toEqual([
    'Moment explain says four percent, which the source does not give: say only figures the source states, or say an example as one ("Say a moment runs six seconds…")'
  ])
  expect(
    said('We flag when twelve percent of the text is covered.', {
      sourceText: 'We flag when 12% of the text is covered.'
    })
  ).toEqual([])
})
