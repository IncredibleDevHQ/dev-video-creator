import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, expect, it, vi } from 'vitest'
import { parseHTML } from 'linkedom'
import { researchHtml } from '../shared/research-markdown'
import { researchPath } from '../shared/research'
const { stage, start } = vi.hoisted(() => ({ stage: vi.fn(), start: vi.fn() }))
vi.mock('./creative/stage', async (original) => ({
  ...(await original<typeof import('./creative/stage')>()),
  runValidatedJsonStage: stage
}))
vi.mock('./notebook-intake', async (original) => ({
  ...(await original<typeof import('./notebook-intake')>()),
  startPresentation: start,
  availableHarness: async (h: unknown) => h,
  detectedHarness: async () => ({ adapter: 'claude-code' })
}))
const root = await mkdtemp(join(tmpdir(), 'studio-research-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const projects = await import('./research-projects')
const chat = await import('./research-chat')
const { loadProject, changeProject } = await import('./projects')
const { readRow } = await import('./persistence')
afterAll(() => rm(root, { recursive: true, force: true }))
beforeEach(() => {
  vi.clearAllMocks()
  stage.mockResolvedValue({
    answer:
      'A **durable outbox** keeps the event with the order.\n\nRetries still need deduplication.'
  })
})
it('creates a project and first notebook from one note, preserving separate notebooks', async () => {
  const p = await projects.createResearchProject({ text: 'First thought' })
  expect(p.title).toBe('My project')
  expect(p.notebooks).toHaveLength(1)
  const p2 = await projects.addProjectNotebook(p.id, { title: 'Architecture' })
  await Promise.all([
    projects.addProjectNote(p.id, {
      notebookId: p2.notebooks[0].id,
      text: 'Next thought'
    }),
    projects.addProjectNote(p.id, {
      notebookId: p2.notebooks[1].id,
      text: 'Separate subject'
    })
  ])
  const saved = await projects.researchProjectView(p.id)
  expect(saved.notebooks[0].blocks.map((b) => b.text)).toEqual([
    'First thought',
    'Next thought'
  ])
  expect(saved.notebooks[1].blocks.map((b) => b.text)).toEqual([
    'Separate subject'
  ])
  expect((await loadProject(p2.notebooks[1].id))!.project.source).toBe(
    'Separate subject'
  )
})
it('keeps exact excerpt lineage while excluding sibling context', async () => {
  const p = await projects.createResearchProject({ text: 'Research notes' })
  const ask = async (question: string, parentId?: string) => {
    const result = await chat.askResearch(p.id, {
      question,
      parentId,
      harness: { adapter: 'claude-code' }
    })
    await chat.settledResearch(result.nodeId)
    return result.nodeId
  }
  const first = await ask('How does an outbox work?')
  const child = await ask('What about retries?', first)
  const sibling = await ask('What about ordering?', first)
  const packet = JSON.parse(
    stage.mock.calls.at(-1)![0].packet['packet/CONVERSATION.json']
  )
  expect(packet.map((n: { question: string }) => n.question)).toEqual([
    'How does an outbox work?'
  ])
  let saved = await projects.researchProjectView(p.id)
  expect(researchPath(saved.nodes, sibling).map((n) => n.id)).toEqual([
    first,
    sibling
  ])
  expect(saved.nodes.find((n) => n.id === child)?.parentId).toBe(first)
  const node = saved.nodes[0]
  const text = 'durable outbox'
  const start = node.answerText.indexOf(text)
  await projects.addProjectNote(p.id, {
    notebookId: p.notebooks[0].id,
    nodeId: first,
    start,
    end: start + text.length
  })
  await projects.addProjectNote(p.id, {
    notebookId: p.notebooks[0].id,
    nodeId: first,
    start,
    end: start + text.length
  })
  saved = await projects.researchProjectView(p.id)
  expect(saved.notebooks[0].blocks).toHaveLength(2)
  expect(saved.notebooks[0].blocks[1].origin?.response).toBe(node.answerText)
  expect(saved.notebooks[0].blocks[1].text).toBe(text)
  const next = await chat.askResearch(p.id, {
    question: 'Explain this passage',
    parentId: first,
    anchor: {
      kind: 'note',
      notebookId: p.notebooks[0].id,
      id: saved.notebooks[0].blocks[1].id,
      start: 0,
      end: text.length
    }
  })
  await chat.settledResearch(next.nodeId)
  expect(
    JSON.parse(stage.mock.calls.at(-1)![0].packet['packet/QUESTION.json'])
      .selection.text
  ).toBe(text)
  await expect(
    projects.addProjectNote(p.id, {
      notebookId: 'foreign',
      text: 'Wrong project'
    })
  ).rejects.toThrow('Choose a notebook')
  await expect(
    projects.addProjectNote(p.id, {
      notebookId: p.notebooks[0].id,
      nodeId: first,
      start: -1,
      end: 5
    })
  ).rejects.toThrow('Select an excerpt')
})
it('keeps stopped and interrupted questions without allowing late answers to replace them', async () => {
  const p = await projects.createResearchProject({ text: 'Keep me' })
  let resolve!: (value: unknown) => void
  stage.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done
      })
  )
  const result = await chat.askResearch(p.id, { question: 'A long question' })
  await vi.waitFor(() => expect(resolve).toBeTypeOf('function'))
  await chat.stopResearch(p.id, { nodeId: result.nodeId })
  resolve({ answer: 'Late answer' })
  await chat.settledResearch(result.nodeId)
  expect((await projects.readResearchProject(p.id)).nodes[0]).toMatchObject({
    state: 'stopped',
    answer: ''
  })
  await projects.changeResearchProject(p.id, (p) => {
    p.nodes[0].state = 'working'
  })
  await chat.recoverResearch()
  expect((await projects.readResearchProject(p.id)).nodes[0]).toMatchObject({
    state: 'failed',
    question: 'A long question'
  })
})
it('creates one combined canvas and syncs later notes exactly once', async () => {
  const p = await projects.createResearchProject({ text: 'Initial knowledge' })
  const second = await projects.addProjectNotebook(p.id, {
    title: 'Second subject'
  })
  await projects.addProjectNote(p.id, {
    notebookId: second.notebooks[1].id,
    text: 'Another topic'
  })
  const ready = await projects.prepareProjectWireframes(p.id, {})
  const canvas = await loadProject(ready.canvasId!)
  expect(canvas?.project.source).toContain('Initial knowledge')
  expect(canvas?.project.source).toContain('Another topic')
  expect(canvas?.project.researchSeedBlocks).toHaveLength(2)
  await changeProject(ready.canvasId!, (s) => {
    s.status = 'building'
  })
  await projects.addProjectNote(p.id, {
    notebookId: p.notebooks[0].id,
    text: 'New insight'
  })
  await projects.syncResearchProject(p.id)
  await projects.syncResearchProject(p.id)
  expect((await loadProject(ready.canvasId!))?.project.notes).toHaveLength(1)
  expect(
    (await loadProject(ready.canvasId!))?.project.notes?.[0].text
  ).toContain('New insight')
  expect(
    (await readRow<{ text: string }>('sources', p.notebooks[0].id))?.text
  ).toContain('New insight')
})
it('renders selectable Markdown without raw HTML or remote image loads', () => {
  const html = researchHtml(
    'A **strong** claim.\n\n<script>alert(1)</script>\n\n![image](https://example.com/tracker)\n\n[bad](javascript:alert(1))'
  )
  expect(html).not.toContain('<script')
  expect(html).not.toContain('<img')
  expect(html).not.toContain('href="javascript:')
  expect(
    parseHTML(`<div id="a">${html}</div>`).document.getElementById('a')!
      .textContent
  ).toContain('A strong claim.')
})
it('routes notes captured in the existing map UI into the project without recursive duplicates', async () => {
  const p = await projects.createResearchProject({ text: 'Original note' })
  const ready = await projects.prepareProjectWireframes(p.id, {})
  const { addNote } = await import('./map-notes')
  await addNote(ready.canvasId!, { text: 'Captured on the shared canvas' })
  const saved = await projects.readResearchProject(p.id)
  expect(saved.notebooks[0].blocks.map((b) => b.text)).toEqual([
    'Original note',
    'Captured on the shared canvas'
  ])
  expect((await loadProject(ready.canvasId!))!.project.notes).toHaveLength(1)
})
it('starts one shared canvas after capture and feeds later excerpts into that same canvas', async () => {
  start.mockImplementation(async (id: string) =>
    changeProject(id, (s) => {
      s.status = 'building'
    })
  )
  const p = await projects.createResearchProject({ title: 'Channel notebook' })
  const body = {
    notebookId: p.notebooks[0].id,
    text: 'Durable writes and a retry queue',
    autoOrganize: true,
    harness: { adapter: 'codex' }
  }
  await projects.addProjectNote(p.id, body)
  await projects.organizeResearchProject(p.id)
  const first = await projects.researchProjectView(p.id)
  expect(first.canvasId).toBeTruthy()
  await projects.addProjectNote(p.id, {
    ...body,
    text: 'Use stable identifiers to deduplicate retries'
  })
  await projects.organizeResearchProject(p.id)
  const after = await projects.researchProjectView(p.id)
  expect(after.canvasId).toBe(first.canvasId)
  expect(after.notebooks).toHaveLength(1)
  expect(after.notebooks[0].blocks).toHaveLength(2)
  expect(after.canvas?.project.notes?.map((n) => n.id)).toEqual([
    after.notebooks[0].blocks[1].id
  ])
  expect(start).toHaveBeenCalledTimes(1)
})

it('keeps a saved excerpt exact while carrying its separate comment into the notebook source', async () => {
  const p = await projects.createResearchProject({
    title: 'Commented research'
  })
  const result = await chat.askResearch(p.id, {
    question: 'Explain an outbox',
    harness: { adapter: 'claude-code' }
  })
  await chat.settledResearch(result.nodeId)
  const body = {
    notebookId: p.notebooks[0].id,
    nodeId: result.nodeId,
    start: 0,
    end: 16,
    comment: 'Use this to introduce episode one.'
  }
  await projects.addProjectNote(p.id, body)
  await projects.addProjectNote(p.id, body)
  const saved = await projects.researchProjectView(p.id)
  expect(saved.notebooks[0].blocks).toHaveLength(1)
  const block = saved.notebooks[0].blocks[0]
  expect(block.text).toBe(block.origin!.response.slice(0, 16))
  expect(block.comment).toBe(body.comment)
  expect((await loadProject(p.notebooks[0].id))?.project.source).toContain(
    'Your comment: Use this to introduce episode one.'
  )
})
