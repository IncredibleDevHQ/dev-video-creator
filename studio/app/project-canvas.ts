import type { ResearchProjectView } from '../shared/research'
import {
  researchDocumentFor,
  researchDocumentGraph,
  researchDocumentTitle
} from '../shared/research-documents'
import { conversationTurns } from '../shared/research-conversations'
import type { Snapshot } from '../shared/api'
import type { MapCanvas } from './map-canvas'
import type { Box, MapLayout } from './map-layout'
import { projectContext, projectLink } from './project-links'
import { escape } from './ui'
import {
  excerptDestinations,
  notebookHierarchy,
  notebookHierarchyView,
  notebookSource
} from './notebook-hierarchy'
export { excerptDestinations } from './notebook-hierarchy'

export type ProjectCanvasItem = {
  key: string
  cls: string
  box: Box
  html: string
}
export type ProjectCanvasLayout = { frames: Box[]; items: ProjectCanvasItem[] }

/** Ignore malformed persisted coordinates instead of breaking the world layout. */
export function canvasPositions(
  raw: string | null
): Record<string, { x: number; y: number }> {
  try {
    const value: unknown = JSON.parse(raw || '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(
      Object.entries(value).filter(
        ([key, point]) =>
          /^(r|n):/.test(key) &&
          point &&
          typeof point === 'object' &&
          Number.isFinite(point.x) &&
          Number.isFinite(point.y)
      )
    )
  } catch {
    return {}
  }
}

