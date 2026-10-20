import { expect, it } from 'vitest'
import { parseHTML } from 'linkedom'
import { researchHtml } from '../shared/research-markdown'
import {
  researchWorkspaceView,
  type ResearchViewState
} from '../app/research-view'
import { researchGraph } from '../app/research-graph'
import type { ResearchNode } from '../shared/research'
import { openGeneratedResearchDocument } from '../app/research-artifact'
import { defaultResearchLayout } from '../app/research-layout'
const answer =
  '**Keep the first character.**\n\nThen keep the second paragraph.'
const canonical = parseHTML(
  `<div id="text">${researchHtml(answer)}</div>`
).document.getElementById('text')!.textContent!
const node: ResearchNode = {
  id: 'root',
  parentId: null,
  question: 'Why preserve lineage?',
  answer,
  answerText: canonical,
  at: '2026-10-17',
  state: 'done',
  harness: { adapter: 'claude-code' },
  repos: []
}
const state: ResearchViewState = {
  project: {
    id: 'space',
    title: 'Project',
    createdAt: '',
    updatedAt: '',
    notebooks: [
      {
        id: 'notes',
        title: 'Notebook',
        blocks: [{ id: 'block', text: 'First character\nSecond line', at: '' }]
      }
    ],
    nodes: [node],
    repos: [],
    snapshots: [],
    canvas: null
  },
  tab: 'research',
  notebook: 'notes',
  node: 'root',
  anchor: null,
  repos: [],
  inspected: null,
  adapter: 'claude-code',
  model: '',
  query: '',
  pending: false,
  message: '',
  error: ''
}
it('opens a note-based research document even after the composer selection was cleared', () => {
  const current = structuredClone(state)
  const layout = { ...defaultResearchLayout(), notesOpen: true }
  current.layout = layout
  current.anchor = null
  current.project.nodes[0].anchor = {
    kind: 'note',
    id: 'block',
    notebookId: 'notes',
    start: 0,
    end: 5,
    text: 'First'
  }
  openGeneratedResearchDocument(current, layout, 'root')
  expect(current.chatMinimized).toBe(false)
  expect(layout.notesOpen).toBe(false)
  const doc = parseHTML(researchWorkspaceView(current)).document
  expect(doc.querySelector('.research-columns')?.className).toContain(
    'notes-hidden'
  )
  expect(
    doc.querySelector('.research-transcript [data-select-response="root"]')
  ).not.toBeNull()
})
it('keeps an ordinary follow-up in chat without displacing an open notebook', () => {
  const current = structuredClone(state)
  const layout = { ...defaultResearchLayout(), notesOpen: true }
  current.project.nodes.push({
    ...node,
    id: 'reply',
    parentId: 'root',
    artifact: false,
    contextDocumentId: 'root'
  })
  openGeneratedResearchDocument(current, layout, 'reply')
  expect(current.chatMinimized).toBe(false)
  expect(layout.notesOpen).toBe(true)
})
it('preserves exact selectable text after HTML template formatting, including Markdown offsets', () => {
  const document = parseHTML(researchWorkspaceView(state)).document
  expect(document.querySelector('[data-select-response]')!.textContent).toBe(
    canonical
  )
  expect(document.querySelector('[data-select-note]')!.textContent).toBe(
    'First character\nSecond line'
  )
  expect(
    document.querySelector('[data-select-response]')!.textContent!.slice(0, 4)
  ).toBe('Keep')
})
it('shows both research branches as keyboard buttons with a stable current node', () => {
  const children = [
    { ...node, id: 'a', parentId: 'root', question: 'First branch' },
    { ...node, id: 'b', parentId: 'root', question: 'Another branch' }
  ]
  const doc = parseHTML(researchGraph([node, ...children], 'b')).document
  expect(doc.querySelectorAll('button')).toHaveLength(3)
  expect(doc.querySelectorAll('[data-graph-edge]')).toHaveLength(2)
  expect(
    doc
      .querySelector('[aria-current="step"]')
      ?.getAttribute('data-research-node')
  ).toBe('b')
})
it('offers recovery instead of letting a stopped answer become a parent', () => {
  const stopped = structuredClone(state)
  stopped.project.nodes[0].state = 'stopped'
  const doc = parseHTML(researchWorkspaceView(stopped)).document
  expect(
    doc
      .querySelector('button[form="research-question-form"]')
      ?.hasAttribute('disabled')
  ).toBe(true)
  expect(doc.querySelector('.research-branch-hint')?.textContent).toContain(
    'Ask again'
  )
  expect(doc.querySelector('[data-retry-node="root"]')).not.toBeNull()
})
it('allows retrying from an answered document when a later chat turn failed', () => {
  const current = structuredClone(state)
  current.project.nodes.push({
    ...node,
    id: 'failed',
    parentId: 'root',
    state: 'failed',
    artifact: false
  })
  const doc = parseHTML(researchWorkspaceView(current)).document
  expect(
    doc
      .querySelector('button[form="research-question-form"]')
      ?.hasAttribute('disabled')
  ).toBe(false)
})

