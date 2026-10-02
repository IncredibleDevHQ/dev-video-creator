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