/** Adds research and excerpts to the SAME world/layout as the wireframe map. */
export function extendProjectCanvas(
  project: ResearchProjectView,
  snapshot: Snapshot,
  layout: MapLayout,
  positions: Record<string, { x: number; y: number }>,
  current: string | null
): ProjectCanvasLayout {
  const items: ProjectCanvasItem[] = []
  const graph = researchDocumentGraph(project.nodes)
  const boxes = new Map<string, Box>()
  const depths = new Map<string, number>()
  const ordered: typeof graph = []
  const visit = (id: string | null, depth: number) => {
    for (const doc of graph.filter((n) => n.parentId === id)) {
      if (depths.has(doc.id)) continue
      depths.set(doc.id, depth)
      ordered.push(doc)
      visit(doc.id, depth + 1)
    }
  }
  visit(null, 0)
  for (const doc of graph)
    if (!depths.has(doc.id)) {
      depths.set(doc.id, 0)
      ordered.push(doc)
    }
  const width = 300 + Math.max(0, ...depths.values()) * 40
  const research = {
    x: -width - 500,
    y: 40,
    w: width + 40,
    h: Math.max(260, 120 + ordered.length * 200)
  }
  const hierarchy = notebookHierarchy(project, snapshot)
  const notes = hierarchy.flatMap((g) => g.cards.flatMap((c) => c.entries))
  const notebook = {
    x: -400,
    y: 40,
    w: 370,
    h: Math.max(
      260,
      120 +
        notes.length * 210 +
        hierarchy.reduce((n, g) => n + 55 + g.cards.length * 70, 0)
    )
  }
  const context = projectContext(new URL(location.href))
  const frame = (key: string, box: Box, title: string, subtitle: string) =>
    items.push({
      key,
      box,
      cls: 'map-block project-canvas-frame',
      html: `<div class="map-block-head"><h2>${title}</h2><p>${escape(subtitle)}</p></div>`
    })
  frame(
    'B:research',
    research,
    'Research',
    `${project.chats?.length || 0} channels · ${ordered.length} connected conversations`
  )
  frame(
    'B:notebook',
    notebook,
    'Notebook',
    `${notes.length} excerpts · shared across this project`
  )
  const noteRows = new Map<string, number>()
  let nextRow = 140
  const manualNotes = notes.flatMap(({ block }) => {
    const point = positions[`n:${block.id}`]
    return point ? [{ ...point, w: 330, h: 190 }] : []
  })
  const takeRow = (height: number) => {
    let hit: (typeof manualNotes)[number] | undefined
    while (
      (hit = manualNotes.find(
        (b) =>
          b.x < notebook.x + 350 &&
          b.x + b.w > notebook.x + 20 &&
          b.y < nextRow + height &&
          b.y + b.h > nextRow
      ))
    )
      nextRow = hit.y + hit.h + 20
    const y = nextRow
    nextRow += height + 20
    return y
  }
  for (const group of hierarchy) {
    items.push({
      key: `ng:${group.id}`,
      box: { x: notebook.x + 20, y: takeRow(35), w: 330, h: 35 },
      cls: 'project-notebook-group',
      html: `<h3>${escape(group.title)}</h3>`
    })
    for (const card of group.cards) {
      if (card.id) {
        items.push({
          key: `nc:${card.id}`,
          box: { x: notebook.x + 20, y: takeRow(50), w: 330, h: 50 },
          cls: 'project-notebook-group is-card',
          html: `<strong>${escape(card.title)}</strong><button data-project-card="${escape(card.id)}">${card.entries.length} ${card.entries.length === 1 ? 'excerpt' : 'excerpts'} · View card →</button>`
        })
      }
      for (const { block } of card.entries) {
        if (!positions[`n:${block.id}`]) noteRows.set(block.id, takeRow(190))
      }
    }
  }
  notebook.h = Math.max(notebook.h, nextRow - notebook.y + 20)
  for (const [i, doc] of ordered.entries()) {
    const key = `r:${doc.id}`
    const box = {
      x: positions[key]?.x ?? research.x + 20 + (depths.get(doc.id) || 0) * 40,
      y: positions[key]?.y ?? 140 + i * 200,
      w: 280,
      h: 180
    }
    boxes.set(doc.id, box)
    const turns = conversationTurns(project.nodes, doc.id)
    const last = turns.at(-1) || doc
    const chat = project.chats?.find((c) => c.id === doc.chatId)
    const href = projectLink(
      project.id,
      { ...context, chat: doc.chatId, node: last.id },
      { projectView: 'research' }
    )
    items.push({
      key,
      box,
      cls: `project-research-card${researchDocumentFor(project.nodes, current)?.id === doc.id ? ' is-current' : ''}`,
      html: `<small>${escape(chat?.title || 'Channel')} · ${turns.length} ${turns.length === 1 ? 'turn' : 'turns'}</small><strong>${escape(researchDocumentTitle(doc))}</strong><p>${escape(doc.anchor?.text || last.answerText.slice(0, 140) || last.activity || 'Research in progress')}</p><a href="${href}">Continue conversation →</a>`
    })
  }
  for (const doc of ordered) {
    const a = boxes.get(doc.parentId || ''),
      b = boxes.get(doc.id)!
    if (a)
      layout.flows.push({
        key: `research:${doc.id}`,
        kind: 'research',
        from: `r:${doc.parentId}`,
        to: `r:${doc.id}`,
        x1: a.x + 12,
        y1: a.y + a.h,
        x2: b.x + 12,
        y2: b.y,
        points: [
          [a.x + 12, a.y + a.h],
          [a.x + 12, b.y - 10],
          [b.x + 12, b.y - 10],
          [b.x + 12, b.y]
        ]
      })
  }
  notes.forEach(({ book, block }) => {
    const key = `n:${block.id}`,
      box = {
        x: positions[key]?.x ?? notebook.x + 20,
        y: positions[key]?.y ?? noteRows.get(block.id)!,
        w: 330,
        h: 190
      }
    const origin = block.origin
    const source = origin
      ? project.nodes.find((n) => n.id === origin.nodeId)
      : undefined
    const doc = source && researchDocumentFor(project.nodes, source.id)
    const a = doc && boxes.get(doc.id)
    const href = projectLink(
      project.id,
      {
        ...context,
        notebook: book.id,
        chat: source?.chatId || context.chat,
        node: source?.id || context.node
      },
      { projectView: source ? 'research' : 'notes', excerpt: block.id }
    )
    const destination = excerptDestinations(project, block.id, snapshot)
    items.push({
      key,
      box,
      cls: 'project-excerpt-card',
      html: `<small>${escape(source ? 'Saved from ' + researchDocumentTitle(doc || source) : book.title)}</small><p>${escape(block.text)}</p>${block.comment ? `<small>Your note: ${escape(block.comment)}</small>` : ''}<small>${escape(destination.label)}</small><footer><a href="${href}">${source ? 'Back to source passage' : 'Open notebook'} ↗</a>${destination.cards[0] ? `<button data-project-card="${escape(destination.cards[0].id)}">View card →</button>` : ''}</footer>`
    })
    if (a)
      layout.flows.push({
        key: `excerpt:${block.id}`,
        kind: 'excerpt',
        from: `r:${doc!.id}`,
        to: key,
        x1: a.x + a.w,
        y1: a.y + a.h / 2,
        x2: box.x,
        y2: box.y + box.h / 2
      })
    const targets = destination.cards.flatMap((c) =>
      layout.cards[c.id] ? [{ id: `m:${c.id}`, box: layout.cards[c.id] }] : []
    )
    if (
      !targets.length &&
      snapshot.project.researchSeedBlocks?.includes(block.id)
    )
      targets.push({ id: 'B:map', box: layout.map })
    for (const target of targets)
      layout.flows.push({
        key: `note-card:${block.id}:${target.id}`,
        kind: 'excerpt',
        from: key,
        to: target.id,
        x1: box.x + box.w,
        y1: box.y + box.h / 2,
        x2: target.box.x,
        y2: target.box.y + Math.min(80, target.box.h / 2)
      })
  })
  if (!ordered.length)
    items.push({
      key: 'research:empty',
      box: { x: research.x + 20, y: 140, w: 280, h: 100 },
      cls: 'project-research-card',
      html: '<strong>Your research starts here</strong><p>Ask a question in Chat. Select a passage to grow a new branch.</p>'
    })
  if (!notes.length)
    items.push({
      key: 'notebook:empty',
      box: { x: notebook.x + 20, y: 140, w: 330, h: 100 },
      cls: 'project-excerpt-card',
      html: '<strong>Keep what matters</strong><p>Select a passage in any conversation and add it to your notebook. Its source stays connected.</p>'
    })
  return {
    frames: [
      research,
      notebook,
      ...items
        .filter((i) => i.key.startsWith('r:') || i.key.startsWith('n:'))
        .map((i) => i.box)
    ],
    items
  }
}

