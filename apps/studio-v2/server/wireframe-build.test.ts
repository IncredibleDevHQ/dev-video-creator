import { describe, expect, it } from 'vitest'
import type { NotebookBuildV1, ProjectDocumentV1 } from 'markdown-composition'
import { buildWireframe, type WireframeDeps, type WireframeRun } from './wireframe-build'

// The four-notebook model: the import opens on the project's text at once,
// and its wireframe is made in the background from the story run's outline.
const OUTLINE = {
  title: 'How BoltDB works',
  targetSeconds: 24,
  glossary: [],
  scenes: [1, 2].map(index => ({
    title: `Scene ${index}`,
    idea: `The pages of BoltDB, part ${index}.`,
    kind: 'diagram',
    seconds: 12,
    parts: [{ label: 'Page', kind: 'box', detail: 'a block of the file' }],
    relations: [],
    narration: 'The pages of BoltDB.',
    source: ['BoltDB keeps a whole database in one file, and reads it through memory mapping of its pages.', 'An invented sentence the article never says, long enough to pass as a quote.'],
  })),
}
const brand: NotebookBuildV1['brand'] = { palette: { candidates: [], ground: '#0b1020', text: '#f5f7fb', accent: '#635bff', secondary: '#22c55e', themeColor: '', provenance: 'extracted', from: 'example.com' }, fonts: null, mode: 'dark', site: 'example.com' }
const wireframe = (build: Partial<NotebookBuildV1> = {}) =>
  ({
    version: 1,
    id: 'w1',
    title: 'How BoltDB works',
    notebook: { type: 'doc', content: [{ type: 'paragraph' }] },
    blocks: {},
    presenterTracks: {},
    container: { id: 'p1', kind: 'wireframe', from: 't1' },
    build: { kind: 'wireframe', via: 'harness', runId: 'run-1', by: 'Kimi', startedAt: '2026-09-26T12:00:00.000Z', wording: 'draft', sourceRevision: 'src-1', brand, ...build },
  }) as unknown as ProjectDocumentV1

const harness = (notebook: ProjectDocumentV1, run: WireframeRun | null, outline: unknown = OUTLINE) => {
  let stored = notebook
  const saves: ProjectDocumentV1[] = []
  let ids = 0
  const deps: WireframeDeps = {
    load: async () => structuredClone(stored),
    save: async (next, expected) => {
      if (JSON.stringify(expected) !== JSON.stringify(stored)) throw Object.assign(new Error('changed'), { statusCode: 409 })
      stored = structuredClone(next)
      saves.push(stored)
    },
    run: async () => run,
    readOutline: async () => outline,
    source: async () => ({ title: 'How BoltDB works', site: 'example.com', text: 'Intro. BoltDB keeps a whole database in one file, and reads it through memory mapping of its pages. More.', words: 20 }),
    outlineViaApi: async () => OUTLINE as never,
    saveModel: async () => ({ id: 'model-1' }),
    newId: () => `page-${(ids += 1)}`,
    now: () => '2026-09-26T12:05:00.000Z',
  }
  return { deps, saves, stored: () => stored }
}