it('links a saved note back to its answer and to follow-up questions without duplicating selectable text', () => {
  const linked = structuredClone(state)
  linked.project.notebooks[0].blocks[0].origin = {
    nodeId: 'root',
    question: node.question,
    response: node.answer,
    start: 0,
    end: 4,
    repos: []
  }
  linked.project.nodes.push({
    ...node,
    id: 'follow-up',
    parentId: 'root',
    question: 'What follows from this note?',
    anchor: {
      kind: 'note',
      id: 'block',
      notebookId: 'notes',
      start: 0,
      end: 4,
      text: 'First'
    }
  })
  const doc = parseHTML(researchWorkspaceView(linked)).document
  expect(
    doc.querySelector('[data-note-block="block"] [data-research-node="root"]')
      ?.textContent
  ).toContain('View source')
  expect(
    doc.querySelector('.research-note-links [data-research-node="follow-up"]')
      ?.textContent
  ).toContain('What follows')
  expect(
    doc
      .querySelector('.research-saved-link')
      ?.getAttribute('data-select-notebook')
  ).toBe('notes')
  expect(doc.querySelector('[data-select-note]')?.textContent).toBe(
    'First character\nSecond line'
  )
})

it('shows notebook content from real data and keeps draft notebooks actionable', () => {
  const content = structuredClone(state)
  content.contentOpen = true
  content.project.notebooks.push({ id: 'empty', title: '<empty>', blocks: [] })
  const doc = parseHTML(researchWorkspaceView(content)).document
  expect(doc.querySelector('.research-columns')?.className).toContain(
    'content-expanded'
  )
  expect(
    doc.querySelectorAll('.project-content-scroll .project-content-notebook')
  ).toHaveLength(2)
  expect(
    doc.querySelectorAll('.project-creation-actions .research-primary')
  ).toHaveLength(2)
  expect(
    doc.querySelector('[data-notebook-id="notes"]')?.hasAttribute('disabled')
  ).toBe(false)
  expect(
    doc.querySelector(
      '.project-creation-actions [data-select-notebook="empty"]'
    )?.textContent
  ).toContain('Add a note')
  expect(doc.querySelector('empty')).toBeNull()
  expect(doc.querySelectorAll('.project-content-preview')).toHaveLength(0)
})

it('shows only the context list for the selected task and offers chat minimize and resume', () => {
  const current = structuredClone(state)
  current.chat = 'chat'
  current.project.chats = [
    {
      id: 'chat',
      title: 'Learning',
      notebookId: 'notes',
      repos: [],
      createdAt: '',
      updatedAt: ''
    }
  ]
  let doc = parseHTML(researchWorkspaceView(current)).document
  expect(doc.querySelectorAll('.project-primary-nav button')).toHaveLength(3)
  expect(
    doc
      .querySelector('[data-research-action="open-chat"]')
      ?.getAttribute('aria-current')
  ).toBe('page')
  expect(doc.querySelector('[aria-label="Project chats"]')).not.toBeNull()
  expect(doc.querySelector('#project-notebooks')).toBeNull()
  expect(doc.querySelector('[aria-label="Minimize chat"]')).not.toBeNull()
  current.documentExpanded = true
  doc = parseHTML(researchWorkspaceView(current)).document
  expect(doc.querySelector('[aria-label="Project chats"]')).toBeNull()
  expect(doc.querySelector('#project-notebooks')).not.toBeNull()
  expect(doc.querySelector('.project-resume-chat')?.textContent).toContain(
    'Resume chat'
  )
  current.contentOpen = true
  doc = parseHTML(researchWorkspaceView(current)).document
  expect(doc.querySelector('#project-notebooks')).toBeNull()
  expect(
    doc
      .querySelector('[data-research-action="open-content"]')
      ?.getAttribute('aria-current')
  ).toBe('page')
})

