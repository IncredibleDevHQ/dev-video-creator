import { describe, expect, it } from 'vitest'
import { NOTEBOOK_FORMATS, notebookSummaryOf, type NotebookKind, type ProjectContainerV1, type ProjectDocumentV1 } from 'markdown-composition'
import { containerView, holdNotebook, nameContainer, type ContainerDeps } from './containers'
import type { ProjectArtifactSummary } from './persistence'

// The four-notebook model: a project holds notebooks, each naming its
// project and what it is there; the project keeps what belongs to the whole.
const page = (id: string, pageOrigin: Record<string, unknown> | null = null) => ({ type: 'scene', attrs: { id, title: id, pageOrigin } })
const notebook = (id: string, kind: NotebookKind | null, content: ProjectDocumentV1['notebook']['content'], extra: Partial<ProjectDocumentV1> = {}) =>
  ({ version: 1, id, title: `Notebook ${id}`, notebook: { type: 'doc', content }, blocks: {}, presenterTracks: {}, ...(kind ? { container: { id: 'p1', kind } } : {}), ...extra }) as unknown as ProjectDocumentV1

const store = (notebooks: ProjectDocumentV1[]) => {
  const containers = new Map<string, ProjectContainerV1>()
  let tick = 0
  const deps: ContainerDeps = {
    loadContainer: async id => containers.get(id) || null,
    saveContainer: async container => void containers.set(container.id, container),
    listNotebooks: async () => notebooks.map((entry, index): ProjectArtifactSummary => ({ id: entry.id, title: entry.title, blockCount: 0, createdAt: '', updatedAt: `2026-09-26T10:0${index}:00.000Z`, ...(entry.container ? { container: entry.container } : {}) })),
    loadNotebook: async id => notebooks.find(entry => entry.id === id) || null,
    now: () => `2026-09-26T12:00:0${tick++}.000Z`,
  }
  return { deps, containers }
}

describe('a project and its notebooks', () => {
  it('lists its kinds in the order the switch shows them, each made from the one before', () => {
    expect(NOTEBOOK_FORMATS.map(format => [format.kind, format.madeFrom])).toEqual([['text', null], ['wireframe', 'text'], ['presentation', 'wireframe'], ['video', 'presentation']])
  })

  it('is made by the first notebook saved into it, named after it, and kept when others join', async () => {
    const text = notebook('t1', 'text', [{ type: 'paragraph', content: [{ type: 'text', text: 'BoltDB keeps one file.' }] }], { title: 'How BoltDB works' })
    const { deps, containers } = store([text])
    await holdNotebook(text, deps)
    expect(containers.get('p1')).toMatchObject({ id: 'p1', title: 'How BoltDB works', createdAt: '2026-09-26T12:00:00.000Z' })
    await holdNotebook(notebook('w1', 'wireframe', [], { title: 'Something else' }), deps)
    expect(containers.get('p1')).toMatchObject({ title: 'How BoltDB works', createdAt: '2026-09-26T12:00:00.000Z', updatedAt: '2026-09-26T12:00:01.000Z' })
    await nameContainer('p1', 'BoltDB, page by page', deps)
    expect(containers.get('p1')?.title).toBe('BoltDB, page by page')
  })

  it('a notebook with no project stands alone, and makes none', async () => {
    const alone = notebook('n1', null, [])
    const { deps, containers } = store([alone])
    expect(await holdNotebook(alone, deps)).toBeNull()
    expect(containers.size).toBe(0)
    expect(notebookSummaryOf(alone)).toBeNull()
  })

  it('says of each notebook where it stands, counted in what its kind holds', async () => {
    const notebooks = [
      notebook('t1', 'text', [{ type: 'heading', content: [{ type: 'text', text: 'Layer 1' }] }, { type: 'paragraph' }, { type: 'paragraph', content: [{ type: 'text', text: 'Pages.' }] }]),
      notebook('w1', 'wireframe', [page('a', { kind: 'schematic' }), page('b', { kind: 'schematic' })]),
      notebook('pr1', 'presentation', [page('a', { kind: 'designed', by: 'Kimi' }), page('b', { kind: 'schematic', designing: { runId: 'r1', page: 2 } })]),
      notebook('v1', 'video', [page('v-a'), page('v-b')], { producedScenes: { 'v-a': { videoUrl: '/a.mp4' } } as unknown as ProjectDocumentV1['producedScenes'] }),
      notebook('elsewhere', null, [page('x')]),
    ]
    notebooks[4].container = { id: 'p2', kind: 'wireframe' }
    const { deps } = store(notebooks)
    await nameContainer('p1', 'How BoltDB works', deps)
    const view = await containerView('p1', deps)
    expect(view?.container.title).toBe('How BoltDB works')
    expect(Object.fromEntries((view?.notebooks || []).map(entry => [entry.kind, [entry.state, entry.detail]]))).toEqual({
      text: ['ready', '2 blocks'],
      wireframe: ['ready', '2 pages'],
      presentation: ['building', '1 of 2 designed'],
      video: ['ready', '1 of 2 scenes produced'],
    })
    expect(view?.notebooks.map(entry => entry.id)).toEqual(['v1', 'pr1', 'w1', 't1'])
  })

  it('a project not made says so', async () => {
    const { deps } = store([])
    expect(await containerView('missing', deps)).toBeNull()
  })
})
