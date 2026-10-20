import { researchPath, type ResearchAnchor } from '../shared/research'
import { conversationTurns } from '../shared/research-conversations'
import {
  researchDocumentFor,
  researchDocumentGraph,
  researchDocumentTitle
} from '../shared/research-documents'
import type { ResearchViewState } from './research-view'
import { escape } from './ui'

export const conversationHeader = (s: ResearchViewState) => {
  const doc = researchDocumentFor(s.project.nodes, s.node)
  if (!doc)
    return '<div class="conversation-heading"><h2>Start your conversation</h2><p>Add repository context below, or ask a question.</p></div>'
  const graph = researchDocumentGraph(s.project.nodes)
  const path = researchPath(graph, doc.id)
  const parentId = graph.find((n) => n.id === doc.id)?.parentId
  const children = graph.filter((n) => n.parentId === doc.id)
  const siblings = parentId
    ? graph.filter((n) => n.parentId === parentId && n.id !== doc.id)
    : []
  const links = (nodes: typeof graph, label: string) =>
    nodes.length
      ? `<section><h3>${label}</h3>${nodes.map((n) => `<button type="button" data-research-node="${escape(n.id)}"><span>${escape(researchDocumentTitle(n))}</span>${n.anchor ? `<small>${escape(n.anchor.text.slice(0, 160))}</small>` : ''}</button>`).join('')}</section>`
      : ''
  const connections =
    children.length + siblings.length
      ? `<details class="conversation-connections" id="connections-${escape(doc.id)}"><summary>Connected branches <span>${children.length + siblings.length}</span></summary><div>${links(children, 'Branches from here')}${links(siblings, 'Other branches from the same source')}</div></details>`
      : ''
  return `<div class="conversation-heading"><nav aria-label="Conversation path">${path.map((n, i) => `${i ? ' <span>›</span> ' : ''}<button data-research-node="${n.id}" ${n.id === doc.id ? 'aria-current="page"' : ''}>${escape(i === 0 ? 'Channel' : researchDocumentTitle(n))}</button>`).join('')}</nav><h2>${escape(researchDocumentTitle(doc))}</h2><div class="conversation-heading-meta"><span>${conversationTurns(s.project.nodes, s.node).length} ${conversationTurns(s.project.nodes, s.node).length === 1 ? 'turn' : 'turns'} in this conversation</span><button data-research-action="path-context">What this knows</button></div>${doc.anchor ? `<div class="conversation-source"><button data-research-source="${doc.id}">← Back to source passage</button><details><summary>Selected passage</summary><blockquote>${escape(doc.anchor.text)}</blockquote></details></div>` : ''}${connections}</div>`
}

/** UI inserted into prose is excluded from selection offsets. The stored plain
 * answer stays immutable; outlines and the inline composer never become notes. */
export const selectedText = (fragment: DocumentFragment) => {
  fragment.querySelectorAll('[data-research-ui]').forEach((el) => el.remove())
  return fragment.textContent || ''
}
export const mountConversation = (root: HTMLElement, s: ResearchViewState) => {
  for (const prose of root.querySelectorAll<HTMLElement>(
    '.research-transcript [data-select-response]'
  )) {
    const headings = [...prose.querySelectorAll<HTMLElement>('h1,h2,h3')]
    if (headings.length > 2) {
      const outline = document.createElement('details')
      outline.className = 'conversation-outline'
      outline.id = `outline-${prose.dataset.selectResponse}`
      outline.innerHTML = `<summary>In this answer · ${headings.length} sections</summary>`
      headings.forEach((heading, i) => {
        heading.id = `answer-${prose.dataset.selectResponse}-${i}`
        const button = document.createElement('button')
        button.type = 'button'
        button.textContent = heading.textContent
        button.dataset.researchHeading = heading.id
        outline.append(button)
      })
      prose.before(outline)
    }
  }
  if (s.anchor?.kind === 'response') highlightPassage(root, s.anchor)
  else if (s.sourceFocus) highlightPassage(root, s.sourceFocus)
}
export const highlightPassage = (root: HTMLElement, anchor: ResearchAnchor) => {
  const prose = root.querySelector<HTMLElement>(
    `[data-select-response="${CSS.escape(anchor.id)}"]`
  )
  if (!prose) return
  const walker = document.createTreeWalker(prose, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      n.parentElement?.closest('[data-research-ui]')
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT
  })
  const matches: { node: Text; from: number; to: number }[] = []
  let offset = 0,
    n: Node | null
  while ((n = walker.nextNode())) {
    const end = offset + (n.textContent || '').length
    if (end > anchor.start && offset < anchor.end)
      matches.push({
        node: n as Text,
        from: Math.max(0, anchor.start - offset),
        to: Math.min(end - offset, anchor.end - offset)
      })
    offset = end
  }
  for (const m of matches.reverse()) {
    const range = document.createRange()
    range.setStart(m.node, m.from)
    range.setEnd(m.node, m.to)
    const mark = document.createElement('mark')
    mark.className = 'research-source-highlight'
    range.surroundContents(mark)
  }
}
export const scrollToPassage = (root: HTMLElement) =>
  root
    .querySelector('.research-source-highlight')
    ?.scrollIntoView({ block: 'center' })
