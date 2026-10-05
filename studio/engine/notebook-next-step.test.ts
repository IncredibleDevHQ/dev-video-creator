import { expect, it } from 'vitest'
import type { Snapshot } from '../shared/api'
import { notebookNextStep, notebookNextBanner } from '../app/notebook-next-step'
const snapshot = (status: Snapshot['status'], extra: Partial<Snapshot> = {}) =>
  ({ status, project: { slides: [] }, error: null, ...extra }) as Snapshot
it('gives a failed presentation an enabled retry instead of disabled view slides', () => {
  const next = notebookNextStep(snapshot('failed'))
  expect(next.action).toBe('retry-slides')
  expect(next.disabled).toBe(false)
  expect(
    notebookNextBanner(snapshot('failed', { error: '<bad> failed' }), false)
  ).toContain('&lt;bad&gt; failed')
})
it('offers a concrete next step before, during and after generation', () => {
  expect(notebookNextStep(snapshot('draft')).action).toBe('create-presentation')
  expect(notebookNextStep(snapshot('building')).label).toBe('View progress →')
  expect(notebookNextStep(snapshot('ready')).label).toBe(
    'Review wireframes →'
  )
  expect(
    notebookNextStep(
      snapshot('failed', { sourceOnly: true, sourceFailure: 'blocked' })
    ).action
  ).toBe('paste-source')
  expect(notebookNextStep(snapshot('draft', { readOnly: true })).disabled).toBe(
    true
  )
})
