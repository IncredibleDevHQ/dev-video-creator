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
it('lets returning users choose a project without overwriting their pasted note', () => {
  const doc = parseHTML(
    `<div id="root">${researchHome('My idea')}</div>`
  ).document
  const root = doc.getElementById('root')! as unknown as HTMLElement
  const textarea = root.querySelector('textarea')
  populateResearchHome(root, [
    {
      id: 'existing',
      title: 'A & B',
      notebooks: 2,
      questions: 0,
      updatedAt: ''
    }
  ])
  expect(root.querySelector('textarea')).toBe(textarea)
  expect(textarea?.textContent).toContain('My idea')
  expect(
    root.querySelector('[name="projectId"] option')?.getAttribute('value')
  ).toBe('existing')
  expect(
    root.querySelector('[name="projectId"] option[value=""]')?.textContent
  ).toContain('New project')
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
it('creates a project from the first note when no project is selected', async () => {
  const create = vi
    .spyOn(researchApi, 'create')
    .mockResolvedValue({ id: 'fresh' } as ResearchProjectView)
  const values = new FormData()
  values.set('text', 'First thought')
  await saveHomeNote(values)
  expect(create).toHaveBeenCalledWith({ text: 'First thought' })
})