export function installProjectCanvas(map: MapCanvas) {
  map.root.addEventListener('click', (event) => {
    const target = (event.target as Element).closest<HTMLElement>(
      '[data-project-focus],[data-project-card],[data-project-focus-note]'
    )
    if (!target || !map.isOpen) return
    if (target.dataset.projectFocusNote) {
      const box = map.layout?.projectCanvas?.items.find(
        (item) => item.key === `n:${target.dataset.projectFocusNote}`
      )?.box
      if (box) map.fit(box)
    } else if (target.dataset.projectCard) {
      const id = target.dataset.projectCard
      const box = map.layout?.cards[id]
      if (box) {
        map.select({ t: 'page', id })
        map.fit(box)
      }
    } else {
      const which = target.dataset.projectFocus
      const chat = new URL(location.href).searchParams.get('chat')
      const channelBoxes =
        map.layout?.projectCanvas?.items
          .filter(
            (item) =>
              item.key.startsWith('r:') &&
              map.research?.nodes.some(
                (node) => `r:${node.id}` === item.key && node.chatId === chat
              )
          )
          .map((item) => item.box) || []
      const channelBounds = channelBoxes.length
        ? {
            x: Math.min(...channelBoxes.map((b) => b.x)) - 20,
            y: Math.min(...channelBoxes.map((b) => b.y)) - 20,
            w:
              Math.max(...channelBoxes.map((b) => b.x + b.w)) -
              Math.min(...channelBoxes.map((b) => b.x)) +
              40,
            h:
              Math.max(...channelBoxes.map((b) => b.y + b.h)) -
              Math.min(...channelBoxes.map((b) => b.y)) +
              40
          }
        : null
      const box =
        which === 'research'
          ? channelBounds || map.layout?.projectCanvas?.frames[0]
          : which === 'notes'
            ? map.layout?.projectCanvas?.frames[1]
            : which === 'wireframes'
              ? map.layout?.map
              : which === 'episodes'
                ? map.layout?.series
                : undefined
      map.fit(box || undefined)
    }
  })
  // Research and excerpt cards share world coordinates and camera with wireframes.
  map.root.addEventListener(
    'pointerdown',
    (event) => {
      const target = event.target as Element
      const node = target.closest<HTMLElement>(
        '.project-research-card,.project-excerpt-card'
      )
      if (!map.isOpen || !node || target.closest('a,button') || event.button)
        return
      const key = node.dataset.k!
      if (!key.startsWith('r:') && !key.startsWith('n:')) return
      const item = map.layout?.projectCanvas?.items.find((i) => i.key === key)
      if (!item) return
      event.stopImmediatePropagation()
      event.preventDefault()
      const start = { x: event.clientX, y: event.clientY },
        initial = { ...item.box }
      node.setPointerCapture(event.pointerId)
      const move = (e: PointerEvent) => {
        map.projectPositions[key] = {
          x: initial.x + (e.clientX - start.x) / map.camera.k,
          y: initial.y + (e.clientY - start.y) / map.camera.k
        }
        map.paint()
      }
      const end = () => {
        node.removeEventListener('pointermove', move)
        node.removeEventListener('pointerup', end)
        node.removeEventListener('pointercancel', end)
        try {
          localStorage.setItem(
            `project-canvas-positions:${map.research?.id}`,
            JSON.stringify(map.projectPositions)
          )
        } catch {}
      }
      node.addEventListener('pointermove', move)
      node.addEventListener('pointerup', end)
      node.addEventListener('pointercancel', end)
    },
    true
  )
}

