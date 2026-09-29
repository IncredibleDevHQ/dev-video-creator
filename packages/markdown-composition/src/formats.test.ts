import { describe, expect, it } from 'vitest'
import { notebookSummaryOf } from './formats'
import type { ProjectDocumentV1 } from './types'

// A notebook of one kind, with its pages and what it carries.
const notebook = (kind: string, content: unknown[], extra: Record<string, unknown> = {}): ProjectDocumentV1 =>
  ({ version: 1, id: kind, title: kind, container: { id: 'c', kind }, notebook: { type: 'doc', content }, blocks: {}, presenterTracks: {}, ...extra }) as unknown as ProjectDocumentV1
const page = (id: string, attrs: Record<string, unknown> = {}) => ({ type: 'slide', attrs: { id, ...attrs } })

// F04 of the component review: where each stage stands, in a word or two to
// show beside its name, with the full words kept as its detail.
describe("a notebook's summary", () => {
  it('says a text is ready, and counts its blocks in full', () => {
    const summary = notebookSummaryOf(notebook('text', [{ type: 'paragraph', content: [{ type: 'text', text: 'Words.' }] }]))
    expect(summary).toMatchObject({ state: 'ready', detail: '1 block', short: 'ready' })
    expect(notebookSummaryOf(notebook('text', []))).toMatchObject({ state: 'empty', short: 'empty' })
  })

  it('counts a wireframe’s pages, and says when it is being made or failed', () => {
    expect(notebookSummaryOf(notebook('wireframe', [page('a'), page('b')]))).toMatchObject({ state: 'ready', detail: '2 pages', short: '2 pages' })
    expect(notebookSummaryOf(notebook('wireframe', [], { build: { startedAt: '' } }))).toMatchObject({ state: 'building', short: 'being made' })
    expect(notebookSummaryOf(notebook('wireframe', [], { build: { startedAt: '', failure: 'no' } }))).toMatchObject({ detail: 'could not be made', short: 'failed' })
  })

  it('shows how much of a presentation is designed while it is designed', () => {
    const designing = notebookSummaryOf(notebook('presentation', [page('a', { pageOrigin: { kind: 'designed' } }), page('b', { pageOrigin: { kind: 'schematic', designing: true } }), page('c', { pageOrigin: { kind: 'schematic', designing: true } })]))
    expect(designing).toMatchObject({ state: 'building', detail: '1 of 3 designed', short: '1/3 designed' })
    expect(notebookSummaryOf(notebook('presentation', [page('a')]))).toMatchObject({ state: 'ready', short: '1 slide' })
  })

  it('shows how much of a video is produced', () => {
    const video = notebookSummaryOf(notebook('video', [page('a'), page('b')], { producedScenes: { a: {} } }))
    expect(video).toMatchObject({ detail: '1 of 2 scenes produced', short: '1/2 produced' })
    expect(notebookSummaryOf(notebook('video', [page('a')]))).toMatchObject({ short: '1 scene' })
    expect(notebookSummaryOf(notebook('video', []))).toMatchObject({ state: 'empty', short: 'no scenes' })
  })
})
