import { describe, expect, it } from 'vitest'
import type { NotebookBuildV1 } from 'markdown-composition'
import { nextWireframeAttempt, storedArticleOf, wireframeFailureText } from './wireframe-attempt'

// R01 of the project-flow rereview: a wireframe is made again from the
// article as it was stored, read from the one route that serves a source
// revision — { revision } — through the one shape the server reads it with.
const REVISION = {
  id: 'src-2516cede3c23012c',
  kind: 'url',
  url: 'https://example.com/boltdb',
  title: 'How BoltDB Works',
  site: 'example.com',
  content: { title: 'How BoltDB Works', site: 'example.com', text: 'BoltDB keeps a whole database in one file.', words: 3464, palette: { accent: '#635bff' }, warnings: [] },
  brandContent: { palette: { accent: '#000000' } },
}

const build: NotebookBuildV1 = {
  kind: 'wireframe',
  via: 'harness',
  runId: 'run-1',
  by: 'Kimi',
  harness: 'kimi',
  attempt: 'attempt-1',
  attempts: 1,
  startedAt: '2026-09-26T12:00:00.000Z',
  sourceRevision: 'src-2516cede3c23012c',
  narrativeRevision: 'narrative-1',
  wording: 'draft',
  targetSeconds: 90,
  brand: { palette: { accent: '#635bff' }, fonts: null, mode: 'dark', site: 'example.com' },
  failure: { message: 'The story run failed: weekly usage limit reached', at: '2026-09-26T12:03:00.000Z', recovery: ['Retry after restoring Kimi credits', 'Switch harness or model'] },
}

describe('a wireframe made again', () => {
  it('reads the article from a stored revision: its words, never its brand evidence', () => {
    expect(storedArticleOf(REVISION)).toEqual({ title: 'How BoltDB Works', site: 'example.com', text: 'BoltDB keeps a whole database in one file.', words: 3464 })
    expect(storedArticleOf({ ...REVISION, content: { ...REVISION.content, words: undefined } })?.words).toBe(8)
  })

  it('a revision without its text is no article', () => {
    expect(storedArticleOf(null)).toBeNull()
    expect(storedArticleOf({ source: REVISION.content })).toBeNull()
    expect(storedArticleOf({ ...REVISION, content: { ...REVISION.content, text: '   ' } })).toBeNull()
  })

  it('is an attempt of its own on the same article, made by whoever makes it now', () => {
    const next = nextWireframeAttempt(build, { via: 'harness', runId: 'run-2', by: 'Claude Code · Claude Opus 5.5', harness: 'claude-code', model: 'claude-opus-5-5' }, { attempt: 'attempt-2', now: '2026-09-26T12:10:00.000Z' })
    expect(next).toEqual({ ...build, failure: undefined, runId: 'run-2', by: 'Claude Code · Claude Opus 5.5', harness: 'claude-code', model: 'claude-opus-5-5', attempt: 'attempt-2', attempts: 2, startedAt: '2026-09-26T12:10:00.000Z' })
    expect('failure' in next).toBe(false)
    // The direct model takes over: no run, harness or model is carried over.
    const direct = nextWireframeAttempt(next, { via: 'api', by: 'the direct model' }, { attempt: 'attempt-3', now: '2026-09-26T12:20:00.000Z' })
    expect(direct).toMatchObject({ via: 'api', by: 'the direct model', attempt: 'attempt-3', attempts: 3, sourceRevision: 'src-2516cede3c23012c', narrativeRevision: 'narrative-1', wording: 'draft', targetSeconds: 90 })
    expect(['runId', 'harness', 'model'].filter(key => key in direct)).toEqual([])
  })

  it('says why it could not be made, and what the creator can do', () => {
    expect(wireframeFailureText(build.failure!)).toBe('The wireframe could not be made: The story run failed: weekly usage limit reached. Retry after restoring Kimi credits, or switch harness or model.')
    expect(wireframeFailureText({ message: 'It was stopped', at: '' })).toBe('The wireframe could not be made: It was stopped.')
  })
})
