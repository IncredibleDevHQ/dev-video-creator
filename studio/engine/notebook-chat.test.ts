import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterAll, beforeEach, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
const { generate, stage } = vi.hoisted(() => ({
  generate: vi.fn(),
  stage: vi.fn()
}))
vi.mock('./model-gateway', () => ({ modelFetch: generate }))
vi.mock('./creative/stage', async (original) => ({
  ...(await original<typeof import('./creative/stage')>()),
  runValidatedJsonStage: stage
}))
const root = await mkdtemp(join(tmpdir(), 'studio-source-chat-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const { chatNotebook, validateSourceReply } = await import('./notebook-chat')
const { readSourceNarrative } = await import('./source-document')
const { writeRow, listNotebookRows } = await import('./persistence')
const source = readSourceNarrative(
  'Canvas is a workspace for writing and coding. People can select a passage to work on together.'
)
const answer = {
  reply: 'Canvas provides a shared workspace for writing and coding.',
  evidence: ['Canvas is a workspace for writing and coding.']
}
const seed = async (id: string, harness = false) => {
  const snapshot: Snapshot = {
    project: {
      id,
      title: 'Source fixture',
      source: source.text,
      harness: harness
        ? { adapter: 'kimi', model: 'fixture-model' }
        : undefined,
      slides: [],
      video: null
    },
    status: 'ready',
    error: null,
    events: []
  }
  await writeRow('projects', id, snapshot)
  await writeRow('sources', id, source)
}
const request = {
  anchor: { stage: 'notebook' as const },
  instruction: 'What does canvas provide?'
}
beforeEach(() => {
  vi.clearAllMocks()
  generate.mockResolvedValue({
    ok: true,
    json: async () => ({
      output: [
        { content: [{ type: 'output_text', text: JSON.stringify(answer) }] }
      ]
    })
  })
  stage.mockResolvedValue(answer)
})
afterAll(() => rm(root, { recursive: true, force: true }))
it('rejects fabricated source passages and empty answers', () => {
  expect(validateSourceReply(answer, source).ok).toBe(true)
  expect(
    validateSourceReply(
      { ...answer, evidence: ['Canvas cures disease.'] },
      source
    ).ok
  ).toBe(false)
  expect(validateSourceReply({ ...answer, reply: '' }, source).ok).toBe(false)
})
it('keeps source questions and replies in the same notebook stream and object-backed rows', async () => {
  await seed('direct')
  const updated = await chatNotebook('direct', request)
  expect(updated.events.map((event) => event.anchor)).toEqual([
    request.anchor,
    request.anchor
  ])
  expect(updated.events.at(-1)?.message).toBe(answer.reply)
  expect(updated.project.source).toBe(source.text)
  expect(await listNotebookRows('source-chat-replies', 'direct')).toHaveLength(
    1
  )
  expect(await listNotebookRows('source-chat-attempts', 'direct')).toHaveLength(
    1
  )
})
it('uses the notebook harness instead of requesting a direct-provider key', async () => {
  await seed('harness', true)
  await chatNotebook('harness', request)
  expect(generate).not.toHaveBeenCalled()
  expect(stage.mock.calls[0][0]).toMatchObject({
    selection: { adapter: 'kimi', model: 'fixture-model' },
    route: 'Discuss Source',
    tool: 'story_submit_reply'
  })
})
