import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterAll, expect, it, vi } from 'vitest'
const { generate } = vi.hoisted(() => ({ generate: vi.fn() }))
vi.mock('./model-gateway', () => ({
  modelFetch: vi.fn(() => {
    throw new Error('Direct API must not replace the creative pipeline')
  })
}))
vi.mock('./creative/brief', () => ({
  prepareCreativeBrief: vi.fn(async () => ({
    entities: [],
    units: [],
    coverage: []
  }))
}))
vi.mock('./creative/story', () => ({ prepareCreativeStory: generate }))
vi.mock('./creative/pages', () => ({
  prepareCreativePages: vi.fn(async (input: any) =>
    input.outline.scenes.map(
      () =>
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><text x="30" y="30">Synthetic recovery fixture</text></svg>'
    )
  )
}))
const root = await mkdtemp(join(tmpdir(), 'studio-source-recovery-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const { createProject, loadProject, replaceBlockedSource } =
  await import('./projects')
const { readRow } = await import('./persistence')
afterAll(async () => {
  vi.unstubAllGlobals()
  await rm(root, { recursive: true, force: true })
})
it('reports a blocked source accurately, then continues the same notebook from pasted text', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response('', { status: 403 }))
  )
  const created = await createProject(
    'https://openai.com/index/introducing-canvas/'
  )
  await vi.waitFor(async () =>
    expect((await loadProject(created.project.id))?.status).toBe('failed')
  )
  const blocked = (await loadProject(created.project.id))!
  expect(blocked.sourceFailure).toBe('blocked')
  expect(blocked.error).toContain('Paste the article text')
  expect(blocked.error).not.toContain('AI settings')
  expect(generate).not.toHaveBeenCalled()
  generate.mockResolvedValue({
    title: 'Canvas',
    scenes: [
      {
        title: 'Canvas',
        kind: 'title',
        seconds: 12,
        narration: 'A new workspace.',
        parts: [],
        relations: [],
        source: []
      },
      {
        title: 'A shared workspace',
        kind: 'close',
        seconds: 10,
        narration: 'Work together.',
        parts: [],
        relations: [],
        source: []
      }
    ]
  })
  const article =
    'Introducing canvas\nCanvas provides a shared workspace for writing and coding. Select a section and work on it together.'
  const resumed = await replaceBlockedSource(created.project.id, article)
  expect(resumed.project.id).toBe(created.project.id)
  await vi.waitFor(async () =>
    expect((await loadProject(created.project.id))?.status).toBe('ready')
  )
  const saved = (await loadProject(created.project.id))!
  expect(saved.project.source).toBe(article)
  expect(saved.project.sourceUrl).toBe(
    'https://openai.com/index/introducing-canvas/'
  )
  expect(saved.sourceFailure).toBeUndefined()
  const retained = await readRow<{
    text: string
    url: string
    warnings: string[]
  }>('sources', created.project.id)
  expect(retained?.text).toBe(article)
  expect(retained?.url).toBe(saved.project.sourceUrl)
  expect(retained?.warnings.join(' ')).toContain('supplied by the creator')
  await expect(
    replaceBlockedSource(created.project.id, article)
  ).rejects.toThrow('does not need')
})