it('can resume a minimized draft before its first question creates a chat', () => {
  const fresh = structuredClone(state)
  fresh.project.chats = []
  fresh.chat = null
  fresh.documentExpanded = true
  fresh.chatMinimized = true
  const doc = parseHTML(researchWorkspaceView(fresh)).document
  expect(doc.querySelector('.project-resume-chat')?.textContent).toContain(
    'Resume chat'
  )
})

it('names document destinations and preserves exact selectable text while backtracking', () => {
  const parent = {
    ...node,
    chatId: 'chat',
    answer: '# Parent document\n\nEvidence'
  }
  const child = {
    ...node,
    id: 'child',
    chatId: 'chat',
    parentId: 'root',
    artifact: { title: 'Question title', parentId: 'root' },
    answer: '# Child document\n\n**Exact excerpt.**',
    contextDocumentId: 'root'
  }
  const current = { ...structuredClone(state), chat: 'chat', node: 'child' }
  current.project.nodes = [parent, child]
  const doc = parseHTML(researchWorkspaceView(current)).document
  expect(
    doc.querySelector('.conversation-heading [data-research-node="root"]')
      ?.textContent
  ).toContain('Channel')
  expect(doc.querySelector('.conversation-heading h2')?.textContent).toContain(
    'Child document'
  )
  expect(doc.querySelector('.notebook-return-document')?.textContent).toContain(
    'Back to Child document'
  )
  expect(
    doc.querySelector('.research-transcript [data-select-response="child"]')
      ?.textContent
  ).toBe(
    parseHTML(
      '<div id=canonical>' + researchHtml(child.answer) + '</div>'
    ).document.querySelector('#canonical')?.textContent
  )
})

it('continues an existing series instead of offering a separate notebook video', () => {
  const current = structuredClone(state)
  current.contentOpen = true
  current.project.snapshots = [
    {
      project: {
        id: 'notes',
        title: 'Notebook',
        source: 'Research',
        slides: [{ id: 'page', title: 'Finding', svg: '<svg></svg>' }],
        video: null,
        mapSeries: 'series'
      },
      status: 'ready',
      error: null,
      events: []
    }
  ]
  const doc = parseHTML(researchWorkspaceView(current)).document
  const content = doc.querySelector('[aria-label="Project content"]')!
  expect(content.textContent).toContain('Continue your series')
  const continuation = Array.from(content.querySelectorAll('a')).find((a) =>
    a.textContent?.includes('Continue series')
  )!
  expect(continuation.getAttribute('href')).toContain('map=notes')
  expect(content.textContent).not.toContain('Create video →')
  expect(content.textContent).not.toContain('Build a series from your notes')
  expect(content.textContent).toContain('Review source cards')
})

it('shows only document children and siblings in local connections, not ordinary turns or unrelated roots', () => {
  const root = { ...node, id: 'root', parentId: null, chatId: 'chat' }
  const branch = (id: string, parentId: string) => ({
    ...root,
    id,
    parentId,
    question: id,
    artifact: { title: id, parentId }
  })
  const current = { ...structuredClone(state), chat: 'chat', node: 'child' }
  current.project.nodes = [
    root,
    branch('child', 'root'),
    branch('sibling', 'root'),
    branch('grandchild', 'child'),
    { ...root, id: 'unrelated' },
    {
      ...root,
      id: 'turn',
      parentId: 'child',
      artifact: false as const,
      contextDocumentId: 'child'
    }
  ]
  const doc = parseHTML(researchWorkspaceView(current)).document
  const links = [
    ...doc.querySelectorAll('.conversation-connections [data-research-node]')
  ].map((n) => n.getAttribute('data-research-node'))
  expect(links).toEqual(['grandchild', 'sibling'])
  expect(doc.querySelector('.conversation-connections')?.textContent).toContain(
    'Other branches from the same source'
  )
})
