import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseHTML } from 'linkedom'
import type { ResearchNode, ResearchProjectView } from '../shared/research'
import type { Snapshot } from '../shared/api'
import { mapLayout, extent } from '../app/map-layout'
import { notebookHierarchy, notebookSource } from '../app/notebook-hierarchy'
import {
  canvasPositions,
  extendProjectCanvas,
  excerptDestinations
} from '../app/project-canvas'

const turn = (
  id: string,
  parentId: string | null,
  extra: Partial<ResearchNode> = {}
): ResearchNode => ({
  id,
  parentId,
  chatId: 'channel',
  question: id,
  answer: 'Evidence',
  answerText: 'Evidence',
  at: '',
  state: 'done',
  harness: { adapter: 'codex' },
  repos: [],
  ...extra
})
const snapshot: Snapshot = {
  project: {
    id: 'map',
    title: 'Research',
    source: '',
    slides: [{ id: 'card', title: 'A story card', svg: '' }],
    video: null,
    notes: [
      {
        id: 'excerpt',
        at: '',
        text: 'Evidence',
        state: 'sorted',
        results: [
          {
            kind: 'adds',
            slideId: 'card',
            title: 'A story card',
            line: 'Evidence'
          }
        ]
      }
    ]
  },
  status: 'ready',
  error: null,
  events: []
}
const project = (): ResearchProjectView => ({
  id: 'project',
  title: 'Repository',
  createdAt: '',
  updatedAt: '',
  repos: [],
  snapshots: [],
  canvas: snapshot,
  chats: [
    {
      id: 'channel',
      title: 'Research channel',
      repos: [],
      createdAt: '',
      updatedAt: ''
    }
  ],
  nodes: [
    turn('root', null),
    turn('reply', 'root', { artifact: false, conversationId: 'root' }),
    turn('branch', 'reply', {
      anchor: {
        kind: 'response',
        id: 'reply',
        text: 'Evidence',
        start: 0,
        end: 8
      }
    }),
    turn('deep', 'branch', {
      anchor: {
        kind: 'response',
        id: 'branch',
        text: 'Evidence',
        start: 0,
        end: 8
      }
    })
  ],
  notebooks: [
    {
      id: 'notebook',
      title: 'Shared notebook',
      blocks: [
        {
          id: 'excerpt',
          text: 'Evidence',
          at: '',
          origin: {
            nodeId: 'deep',
            question: 'deep',
            response: 'Evidence',
            start: 0,
            end: 8,
            repos: []
          }
        }
      ]
    }
  ]
})
afterEach(() => vi.unstubAllGlobals())
function canvas(p = project(), positions = {}) {
  vi.stubGlobal('location', {
    href: 'http://localhost/?space=project&chat=channel&node=deep'
  })
  const layout = mapLayout(snapshot, null, 'order')
  layout.projectCanvas = extendProjectCanvas(
    p,
    snapshot,
    layout,
    positions,
    'deep'
  )
  return layout
}
describe('connected project canvas', () => {
  it('groups related excerpts under a real topic and card without repeating multi-card notes', () => {
    const p = project()
    const map = structuredClone(snapshot)
    map.project.slides[0].topic = 'Token loop'
    map.project.topics = ['Token loop']
    map.project.slides.push({
      id: 'other',
      title: 'Another card',
      svg: '',
      topic: 'Token loop'
    })
    map.project.notes![0].results!.push(
      { ...map.project.notes![0].results![0] },
      { kind: 'covered', slideId: 'other', title: 'Another card', line: '' }
    )
    p.notebooks[0].blocks.push({ id: 'second', text: 'Second excerpt', at: '' })
    map.project.notes!.push({
      id: 'second',
      text: 'Second excerpt',
      at: '',
      state: 'sorted',
      results: [
        { kind: 'adds', slideId: 'card', title: 'Old card name', line: '' }
      ]
    })
    const groups = notebookHierarchy(p, map)
    expect(groups.map((g) => g.title)).toEqual(['Token loop'])
    expect(groups[0].cards[0].entries.map((e) => e.block.id)).toEqual([
      'excerpt',
      'second'
    ])
    expect(
      groups.flatMap((g) => g.cards.flatMap((c) => c.entries))
    ).toHaveLength(2)
    expect(excerptDestinations(p, 'excerpt', map).cards).toEqual([
      { id: 'card', title: 'A story card' },
      { id: 'other', title: 'Another card' }
    ])
  })
  it('does not claim a failed or deleted target as a placement and preserves seed lineage', () => {
    const p = project(),
      map = structuredClone(snapshot)
    map.project.notes![0].results![0].landing = 'failed'
    map.project.notes![0].results!.push({
      kind: 'new',
      slideId: 'deleted',
      title: 'Gone',
      line: ''
    })
    expect(notebookHierarchy(p, map)[0].id).toBe('not-placed')
    map.project.notes = []
    map.project.researchSeedBlocks = ['excerpt']
    const groups = notebookHierarchy(p, map)
    expect(groups[0].id).toBe('starting-research')
    expect(groups[0].cards[0].id).toBeNull()
    expect(groups[0].cards[0].entries[0].block).toBe(p.notebooks[0].blocks[0])
  })
  it('keeps the exact turn link and ancestor path when an excerpt comes from a normal follow-up', () => {
    const p = project()
    p.nodes.push(
      turn('last', 'deep', { artifact: false, conversationId: 'deep' })
    )
    const book = p.notebooks[0],
      block = book.blocks[0]
    block.origin!.nodeId = 'last'
    const source = notebookSource(p, { book, block }, { chat: 'unrelated' })
    expect(source.path).toBe('root › branch › deep')
    expect(source.href).toContain('node=last')
    expect(source.href).toContain('chat=channel')
    expect(source.href).toContain('excerpt=excerpt')
  })
  it('keeps ordinary replies in one conversation and links recursive branches', () => {
    const layout = canvas()
    expect(
      layout
        .projectCanvas!.items.filter((i) => i.key.startsWith('r:'))
        .map((i) => i.key)
    ).toEqual(['r:root', 'r:branch', 'r:deep'])
    expect(
      layout.flows
        .filter((f) => f.kind === 'research')
        .map((f) => [f.from, f.to])
    ).toEqual([
      ['r:root', 'r:branch'],
      ['r:branch', 'r:deep']
    ])
    const root = parseHTML(
      layout.projectCanvas!.items.find((i) => i.key === 'r:root')!.html
    ).document
    expect(root.querySelector('a')!.getAttribute('href')).toContain(
      'node=reply'
    )
  })
  it('connects an excerpt to its exact source and actual organizer card', () => {
    const layout = canvas()
    expect(
      layout.flows
        .filter((f) => f.kind === 'excerpt')
        .map((f) => [f.from, f.to])
    ).toEqual([
      ['r:deep', 'n:excerpt'],
      ['n:excerpt', 'm:card']
    ])
    const note = parseHTML(
      layout.projectCanvas!.items.find((i) => i.key === 'n:excerpt')!.html
    ).document
    const url = new URL(
      note.querySelector('a')!.getAttribute('href')!,
      'http://localhost'
    )
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      book: 'notebook',
      chat: 'channel',
      node: 'deep',
      excerpt: 'excerpt'
    })
  })
  it('does not invent precise card lineage for seed notes', () => {
    const seeded = structuredClone(snapshot)
    seeded.project.notes = []
    seeded.project.researchSeedBlocks = ['excerpt']
    expect(excerptDestinations(project(), 'excerpt', seeded)).toEqual({
      cards: [],
      label: 'Included in the initial wireframes'
    })
  })
  it('retains manual placements and includes them in fit bounds', () => {
    const layout = canvas(project(), { 'r:deep': { x: -2600, y: 1800 } })
    expect(
      layout.projectCanvas!.items.find((i) => i.key === 'r:deep')!.box
    ).toMatchObject({ x: -2600, y: 1800 })
    const bounds = extent(layout)
    expect(bounds.x).toBeLessThanOrEqual(-2600)
    expect(bounds.y + bounds.h).toBeGreaterThanOrEqual(1980)
  })
  it('tolerates missing source records and malformed saved positions', () => {
    const p = project()
    p.notebooks[0].blocks[0].origin!.nodeId = 'deleted'
    expect(() => canvas(p)).not.toThrow()
    expect(canvasPositions('null')).toEqual({})
    expect(
      canvasPositions('{"r:ok":{"x":1,"y":2},"r:bad":{"x":"bad","y":3}}')
    ).toEqual({ 'r:ok': { x: 1, y: 2 } })
  })
})