/** The canvas rail reads the same durable excerpts as the chat notebook. */
export function projectCanvasNotes(
  project: ResearchProjectView,
  snapshot: Snapshot
) {
  const context = projectContext(new URL(location.href))
  const groups = notebookHierarchy(project, snapshot)
  if (!groups.length)
    return '<p class="project-canvas-note-empty">Your shared notebook is empty. Keep an excerpt from any conversation; it stays linked to its source here.</p>'
  return (
    `<div class="notebook-intro"><h2>Research, taking shape.</h2><p>One notebook across your channels. Every excerpt keeps its source and its place in the story.</p></div>` +
    notebookHierarchyView(
      groups,
      (entry, card) => {
        const { block } = entry
        const source = notebookSource(project, entry, context)
        const destination = excerptDestinations(project, block.id, snapshot)
        return `<article class="project-canvas-note" data-notebook-excerpt="${escape(block.id)}">
        <p>${escape(block.text)}</p>${block.comment ? `<blockquote>${escape(block.comment)}</blockquote>` : ''}
        <a class="notebook-source-link" href="${source.href}" title="${escape(source.path)}">↖ ${escape(source.title)}</a>
        ${destination.cards
          .filter((c) => c.id !== card)
          .map(
            (c) =>
              `<button class="notebook-also-supports" data-project-card="${escape(c.id)}">Also supports: ${escape(c.title)} →</button>`
          )
          .join('')}
        <details id="canvas-note-details-${escape(block.id)}"><summary>Details & actions</summary><small>${escape(destination.label)}</small><footer><button data-project-focus-note="${escape(block.id)}">Locate on canvas</button></footer></details>
      </article>`
      },
      (id) => `<button data-project-card="${escape(id)}">View card →</button>`
    )
  )
}
