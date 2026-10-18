import { expect, it } from 'vitest'
import { parseHTML } from 'linkedom'
import type { ResearchNode } from '../shared/research'
import { graphLayout, graphNeighborhood } from '../app/research-graph-model'
import { researchGraph } from '../app/research-graph'
import {
  normalizeResearchLayout,
  researchDraftKey
} from '../app/research-layout'
import { renderResearch } from '../app/research-render'
const node = (id: string, parentId: string | null): ResearchNode => ({
  id,
  parentId,
  question: `Question ${id}`,
  answer: 'Answer',
  answerText: 'Answer',
  at: '',
  state: 'done',
  harness: { adapter: 'claude-code' },
  repos: []
})
const nodes = [
  node('root', null),
  node('left', 'root'),
  node('right', 'root'),
  node('deep', 'left'),
  node('other', null)
]
it('reveals a bounded local neighborhood through parent and child connections', () => {
  expect([...graphNeighborhood(nodes, 'left', 1)].sort()).toEqual([
    'deep',
    'left',
    'root'
  ])
  expect([...graphNeighborhood(nodes, 'left', 2)].sort()).toEqual([
    'deep',
    'left',
    'right',
    'root'
  ])
  expect(graphNeighborhood(nodes, 'left', 3).has('other')).toBe(false)
})
it('keeps coordinates deterministic and creates only actual parent links', () => {
  expect(graphLayout(nodes)).toEqual(graphLayout(nodes))
  const { document } = parseHTML(researchGraph(nodes, 'left', '', 'local', 1))
  expect(
    [...document.querySelectorAll('[data-graph-node]')]
      .map((e) => e.getAttribute('data-graph-node'))
      .sort()
  ).toEqual(['deep', 'left', 'root'])
  expect(document.querySelectorAll('[data-graph-edge]')).toHaveLength(2)
  const points = graphLayout(nodes).points
  expect(
    points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
  ).toBe(true)
  expect(points.find((p) => p.id === 'root')!.radius).toBeGreaterThan(
    points.find((p) => p.id === 'deep')!.radius
  )
})
it('safely renders disconnected or cyclic imported graph records', () => {
  const malformed = [node('a', 'b'), node('b', 'a'), node('c', 'missing')]
  expect(graphLayout(malformed).points).toHaveLength(3)
  expect(() => researchGraph(malformed, 'a')).not.toThrow()
})
it('normalizes pane preferences and isolates drafts by resource', () => {
  expect(
    normalizeResearchLayout({
      graphWidth: Infinity,
      notesWidth: -10,
      depth: 99
    })
  ).toMatchObject({ graphWidth: 310, notesWidth: 230, depth: 3 })
  expect(researchDraftKey('research-question', 'book', 'a')).not.toBe(
    researchDraftKey('research-question', 'book', 'b')
  )
  expect(researchDraftKey('research-note-input', 'one', 'a')).toBe(
    researchDraftKey('research-note-input', 'one', 'b')
  )
  expect(researchDraftKey('research-note-input', 'one', 'a')).not.toBe(
    researchDraftKey('research-note-input', 'two', 'a')
  )
})
it('retains a composer element across layout changes but replaces it on branch change', () => {
  const { document } = parseHTML(
    '<main><textarea id="research-question" placeholder="Message Claude Code…">Unsent draft</textarea></main>'
  )
  const root = document.querySelector('main')! as unknown as HTMLElement
  const input = root.querySelector('textarea')
  const key = { 'research-question': 'branch-a' }
  renderResearch(
    root,
    '<aside>Graph</aside><textarea id="research-question" placeholder="Message Kimi…"></textarea>',
    key,
    key
  )
  expect(root.querySelector('textarea')).toBe(input)
  expect(root.querySelector('textarea')!.textContent).toBe('Unsent draft')
  expect(input!.getAttribute('placeholder')).toBe('Message Kimi…')
  renderResearch(root, '<textarea id="research-question"></textarea>', key, {
    'research-question': 'branch-b'
  })
  expect(root.querySelector('textarea')).not.toBe(input)
})
