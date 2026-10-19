import { afterEach, expect, it, vi } from 'vitest'
import { parseHTML } from 'linkedom'
import {
  populateResearchHome,
  researchHome,
  saveHomeNote
} from '../app/research-home'
import { researchApi } from '../app/research-api'
import type { ResearchProjectView } from '../shared/research'

afterEach(() => vi.restoreAllMocks())
it('offers a channel name and one conversation action while preserving the draft', () => {
  const doc = parseHTML(`<div>${researchHome('My idea')}</div>`).document
  expect(doc.querySelector('textarea')?.textContent).toContain('My idea')
  expect(doc.querySelector('[name="channelTitle"]')).not.toBeNull()
  expect(doc.querySelector('button[type="submit"]')?.textContent).toContain(
    'Start channel'
  )
  expect(doc.querySelector('[name="intent"]')?.getAttribute('value')).toBe(
    'ask'
  )
})
it('appends a captured note to the chosen existing project instead of creating another project', async () => {
  const project = {
    id: 'existing',
    title: 'Existing',
    createdAt: '',
    updatedAt: '',
    nodes: [],
    repos: [],
    snapshots: [],
    canvas: null,
    notebooks: [{ id: 'first', title: 'Notes', blocks: [] }]
  } as ResearchProjectView
  vi.spyOn(researchApi, 'load').mockResolvedValue(project)
  const create = vi.spyOn(researchApi, 'create')
  const change = vi.spyOn(researchApi, 'change').mockResolvedValue(project)
  const values = new FormData()
  values.set('projectId', 'existing')
  values.set('text', 'A useful discovery')
  await expect(saveHomeNote(values)).resolves.toBe(project)
  expect(change).toHaveBeenCalledWith('existing', 'notes', {
    notebookId: 'first',
    text: 'A useful discovery'
  })
  expect(create).not.toHaveBeenCalled()
})
it('requires an explicit destination for the legacy save-note entry point', async () => {
  const values = new FormData()
  values.set('text', 'First thought')
  await expect(saveHomeNote(values)).rejects.toThrow('before saving notes')
})

it('saves to the selected notebook and refuses a stale destination', async () => {
  const project = {
    notebooks: [{ id: 'first' }, { id: 'chosen' }]
  } as ResearchProjectView
  vi.spyOn(researchApi, 'load').mockResolvedValue(project)
  const change = vi.spyOn(researchApi, 'change').mockResolvedValue(project)
  const values = new FormData()
  values.set('projectId', 'existing')
  values.set('notebookId', 'chosen')
  values.set('text', 'Selected notebook note')
  await saveHomeNote(values)
  expect(change).toHaveBeenCalledWith('existing', 'notes', {
    notebookId: 'chosen',
    text: 'Selected notebook note'
  })
  values.set('notebookId', 'missing')
  await expect(saveHomeNote(values)).rejects.toThrow('Choose a notebook')
  expect(change).toHaveBeenCalledTimes(1)
})
