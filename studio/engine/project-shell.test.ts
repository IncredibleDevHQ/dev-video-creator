import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { parseHTML } from 'linkedom'
import { ProjectShell } from '../app/project-shell'
import {
  projectContext,
  projectLink,
  projectNotesTarget
} from '../app/project-links'
import { researchApi } from '../app/research-api'
import type { ResearchProjectView } from '../shared/research'
import type { AppContext } from '../app/app-context'
vi.mock('../app/research-api', () => ({ researchApi: { load: vi.fn() } }))
vi.mock('../app/notebook-editor', () => ({
  saveBeforeLeaving: vi.fn(async () => true)
}))
const project: ResearchProjectView = {
  id: 'space',
  title: 'Learning',
  createdAt: '',
  updatedAt: '',
  repos: [],
  notebooks: [{ id: 'book', title: 'Evidence', blocks: [] }],
  nodes: [],
  chats: [
    {
      id: 'chat',
      title: 'Research',
      notebookId: 'book',
      lastNodeId: 'question',
      repos: [],
      createdAt: '',
      updatedAt: ''
    }
  ],
  snapshots: [],
  canvas: null,
  canvasId: 'canvas'
}
let shell: ProjectShell
let app: AppContext
let address: URL
beforeEach(() => {
  const { document } = parseHTML(
    '<html><body><div id="app"></div></body></html>'
  )
  vi.stubGlobal('document', document)
  address = new URL(
    'http://localhost/?space=space&chat=chat&node=question&book=book'
  )
  vi.stubGlobal('location', address)
  const visit = (_: unknown, _title: string, url: string | URL) => {
    address = new URL(url, address)
    vi.stubGlobal('location', address)
  }
  vi.stubGlobal('history', {
    pushState: vi.fn(visit),
    replaceState: vi.fn(visit)
  })
  app = {
    capture: { phase: 'idle' },
    error: vi.fn(),
    stopPractice: vi.fn(),
    closeStream: vi.fn(),
    mapCanvas: { isOpen: false, dismiss: vi.fn(), open: vi.fn() },
    templateGallery: { dismiss: vi.fn() },
    settingsScreen: { isOpen: false },
    opening: { reset: vi.fn() },
    researchWorkspace: {
      isOpen: true,
      suspend: vi.fn(),
      open: vi.fn(),
      home: vi.fn(),
      command: vi.fn()
    },
    openNotebook: vi.fn()
  } as unknown as AppContext
  shell = new ProjectShell(app, document.getElementById('app')!)
  app.root = shell.editorRoot
  vi.mocked(researchApi.load).mockReset().mockResolvedValue(project)
})
afterEach(() => vi.unstubAllGlobals())

it('carries research identity through output links without preserving unrelated engine state', () => {
  const link = projectLink(
    'space',
    { notebook: 'book', chat: 'chat', node: 'question' },
    { detail: '1', notebook: 'book', view: 'video' }
  )
  const url = new URL(link, address)
  expect(projectContext(url)).toEqual({
    notebook: 'book',
    chat: 'chat',
    node: 'question'
  })
  expect(url.searchParams.get('notebook')).toBe('book')
  expect(url.searchParams.has('scene')).toBe(false)
  expect(projectLink('space', { notebook: 'with & spaces' })).toContain(
    'with+%26+spaces'
  )
})
it('opens tools in the same project frame and stops previous subscriptions', async () => {
  await shell.go(
    new URL(
      projectLink(
        'space',
        { chat: 'chat', node: 'question', notebook: 'book' },
        { detail: '1', notebook: 'book', view: 'presentation' }
      ),
      address
    )
  )
  expect(app.openNotebook).toHaveBeenCalledWith('book')
  expect(app.closeStream).toBeNull()
  expect(app.researchWorkspace.suspend).toHaveBeenCalled()
  expect(shell.researchRoot.hidden).toBe(true)
  expect(
    document.querySelector('[aria-label="Project workspace"]')
  ).not.toBeNull()
  const back = [...document.querySelectorAll('a')].find(
    (a) => a.textContent === 'Back to chat'
  )!
  expect(
    new URL(back.getAttribute('href')!, address).searchParams.get('node')
  ).toBe('question')
})
it('returns to research without replacing controller roots', async () => {
  const editor = shell.editorRoot
  await shell.go(new URL('/?space=space&detail=1&map=canvas', address))
  await shell.go(new URL('/?space=space&chat=chat&node=question', address))
  expect(shell.editorRoot).toBe(editor)
  expect(shell.researchRoot.hidden).toBe(false)
  expect(app.researchWorkspace.open).toHaveBeenLastCalledWith('space')
  expect(app.mapCanvas.dismiss).toHaveBeenCalledTimes(2)
})
it('maps engine source links to the actual notebook instead of a duplicate read-only document', async () => {
  await shell.go(
    new URL(
      '/?space=space&detail=1&notebook=book&view=notebook&chat=chat&node=question',
      address
    )
  )
  expect(address.searchParams.get('projectView')).toBe('notes')
  expect(address.searchParams.get('book')).toBe('book')
  expect(address.searchParams.get('node')).toBe('question')
  expect(address.searchParams.has('detail')).toBe(false)
  expect(app.openNotebook).not.toHaveBeenCalled()
  expect(app.researchWorkspace.open).toHaveBeenCalledWith('space')
})
it('maps aggregated source links to all project content, keeping the selected notebook', () => {
  const url = new URL(
    '/?space=space&detail=1&notebook=canvas&book=book&view=notebook',
    address
  )
  const target = new URL(projectNotesTarget(url, project.notebooks)!, address)
  expect(target.searchParams.get('projectView')).toBe('canvas')
  expect(target.searchParams.get('book')).toBe('book')
  url.searchParams.set('map', 'canvas')
  expect(projectNotesTarget(url, project.notebooks)).toBeNull()
})
it('does not reopen a late output after navigating back to research', async () => {
  let resolve!: (value: ResearchProjectView) => void
  vi.mocked(researchApi.load).mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done
      })
  )
  const pending = shell.go(
    new URL('/?space=space&detail=1&notebook=book', address)
  )
  await shell.go(new URL('/?space=space&chat=chat', address))
  resolve(project)
  await pending
  expect(app.openNotebook).not.toHaveBeenCalled()
  expect(shell.researchRoot.hidden).toBe(false)
})
it('keeps an active recording in place instead of abandoning it', async () => {
  Object.assign(app.capture, { phase: 'recording' })
  expect(await shell.go(new URL('/?space=space', address))).toBe(false)
  expect(app.stopPractice).not.toHaveBeenCalled()
  expect(app.error).toHaveBeenCalled()
})
