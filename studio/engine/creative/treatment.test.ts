import { expect, it } from 'vitest'
import { treatmentStagingProblems, pinnedBundle } from './treatment'
import type { SceneTreatmentV1 } from './scene-treatment'
const plan = (visibility: string) =>
  ({ moments: [{ presenter: { visibility } }] }) as unknown as SceneTreatmentV1
it('refuses title and closing staging that would make the spoken-lines gate impossible to satisfy', () => {
  expect(treatmentStagingProblems(plan('shared'), 'high', 'title')).toContain(
    'The title scene at High opens with the presenter full screen'
  )
  expect(treatmentStagingProblems(plan('shared'), 'low', 'ending')).toContain(
    'The ending scene closes with the presenter full screen'
  )
  expect(treatmentStagingProblems(plan('full'), 'high', 'title')).toEqual([])
  expect(treatmentStagingProblems(plan('hidden'), 'off', 'ending')).toEqual([])
  expect(treatmentStagingProblems(plan('shared'), 'high', 'body')).toEqual([])
})

it('accepts manual-relative references only when they resolve to real pinned files', async () => {
  const bundle = await pinnedBundle()
  expect(bundle.skills).toContain('hyperframes-creative')
  expect(bundle.skills).toContain('hyperframes/skills/hyperframes-creative')
  expect(
    bundle.index['skills/hyperframes-creative/references/beat-direction.md']
  ).toBe('hyperframes/skills/hyperframes-creative/references/beat-direction.md')
  expect(bundle.references).toContain(
    'skills/hyperframes-animation/rules-index.md'
  )
  expect(bundle.skills).not.toContain('faceless-explainer')
  expect(bundle.index['skills/faceless-explainer/SKILL.md']).toBeUndefined()
})