describe('a wireframe made in the background', () => {
  it('waits while the story run outlines the article', async () => {
    const { deps, saves } = harness(wireframe(), { status: 'running', projectDir: '/runs/1' })
    expect((await buildWireframe('w1', deps)).state).toBe('waiting')
    expect(saves).toHaveLength(0)
  })

  it('draws a schematic page for each scene of the outline — its passages verbatim, or not at all — and keeps the outline as its plan', async () => {
    const { deps, stored } = harness(wireframe(), { status: 'done', projectDir: '/runs/1' })
    const result = await buildWireframe('w1', deps)
    expect(result).toMatchObject({ state: 'built', pages: 2 })
    const made = stored()
    expect(made.build).toBeUndefined()
    const pages = made.notebook.content
    expect(pages.map(node => node.type)).toEqual(['scene', 'scene'])
    expect(pages.map(node => node.attrs?.id)).toEqual(['page-1', 'page-2'])
    expect(pages[0].attrs).toMatchObject({ title: 'Scene 1', directorNotes: 'The pages of BoltDB, part 1.', script: 'The pages of BoltDB.', pageOrigin: { kind: 'schematic' }, sourcePassages: ['BoltDB keeps a whole database in one file, and reads it through memory mapping of its pages.'] })
    expect(String(pages[0].attrs?.svg)).toMatch(/^<svg/)
    expect(made.outline?.scenes.map(scene => scene.nodeId)).toEqual(['page-1', 'page-2'])
    expect(made.outline?.scenes[0]).toMatchObject({ narration: 'The pages of BoltDB.', parts: [{ label: 'Page' }] })
    expect(made.outline?.pageBrand).toMatchObject({ mode: 'dark' })
    expect(made.story).toMatchObject({ wordingPolicy: 'draft', modelId: 'model-1' })
  })

  it('says why it could not be made: stopped, failed, or no outline', async () => {
    const stopped = harness(wireframe(), { status: 'cancelled', projectDir: '/runs/1' })
    expect(await buildWireframe('w1', stopped.deps)).toMatchObject({ state: 'failed', reason: 'It was stopped' })
    expect(stopped.stored().build?.failure).toEqual({ message: 'It was stopped', at: '2026-09-26T12:05:00.000Z' })
    // A failed wireframe waits for the creator: it is not tried again by itself.
    expect((await buildWireframe('w1', stopped.deps)).state).toBe('none')
    const failed = harness(wireframe(), { status: 'error', projectDir: '/runs/1', failure: { message: 'quota reached' } })
    expect(await buildWireframe('w1', failed.deps)).toMatchObject({ state: 'failed', reason: 'The story run failed: quota reached' })
    const empty = harness(wireframe(), { status: 'done', projectDir: '/runs/1' }, { title: 'x', scenes: [] })
    expect(await buildWireframe('w1', empty.deps)).toMatchObject({ state: 'failed', reason: 'The outline has no scenes' })
  })

  it('an outline from the direct model is asked for, then drawn when it comes', async () => {
    const { deps, stored } = harness(wireframe({ via: 'api', runId: undefined, by: 'the direct model' }), null)
    expect((await buildWireframe('w1', deps)).state).toBe('waiting')
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(await buildWireframe('w1', deps)).toMatchObject({ state: 'built', pages: 2 })
    expect(stored().build).toBeUndefined()
  })

  it('says what the creator can do when the provider failed: its own recovery, like switching harness', async () => {
    const quota = harness(wireframe(), { status: 'error', projectDir: '/runs/1', failure: { message: 'weekly usage limit reached', recovery: ['Retry after restoring Kimi credits', 'Switch harness or model'] } })
    expect(await buildWireframe('w1', quota.deps)).toMatchObject({ state: 'failed', reason: 'The story run failed: weekly usage limit reached' })
    expect(quota.stored().build?.failure).toEqual({ message: 'The story run failed: weekly usage limit reached', at: '2026-09-26T12:05:00.000Z', recovery: ['Retry after restoring Kimi credits', 'Switch harness or model'] })
  })

  // R07 of the project-flow rereview: the direct model is asked once an
  // attempt. Its outline is kept until the pages made from it are saved, so
  // a save that loses to the creator's edit is made again from it.
  it('an edit made while the direct model\'s outline is saved: the save is made again from the same outline, the model asked once', async () => {
    const { deps, stored } = harness(wireframe({ via: 'api', runId: undefined, by: 'the direct model', attempt: 'attempt-edit' }), null)
    let calls = 0
    deps.outlineViaApi = async () => {
      calls += 1
      return { ...OUTLINE, scenes: OUTLINE.scenes.map(scene => ({ ...scene, title: `${scene.title}, answer ${calls}` })) } as never
    }
    expect((await buildWireframe('w1', deps)).state).toBe('waiting')
    await new Promise(resolve => setTimeout(resolve, 0))
    const load = deps.load
    let edited = false
    deps.load = async id => {
      const notebook = await load(id)
      if (!edited && notebook) {
        edited = true
        await deps.save({ ...notebook, notebook: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A note' }] }] } }, notebook)
      }
      return notebook
    }
    expect((await buildWireframe('w1', deps)).state).toBe('conflict')
    expect(await buildWireframe('w1', deps)).toMatchObject({ state: 'built', pages: 2 })
    expect(calls).toBe(1)
    const made = stored()
    expect(made.notebook.content.map(node => node.type)).toEqual(['paragraph', 'scene', 'scene'])
    expect(made.notebook.content.slice(1).map(node => node.attrs?.title)).toEqual(['Scene 1, answer 1', 'Scene 2, answer 1'])
  })

  it('an attempt made again never takes an older attempt\'s outline', async () => {
    const { deps, stored } = harness(wireframe({ via: 'api', runId: undefined, by: 'the direct model', attempt: 'attempt-old' }), null)
    const answers: Array<(outline: never) => void> = []
    deps.outlineViaApi = () => new Promise(resolve => answers.push(resolve))
    expect((await buildWireframe('w1', deps)).state).toBe('waiting')
    // The creator makes it again before the first answer comes.
    const now = stored()
    await deps.save({ ...now, build: { ...now.build!, attempt: 'attempt-new', attempts: 2 } }, now)
    answers[0]({ ...OUTLINE, title: 'The old attempt' } as never)
    await new Promise(resolve => setTimeout(resolve, 0))
    expect((await buildWireframe('w1', deps)).state).toBe('waiting')
    expect(answers).toHaveLength(2)
    answers[1]({ ...OUTLINE, scenes: OUTLINE.scenes.map(scene => ({ ...scene, title: `${scene.title}, made again` })) } as never)
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(await buildWireframe('w1', deps)).toMatchObject({ state: 'built', pages: 2 })
    expect(stored().notebook.content.map(node => node.attrs?.title)).toEqual(['Scene 1, made again', 'Scene 2, made again'])
  })

  it('an edit made while it was built is kept: it is built on the edit', async () => {
    const { deps, stored } = harness(wireframe(), { status: 'done', projectDir: '/runs/1' })
    const load = deps.load
    let edited = false
    deps.load = async id => {
      const notebook = await load(id)
      if (!edited && notebook) {
        edited = true
        // The creator writes a line just as the pass reads the notebook.
        await deps.save({ ...notebook, notebook: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A note' }] }] } }, notebook)
      }
      return notebook
    }
    expect((await buildWireframe('w1', deps)).state).toBe('conflict')
    expect(await buildWireframe('w1', deps)).toMatchObject({ state: 'built' })
    expect(stored().notebook.content.map(node => node.type)).toEqual(['paragraph', 'scene', 'scene'])
  })
})
