import { mkdtemp, rm, writeFile, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { afterAll, beforeEach, expect, it, vi } from 'vitest'
import type { ResearchProject } from '../shared/research'
import { normalizeResearchChats } from '../shared/research-chats'
import { researchDraftKey } from '../app/research-layout'
import {
  selectResearchChat,
  selectResearchNode
} from '../app/research-session-state'
import type { ResearchViewState } from '../app/research-view'
const { stage } = vi.hoisted(() => ({ stage: vi.fn() }))
vi.mock('./creative/stage', async (original) => ({
  ...(await original<typeof import('./creative/stage')>()),
  runValidatedJsonStage: stage
}))
vi.mock('./notebook-intake', async (original) => ({
  ...(await original<typeof import('./notebook-intake')>()),
  availableHarness: async (h: unknown) => h,
  detectedHarness: async () => ({ adapter: 'claude-code' })
}))
const root = await realpath(
  await mkdtemp(join(tmpdir(), 'studio-research-sessions-'))
)
process.env.MINIMAL_STUDIO_DATA_DIR = join(root, 'data')
const repo = join(root, 'repo')
execFileSync('git', ['init', '-b', 'main', repo], { stdio: 'ignore' })
await writeFile(join(repo, 'README.md'), 'A temporary research repository.')
const git = (...args: string[]) =>
  execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim()
git('add', 'README.md')
git(
  '-c',
  'user.name=Test',
  '-c',
  'user.email=test@example.test',
  'commit',
  '-m',
  'fixture'
)
git('branch', 'exploration')
const link = { path: repo, name: 'repo', branch: 'main', base: 'main' }
const projects = await import('./research-projects')
const sessions = await import('./research-sessions')
const questions = await import('./research-chat')
const { researchRoute } = await import('./research-routes')
afterAll(() => rm(root, { recursive: true, force: true }))
beforeEach(() => {
  vi.clearAllMocks()
  stage.mockResolvedValue({
    answer: 'Keep the evidence and choose the next question.'
  })
})
it('saves named chats, repository branches and agent defaults independently before a first answer', async () => {
  const p = await projects.createResearchProject({ text: 'Shared learning' })
  const a = await sessions.saveResearchChat(p.id, {
    title: 'Architecture',
    repos: [link, { ...link, branch: 'exploration' }],
    harness: { adapter: 'codex', model: 'example-model' }
  })
  const first = a.chats![0]
  const b = await sessions.saveResearchChat(p.id, { title: 'Episode ideas' })
  const second = b.chats![1]
  await researchRoute(
    new URL(`http://localhost/api/research-projects/${p.id}/chats`),
    'POST',
    {
      chatId: second.id,
      title: 'Series outline',
      harness: { adapter: 'kimi' }
    }
  )
  const saved = await projects.readResearchProject(p.id)
  expect(saved.chats![0]).toEqual(first)
  expect(saved.chats![1]).toMatchObject({
    title: 'Series outline',
    repos: [],
    harness: { adapter: 'kimi' }
  })
  await expect(
    sessions.saveResearchChat(p.id, { chatId: 'foreign', title: 'Oops' })
  ).rejects.toThrow('Choose a chat')
  await expect(
    sessions.saveResearchChat(p.id, { repos: Array(5).fill(link) })
  ).rejects.toThrow('four repositories')
  await expect(
    sessions.saveResearchChat(p.id, { harness: { adapter: 'unknown' } })
  ).rejects.toThrow('supported agent')
})
it('switches agents within a chat, preserves pinned answer history and rejects cross-chat ancestry', async () => {
  const p = await projects.createResearchProject({ text: 'Learning notebook' })
  const a = await sessions.saveResearchChat(p.id, {
    title: 'Research',
    repos: [link]
  })
  const chatId = a.chats![0].id
  const first = await questions.askResearch(p.id, {
    chatId,
    question: 'Explain the evidence'
  })
  await questions.settledResearch(first.nodeId)
  await sessions.saveResearchChat(p.id, {
    chatId,
    harness: { adapter: 'codex' },
    repos: [{ ...link, branch: 'exploration' }]
  })
  const second = await questions.askResearch(p.id, {
    chatId,
    parentId: first.nodeId,
    question: 'Challenge that answer'
  })
  await questions.settledResearch(second.nodeId)
  const saved = await projects.researchProjectView(p.id)
  expect(saved.nodes[0]).toMatchObject({
    chatId,
    harness: { adapter: 'claude-code' },
    repos: [{ ...link, commit: git('rev-parse', 'main') }]
  })
  expect(saved.nodes[1]).toMatchObject({
    chatId,
    parentId: first.nodeId,
    harness: { adapter: 'codex' },
    repos: [{ ...link, branch: 'exploration' }]
  })
  expect(
    JSON.parse(stage.mock.calls.at(-1)![0].packet['packet/CONVERSATION.json'])
  ).toHaveLength(1)
  const other = await sessions.saveResearchChat(p.id, {
    title: 'Separate chat'
  })
  await expect(
    questions.askResearch(p.id, {
      chatId: other.chats![1].id,
      parentId: first.nodeId,
      question: 'Wrong history'
    })
  ).rejects.toThrow('question from this chat')
  await projects.addProjectNote(p.id, {
    notebookId: p.notebooks[0].id,
    nodeId: second.nodeId,
    start: 0,
    end: 17
  })
  const note = (await projects.readResearchProject(p.id)).notebooks[0].blocks[1]
  expect(note.origin?.nodeId).toBe(second.nodeId)
  expect(note.origin?.repos[0].branch).toBe('exploration')
  expect(note.text).toBe('Keep the evidence')
})
it('allows separate chats to work concurrently, with one live turn per chat', async () => {
  const p = await projects.createResearchProject({ text: 'Work in parallel' })
  const a = await sessions.saveResearchChat(p.id, { title: 'First' })
  const b = await sessions.saveResearchChat(p.id, { title: 'Second' })
  const resolvers: Array<(v: { answer: string }) => void> = []
  stage.mockImplementation(
    () => new Promise((resolve) => resolvers.push(resolve))
  )
  const first = await questions.askResearch(p.id, {
    chatId: a.chats![0].id,
    question: 'First question'
  })
  const second = await questions.askResearch(p.id, {
    chatId: b.chats![1].id,
    question: 'Second question'
  })
  await vi.waitFor(() => expect(resolvers).toHaveLength(2))
  await expect(
    questions.askResearch(p.id, {
      chatId: a.chats![0].id,
      question: 'Too soon'
    })
  ).rejects.toThrow('this chat’s answer')
  await questions.stopResearch(p.id, { nodeId: first.nodeId })
  for (const resolve of resolvers) resolve({ answer: 'Done' })
  await Promise.all([
    questions.settledResearch(first.nodeId),
    questions.settledResearch(second.nodeId)
  ])
  expect(
    (await projects.readResearchProject(p.id)).nodes.map((n) => n.state)
  ).toEqual(['stopped', 'done'])
})
it('upgrades legacy roots deterministically without resetting chat settings on later reads', async () => {
  const p = await projects.createResearchProject({ text: 'Legacy knowledge' })
  const turn = await questions.askResearch(p.id, {
    question: 'Original question'
  })
  await questions.settledResearch(turn.nodeId)
  const legacy: ResearchProject = structuredClone(
    await projects.readResearchProject(p.id)
  )
  delete legacy.chats
  for (const node of legacy.nodes) delete node.chatId
  legacy.nodes.push({
    ...legacy.nodes[0],
    id: 'child',
    parentId: legacy.nodes[0].id,
    at: '9999',
    harness: { adapter: 'kimi' }
  })
  const upgraded = normalizeResearchChats(legacy)
  expect(upgraded.chats).toHaveLength(1)
  expect(upgraded.nodes[0].chatId).toBe(upgraded.nodes[1].chatId)
  expect(upgraded.chats![0].lastNodeId).toBe('child')
  upgraded.chats![0].harness = { adapter: 'codex' }
  expect(normalizeResearchChats(upgraded).chats![0].harness?.adapter).toBe(
    'codex'
  )
  expect(normalizeResearchChats(structuredClone(legacy))).toEqual(upgraded)
})
it('restores chat context, retains it while backtracking, and isolates empty-chat drafts', async () => {
  const p = await projects.createResearchProject({ text: 'Notes' })
  const a = await sessions.saveResearchChat(p.id, {
    title: 'First',
    repos: [link]
  })
  const first = await questions.askResearch(p.id, {
    chatId: a.chats![0].id,
    question: 'Explain'
  })
  await questions.settledResearch(first.nodeId)
  await sessions.saveResearchChat(p.id, {
    chatId: a.chats![0].id,
    harness: { adapter: 'codex' },
    repos: []
  })
  const b = await sessions.saveResearchChat(p.id, {
    title: 'Second',
    harness: { adapter: 'kimi' }
  })
  b.nodes.push({ ...b.nodes[0], id: 'followup', parentId: first.nodeId })
  b.chats![0].lastNodeId = 'followup'
  const s = { project: b, anchor: null } as ResearchViewState
  selectResearchChat(s, b.chats![1].id)
  expect(s.adapter).toBe('kimi')
  selectResearchNode(s, first.nodeId)
  expect(s.chat).toBe(a.chats![0].id)
  expect(s.adapter).toBe('codex')
  expect(s.repos).toEqual([])
  selectResearchChat(s, b.chats![1].id)
  expect(s.node).toBeNull()
  selectResearchChat(s, a.chats![0].id)
  expect(s.node).toBe(first.nodeId)
  expect(researchDraftKey('research-question', 'book', null, 'one')).not.toBe(
    researchDraftKey('research-question', 'book', null, 'two')
  )
  expect(researchDraftKey('research-repo-path', 'book', null, 'one')).not.toBe(
    researchDraftKey('research-repo-path', 'book', null, 'two')
  )
})

it('keeps notebook destinations scoped to the project and restores them with each chat', async () => {
  const initial = await projects.createResearchProject({
    text: 'First notebook'
  })
  const withNotebook = await projects.addProjectNotebook(initial.id, {
    title: 'Episode notes'
  })
  const one = initial.notebooks[0].id
  const two = withNotebook.notebooks[1].id
  const first = await sessions.saveResearchChat(initial.id, {
    title: 'First chat'
  })
  const second = await sessions.saveResearchChat(initial.id, {
    title: 'Second chat',
    notebookId: two,
    harness: { adapter: 'kimi', model: 'kimi-code/k3' }
  })
  expect(first.chats![0].notebookId).toBe(one)
  const s = { project: second, notebook: one } as ResearchViewState
  selectResearchChat(s, second.chats![1].id)
  expect(s.notebook).toBe(two)
  selectResearchChat(s, first.chats![0].id)
  expect(s.notebook).toBe(one)
  await sessions.saveResearchChat(initial.id, {
    chatId: first.chats![0].id,
    notebookId: two
  })
  expect(
    (await projects.readResearchProject(initial.id)).chats![0].notebookId
  ).toBe(two)
  const foreign = await projects.createResearchProject({
    title: 'Unrelated project'
  })
  for (const chatId of [undefined, first.chats![0].id])
    await expect(
      sessions.saveResearchChat(initial.id, {
        ...(chatId ? { chatId } : {}),
        notebookId: foreign.notebooks[0].id
      })
    ).rejects.toThrow('notebook in this project')
  await expect(
    questions.askResearch(initial.id, {
      notebookId: foreign.notebooks[0].id,
      question: 'Should be rejected'
    })
  ).rejects.toThrow('notebook in this project')
  expect(stage).not.toHaveBeenCalled()
  const turn = await questions.askResearch(initial.id, {
    notebookId: two,
    question: 'Start from this notebook'
  })
  await questions.settledResearch(turn.nodeId)
  expect(turn.project.chats!.at(-1)!.notebookId).toBe(two)
  delete s.project.chats![0].notebookId
  s.notebook = one
  selectResearchChat(s, s.project.chats![0].id)
  expect(s.notebook).toBe(one)
})

it('recovers a legacy chat notebook from its most recent saved excerpt', async () => {
  const initial = await projects.createResearchProject({
    title: 'Legacy destinations'
  })
  const project = await projects.addProjectNotebook(initial.id, {
    title: 'Saved findings'
  })
  const turn = await questions.askResearch(project.id, {
    question: 'First finding'
  })
  await questions.settledResearch(turn.nodeId)
  const saved = await projects.addProjectNote(project.id, {
    notebookId: project.notebooks[1].id,
    nodeId: turn.nodeId,
    start: 0,
    end: 4
  })
  delete saved.chats![0].notebookId
  const state = {
    project: saved,
    notebook: initial.notebooks[0].id
  } as ResearchViewState
  selectResearchChat(state, saved.chats![0].id)
  expect(state.notebook).toBe(project.notebooks[1].id)
})
it('keeps ordinary messages in one chat and creates document nodes only for the root and selected passages', async () => {
  const { researchDocumentGraph } = await import('../shared/research-documents')
  const p = await projects.createResearchProject({ text: 'Research artifacts' })
  const first = await questions.askResearch(p.id, {
    question: 'Explore the topic'
  })
  await questions.settledResearch(first.nodeId)
  const chatId = first.project.nodes[0].chatId
  const follow = await questions.askResearch(p.id, {
    chatId,
    parentId: first.nodeId,
    contextDocumentId: first.nodeId,
    question: 'Explain briefly'
  })
  await questions.settledResearch(follow.nodeId)
  let saved = await projects.readResearchProject(p.id)
  expect(saved.nodes[1].artifact).toBe(false)
  expect(researchDocumentGraph(saved.nodes)).toHaveLength(1)
  const child = await questions.askResearch(p.id, {
    chatId,
    parentId: first.nodeId,
    contextDocumentId: first.nodeId,
    question: 'Explore this passage',
    anchor: { kind: 'response', id: first.nodeId, start: 0, end: 17 }
  })
  await questions.settledResearch(child.nodeId)
  saved = await projects.readResearchProject(p.id)
  expect(
    researchDocumentGraph(saved.nodes).map((n) => [n.id, n.parentId])
  ).toEqual([
    [first.nodeId, null],
    [child.nodeId, first.nodeId]
  ])
  expect(new Set(saved.nodes.map((n) => n.chatId)).size).toBe(1)
  expect(saved.notebooks[0].blocks).toHaveLength(1)
  expect(
    JSON.parse(stage.mock.calls.at(-1)![0].packet['packet/CONVERSATION.json'])
  ).toHaveLength(2)
})

it('retries an interrupted first answer as a document with a research budget', async () => {
  const p = await projects.createResearchProject({ text: 'Research evidence' })
  stage.mockRejectedValueOnce(new Error('The agent stopped responding'))
  const first = await questions.askResearch(p.id, {
    question: 'Read the repository'
  })
  await questions.settledResearch(first.nodeId)
  const failed = await projects.readResearchProject(p.id)
  expect(failed.nodes[0].state).toBe('failed')
  const retry = await questions.askResearch(p.id, {
    chatId: failed.nodes[0].chatId,
    question: 'Read the repository again'
  })
  await questions.settledResearch(retry.nodeId)
  const saved = await projects.readResearchProject(p.id)
  expect(saved.nodes[1]).toMatchObject({
    state: 'done',
    artifact: { parentId: null }
  })
  expect(stage.mock.calls.at(-1)![0].operation).toBe('research')
})

it('refuses a resumed selected-passage answer that copies the earlier document', async () => {
  const p = await projects.createResearchProject({ text: 'Evidence' })
  const chat = await sessions.saveResearchChat(p.id, { title: 'Explore' })
  const answer = 'Repository evidence with a specific explanation. '.repeat(10)
  stage.mockResolvedValue({ answer })
  const first = await questions.askResearch(p.id, {
    chatId: chat.chats![0].id,
    question: 'Explain this repository'
  })
  await questions.settledResearch(first.nodeId)
  const second = await questions.askResearch(p.id, {
    chatId: chat.chats![0].id,
    parentId: first.nodeId,
    question: 'Why does this work?',
    anchor: { kind: 'response', id: first.nodeId, start: 0, end: 20 }
  })
  await questions.settledResearch(second.nodeId)
  const validation = stage.mock.calls.at(-1)![0].validate
  expect(validation({ answer }).ok).toBe(false)
  expect(
    validation({ answer: 'A fresh explanation of the selected mechanism.' }).ok
  ).toBe(true)
})
