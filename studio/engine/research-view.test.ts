import { expect, it } from 'vitest'
import { parseHTML } from 'linkedom'
import { researchHtml } from '../shared/research-markdown'
import {
  researchWorkspaceView,
  type ResearchViewState
} from '../app/research-view'
import { researchGraph } from '../app/research-graph'
import type { ResearchNode } from '../shared/research'
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
      .querySelector('#research-question-form button')
      ?.hasAttribute('disabled')
  ).toBe(true)
  expect(doc.querySelector('.research-branch-hint')?.textContent).toContain(
    'Ask again'
  )
  expect(doc.querySelector('[data-retry-node="root"]')).not.toBeNull()
})
