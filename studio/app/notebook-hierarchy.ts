import type { NoteBlock, ResearchProjectView } from '../shared/research'
import {
  researchDocumentFor,
  researchDocumentGraph,
  researchDocumentTitle
} from '../shared/research-documents'
import { projectLink, type ProjectContext } from './project-links'
import { escape } from './ui'
import { noteLine } from './note-landing'

export type NotebookEntry = {
  book: ResearchProjectView['notebooks'][number]
  block: NoteBlock
}
export type NotebookGroup = {
  id: string
  title: string
  description?: string
  cards: {
    id: string | null
    title: string
    entries: NotebookEntry[]
  }[]
}

/** Read actual organizer results. Repeated results refer to one card; renamed
 * cards use their current title. Deleted/failed targets aren't placements. */
export function excerptDestinations(
  project: ResearchProjectView,
  blockId: string,
  snapshot = project.canvas
) {
  const note = snapshot?.project.notes?.find((n) => n.id === blockId)
  const slides = snapshot?.project.slides || []
  const cards = [
    ...new Set(
      (note?.results || [])
        .filter((r) => r.landing !== 'failed')
        .map((r) => r.slideId)
    )
  ].flatMap((id) => {
    const card = slides.find((s) => s.id === id)
    return card ? [{ id, title: card.title }] : []
  })
  return {
    cards,
    label: note
      ? noteLine(note)
      : snapshot?.project.researchSeedBlocks?.includes(blockId)
        ? 'Included in the initial wireframes'
        : 'Saved · waiting for wireframes'
  }
}

/** A single notebook, organized by real topic → card → excerpt relationships.
 * Each excerpt is rendered once, under its first surviving destination in story
 * order. Further destinations remain links, never duplicate saved notes.
 * Initial source material has collection-level lineage, not invented card links. */
export function notebookHierarchy(
  project: ResearchProjectView,
  snapshot = project.canvas,
  notebook?: string
): NotebookGroup[] {
  const entries = project.notebooks
    .filter((book) => !notebook || book.id === notebook)
    .flatMap((book) => book.blocks.map((block) => ({ book, block })))
  const slides = snapshot?.project.slides || []
  const placed = new Map<string, NotebookEntry[]>()
  const seed: NotebookEntry[] = [],
    waiting: NotebookEntry[] = []
  for (const entry of entries) {
    const ids = new Set(
      excerptDestinations(project, entry.block.id, snapshot).cards.map(
        (c) => c.id
      )
    )
    const card = slides.find((s) => ids.has(s.id))
    if (card) placed.set(card.id, [...(placed.get(card.id) || []), entry])
    else if (snapshot?.project.researchSeedBlocks?.includes(entry.block.id))
      seed.push(entry)
    else waiting.push(entry)
  }
  const topics = [
    ...new Set([
      ...(snapshot?.project.topics || []),
      ...slides.map((s) => s.topic || '')
    ])
  ]
  const groups: NotebookGroup[] = topics.flatMap((topic) => {
    const cards = slides
      .filter((s) => (s.topic || '') === topic && placed.has(s.id))
      .map((s) => ({ id: s.id, title: s.title, entries: placed.get(s.id)! }))
    return cards.length
      ? [{ id: `topic:${topic}`, title: topic || 'Wireframes', cards }]
      : []
  })
  if (seed.length)
    groups.push({
      id: 'starting-research',
      title: 'Starting research',
      description: 'These notes shaped the initial wireframes together.',
      cards: [{ id: null, title: 'Starting research', entries: seed }]
    })
  if (waiting.length)
    groups.push({
      id: 'not-placed',
      title: 'Not placed yet',
      description: 'Saved here while your wireframes take shape.',
      cards: [{ id: null, title: 'Not placed yet', entries: waiting }]
    })
  return groups
}

/** Source identity is the exact saved turn, with document ancestry as a tooltip. */
export function notebookSource(
  project: ResearchProjectView,
  entry: NotebookEntry,
  context: ProjectContext
) {
  const source = project.nodes.find((n) => n.id === entry.block.origin?.nodeId)
  const doc = source && researchDocumentFor(project.nodes, source.id)
  const graph = researchDocumentGraph(project.nodes)
  const path: string[] = []
  const seen = new Set<string>()
  let current = doc
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    path.unshift(researchDocumentTitle(current))
    const parent = graph.find((n) => n.id === current!.id)?.parentId
    current = graph.find((n) => n.id === parent)
  }
  return {
    title: doc ? researchDocumentTitle(doc) : source?.question || 'Notebook',
    path: path.join(' › '),
    href: projectLink(
      project.id,
      {
        ...context,
        notebook: entry.book.id,
        chat: source?.chatId || context.chat,
        node: source?.id || context.node
      },
      { projectView: source ? 'research' : 'notes', excerpt: entry.block.id }
    )
  }
}

/** Shared visual hierarchy for both the notebook and the canvas inspector. */
export function notebookHierarchyView(
  groups: NotebookGroup[],
  renderEntry: (entry: NotebookEntry, card: string | null) => string,
  cardLink: (id: string) => string
) {
  return `<div class="notebook-hierarchy">${groups
    .map(
      (group) =>
        `<section class="notebook-topic" data-notebook-topic="${escape(group.id)}">
      <div class="notebook-topic-heading"><h2>${escape(group.title)}</h2><span>${group.cards.reduce((n, c) => n + c.entries.length, 0)} ${group.cards.reduce((n, c) => n + c.entries.length, 0) === 1 ? 'excerpt' : 'excerpts'}</span></div>
      ${group.description ? `<p class="notebook-topic-description">${escape(group.description)}</p>` : ''}
      ${group.cards
        .map(
          (
            card
          ) => `<section class="notebook-card-group" ${card.id ? `data-notebook-card="${escape(card.id)}"` : ''}>
        ${card.id ? `<div class="notebook-card-heading"><span aria-hidden="true">▱</span><h3>${escape(card.title)}</h3>${cardLink(card.id)}</div>` : ''}
        <div class="notebook-card-excerpts">${card.entries.map((e) => renderEntry(e, card.id)).join('')}</div>
      </section>`
        )
        .join('')}
    </section>`
    )
    .join('')}</div>`
}
