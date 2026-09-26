// The kinds of notebook a project holds, in the order its switch shows them,
// and what each is made from. Each kind owns its notebook's model and its
// tools; the project only knows which notebooks it holds. A new kind — a
// live stream, a newsletter — is a new entry here with its own summary
// below, and its own tools in the studio.
import type { NotebookKind, ProjectDocumentV1, TiptapNode } from './types'

export type NotebookFormat = {
  kind: NotebookKind
  label: string
  // The kind of notebook this one is made from; the first is made from the
  // source itself.
  madeFrom: NotebookKind | null
  // What it holds, in a few words: its notebook's heading, and what its
  // tab says it opens.
  holds: string
}

export const NOTEBOOK_FORMATS: readonly NotebookFormat[] = [
  { kind: 'text', label: 'Text', madeFrom: null, holds: 'the article, as text' },
  { kind: 'wireframe', label: 'Wireframe', madeFrom: 'text', holds: 'the pages, in basic shapes' },
  { kind: 'presentation', label: 'Presentation', madeFrom: 'wireframe', holds: 'the designed slides' },
  { kind: 'video', label: 'Video', madeFrom: 'presentation', holds: 'the scenes, planned, recorded and produced' },
]

export const formatOf = (kind: unknown): NotebookFormat | null => NOTEBOOK_FORMATS.find(format => format.kind === kind) || null
export const isNotebookKind = (value: unknown): value is NotebookKind => formatOf(value) !== null

// A notebook as its project lists it: where it stands, counted in what its
// kind holds. 'building' while its pages are still being made; 'empty' with
// nothing in it yet.
export type NotebookSummary = {
  id: string
  kind: NotebookKind
  title: string
  from?: string
  updatedAt?: string
  state: 'ready' | 'building' | 'empty'
  detail: string
}

const PAGE_TYPES = new Set(['scene', 'slide', 'explainer'])
const count = (value: number, noun: string) => `${value} ${noun}${value === 1 ? '' : 's'}`
const hasWords = (node: TiptapNode): boolean =>
  Boolean(node.text?.trim()) || (node.content || []).some(hasWords) || PAGE_TYPES.has(node.type) || node.type === 'image'

// Each kind counts what it holds.
const SUMMARIES: Record<NotebookKind, (notebook: ProjectDocumentV1, pages: TiptapNode[]) => Pick<NotebookSummary, 'state' | 'detail'>> = {
  text: notebook => {
    const blocks = (notebook.notebook?.content || []).filter(hasWords).length
    return { state: blocks ? 'ready' : 'empty', detail: count(blocks, 'block') }
  },
  // Still being made in the background, it says so — or that it could not be.
  wireframe: (notebook, pages) =>
    notebook.build
      ? { state: 'building', detail: notebook.build.failure ? 'could not be made' : 'being made' }
      : { state: pages.length ? 'ready' : 'empty', detail: count(pages.length, 'page') },
  presentation: (_notebook, pages) => {
    const origins = pages.map(page => (page.attrs?.pageOrigin || null) as { kind?: string; designing?: unknown } | null)
    const designing = origins.filter(origin => origin?.designing && origin.kind !== 'designed').length
    const designed = origins.filter(origin => origin?.kind === 'designed').length
    if (!pages.length) return { state: 'empty', detail: count(0, 'slide') }
    return designing
      ? { state: 'building', detail: `${designed} of ${pages.length} designed` }
      : { state: 'ready', detail: count(pages.length, 'slide') }
  },
  video: (notebook, pages) => {
    const produced = pages.filter(page => notebook.producedScenes?.[String(page.attrs?.id || '')]).length
    if (!pages.length) return { state: 'empty', detail: count(0, 'scene') }
    return { state: 'ready', detail: produced ? `${produced} of ${pages.length} scenes produced` : count(pages.length, 'scene') }
  },
}

export const notebookSummaryOf = (notebook: ProjectDocumentV1, updatedAt?: string): NotebookSummary | null => {
  const place = notebook.container
  if (!place || !isNotebookKind(place.kind)) return null
  const pages = (notebook.notebook?.content || []).filter(node => PAGE_TYPES.has(node.type) && node.attrs?.id)
  return {
    id: notebook.id,
    kind: place.kind,
    title: notebook.title,
    ...(place.from ? { from: place.from } : {}),
    ...(updatedAt ? { updatedAt } : {}),
    ...SUMMARIES[place.kind](notebook, pages),
  }
}
