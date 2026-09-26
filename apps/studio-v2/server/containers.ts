// Projects (the four-notebook model). The project the creator sees is a
// container: it holds notebooks — its text, wireframe, presentation and
// video — each a notebook of its own that names its project and what it is
// there. The project keeps what belongs to the whole; which notebooks it
// holds is read off the notebooks, so there is one record of it.
import { formatOf, notebookSummaryOf, type NotebookSummary, type ProjectContainerV1, type ProjectDocumentV1 } from 'markdown-composition'
import type { ProjectArtifactSummary } from './persistence'

export type ContainerView = { container: ProjectContainerV1; notebooks: NotebookSummary[] }

export type ContainerDeps = {
  loadContainer: (id: string) => Promise<ProjectContainerV1 | null>
  saveContainer: (container: ProjectContainerV1) => Promise<void>
  listNotebooks: () => Promise<ProjectArtifactSummary[]>
  loadNotebook: (id: string) => Promise<ProjectDocumentV1 | null>
  now?: () => string
}

const nowOf = (deps: ContainerDeps) => deps.now?.() || new Date().toISOString()

// A project made, or renamed: its title is the project's own.
export const nameContainer = async (id: string, title: string, deps: ContainerDeps) => {
  const now = nowOf(deps)
  const existing = await deps.loadContainer(id)
  const container: ProjectContainerV1 = existing
    ? { ...existing, title: title || existing.title, updatedAt: now }
    : { version: 1, id, title: title || 'Untitled project', createdAt: now, updatedAt: now }
  await deps.saveContainer(container)
  return container
}

// A notebook saved into a project: the project is made if it is new, named
// after the notebook, and marked as changed.
export const holdNotebook = async (notebook: ProjectDocumentV1, deps: ContainerDeps) => {
  const place = notebook.container
  if (!place?.id || !formatOf(place.kind)) return null
  const now = nowOf(deps)
  const existing = await deps.loadContainer(place.id)
  const container: ProjectContainerV1 = existing
    ? { ...existing, updatedAt: now }
    : { version: 1, id: place.id, title: notebook.title || 'Untitled project', createdAt: now, updatedAt: now }
  await deps.saveContainer(container)
  return container
}

// A project with its notebooks, newest first, each counted in what its kind
// holds.
export const containerView = async (id: string, deps: ContainerDeps): Promise<ContainerView | null> => {
  const container = await deps.loadContainer(id)
  if (!container) return null
  const rows = (await deps.listNotebooks()).filter(row => row.container?.id === id)
  const notebooks = (
    await Promise.all(
      rows.map(async row => {
        const notebook = await deps.loadNotebook(row.id)
        return notebook ? notebookSummaryOf(notebook, row.updatedAt) : null
      }),
    )
  ).filter((summary): summary is NotebookSummary => Boolean(summary))
  return { container, notebooks: notebooks.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')) }
}
