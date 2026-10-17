import { expect, it } from 'vitest'
import type { Snapshot } from '../shared/api'
import { notebookNextStep, notebookHint } from '../app/notebook-next-step'
const snapshot = (status: Snapshot['status'], extra: Partial<Snapshot> = {}) =>
  ({
    status,
    project: { slides: [], title: 'Fixture', source: 'Notes' },
    error: null,
    events: [],
    ...extra
  }) as unknown as Snapshot
it('gives a failed presentation an enabled retry instead of disabled view slides', () => {
  const next = notebookNextStep(snapshot('failed'))
  expect(next.action).toBe('retry-slides')
  expect(next.disabled).toBe(false)
  expect(
    notebookHint(snapshot('failed', { error: '<bad> failed' }), false)
  ).toContain('&lt;bad&gt; failed')
})
it('says the next step in one line, with the choices Create will use and no second Create button', () => {
  const hint = notebookHint(snapshot('draft'), true)
  expect(hint).toContain('Create wireframes, top right')
  expect(hint).toContain('about 5 min')
  expect(hint).toContain('Paper look')
  expect(hint).not.toContain('data-action="create-presentation"')
})
it('offers a concrete next step before, during and after generation', () => {
  expect(notebookNextStep(snapshot('draft')).action).toBe('create-presentation')
  expect(notebookNextStep(snapshot('building')).label).toBe('View progress →')
  expect(notebookNextStep(snapshot('ready')).label).toBe('Review wireframes →')
  expect(
    notebookNextStep(
      snapshot('failed', { sourceOnly: true, sourceFailure: 'blocked' })
    ).action
  ).toBe('paste-source')
  expect(notebookNextStep(snapshot('draft', { readOnly: true })).disabled).toBe(
    true
  )
})
