// Notes keep piling into a notebook after its wireframes are drawn: the
// wireframes are its content map. The agent sorts each note against the map's
// pages: an idea no page holds becomes a new page, one that extends a page is
// queued as a change to it, and one a page already says is only recorded.
import { randomUUID } from 'node:crypto'
import type { Snapshot } from '../shared/api'
import type { MapNote, NoteResult } from '../shared/content-map'
import type { Slide, SlideChange } from '../shared/model'
import { addEvent } from './activity'
import { runValidatedJsonStage } from './creative/stage'
import { detectedHarness } from './notebook-intake'
import { readRow, writeRow } from './persistence'
import { fingerprintOf } from './planning/fingerprint'
import { changeProject, loadProject } from './projects'
import { Refusal } from './refusal'
import { reconcileVideo } from './scene-model'
import { scheduleChanges, withDeck } from './slide-changes'
import { syncEvidence } from './map-copy'
import { loadSeries } from './series'

const NOTE_LIMIT = 8000
const MOST_IDEAS = 8
const origin = () =>
  process.env.MINIMAL_STUDIO_HARNESS_ORIGIN ||
  `http://127.0.0.1:${process.env.MINIMAL_STUDIO_PORT || 4320}`
const words = (value: unknown, limit: number) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit)

export type SortedIdea = {
  kind: NoteResult['kind']
  line: string
  page?: string
  title?: string
  idea?: string
  after?: string | null
  topic?: string
}

/** The agent's sorting, checked against the pages the map has now. */
export const validateSort = (
  raw: unknown,
  pages: string[],
  topics: string[] = []
) => {
  const value = (raw ?? {}) as { items?: unknown }
  const problems: string[] = []
  const items: SortedIdea[] = []
  const list = Array.isArray(value.items) ? value.items : []
  if (!list.length) problems.push('Sort at least one idea of the note')
  if (list.length > MOST_IDEAS)
    problems.push(`Sort at most ${MOST_IDEAS} ideas; merge the small ones`)
  for (const entry of list.slice(0, MOST_IDEAS)) {
    const item = (entry ?? {}) as Record<string, unknown>
    const kind = String(item.kind)
    const line = words(item.line, 300)
    if (!['new', 'adds', 'covered'].includes(kind)) {
      problems.push('Give each idea a kind: new, adds or covered')
      continue
    }
    if (!line) problems.push('Say in `line` what the note says')
    if (kind === 'new') {
      const title = words(item.title, 80)
      const after = item.after == null ? null : String(item.after)
      if (!title) problems.push('Give each new page a short title')
      if (after && !pages.includes(after))
        problems.push(`${after} is not a page of the map`)
      const topic = words(item.topic, 60)
      items.push({
        kind: 'new',
        line,
        title,
        idea: words(item.idea, 400),
        after,
        ...(topic && topics.includes(topic) ? { topic } : {})
      })
      continue
    }
    const page = String(item.page ?? '')
    if (!pages.includes(page)) {
      problems.push(
        `Name the page it ${kind === 'adds' ? 'adds to' : 'is covered by'} by its id`
      )
      continue
    }
    items.push({ kind: kind as 'adds' | 'covered', line, page })
  }
  return { ok: !problems.length, problems, warnings: [], value: { items } }
}

/** The note in the notebook's source, under a heading with its date. */
const noted = (text: string, note: MapNote) =>
  `${text.trimEnd()}\n\n## Note, ${new Date(note.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}\n\n${note.text}`

/** Adds a note to a drawn notebook and sorts it into its pages, in the background. */
export const addNote = async (id: string, raw: unknown) => {
  const text = String((raw as { text?: unknown })?.text ?? '').trim()
  if (!text) throw new Refusal('Write the note first')
  if (text.length > NOTE_LIMIT)
    throw new Refusal(`Keep a note under ${NOTE_LIMIT} characters`)
  const before = await loadProject(id)
  if (!before) throw new Refusal('Notebook not found')
  if (before.status !== 'ready' || !before.project.slides.some((s) => s.svg))
    throw new Refusal('Add notes once the wireframes are drawn')
  if (!(await readRow('outlines', id)))
    throw new Refusal('This notebook has no wireframes to sort into')
  const note: MapNote = {
    id: randomUUID(),
    at: new Date().toISOString(),
    text,
    state: 'sorting'
  }
  const snapshot = await changeProject(id, async (current) => {
    // The note is evidence from now on: a page drawn from it quotes it.
    // Inside the notebook's queue, so two quick notes both stay.
    const retained = await readRow<{ source: { text: string } }>('outlines', id)
    if (retained) {
      retained.source.text = noted(retained.source.text, note)
      await writeRow('outlines', id, retained)
    }
    const read = await readRow<{ text: string }>('sources', id)
    if (read)
      await writeRow('sources', id, { ...read, text: noted(read.text, note) })
    current.project.notes = [...(current.project.notes || []), note]
    current.project.source = noted(current.project.source, note)
    addEvent(current, 'slide', 'Sorting your note into the map')
  })
  // The map's episodes quote the same evidence.
  const series = snapshot.project.mapSeries
    ? await loadSeries(snapshot.project.mapSeries)
    : null
  for (const episode of series?.episodes || [])
    await syncEvidence(id, episode.notebookId)
  const job = sortNote(id, note.id).finally(() => {
    if (sorting.get(note.id) === job) sorting.delete(note.id)
  })
  sorting.set(note.id, job)
  return snapshot
}

const sorting = new Map<string, Promise<void>>()
/** Resolves when every note being sorted is placed (tests and checks). */
export const settledNotes = async () => {
  while (sorting.size) await Promise.all([...sorting.values()])
}

/** Sorts a note again that could not be sorted; its text is in the source already. */
export const retryNote = async (id: string, noteId: string) => {
  const snapshot = await changeProject(id, (current) => {
    const note = current.project.notes?.find((item) => item.id === noteId)
    if (!note || note.state !== 'failed')
      throw new Refusal('Choose a note that could not be sorted')
    note.state = 'sorting'
    delete note.error
  })
  const job = sortNote(id, noteId).finally(() => {
    if (sorting.get(noteId) === job) sorting.delete(noteId)
  })
  sorting.set(noteId, job)
  return snapshot
}

const pagesOf = (snapshot: Snapshot) =>
  snapshot.project.slides.map((slide, index) => ({
    id: slide.id,
    number: index + 1,
    title: slide.title,
    idea: slide.idea || '',
    script: words(slide.narration, 240),
    ...(slide.topic ? { topic: slide.topic } : {})
  }))

const sortNote = async (id: string, noteId: string) => {
  try {
    const snapshot = await loadProject(id)
    const note = snapshot?.project.notes?.find((item) => item.id === noteId)
    if (!snapshot || !note) return
    const pages = pagesOf(snapshot)
    const topics = snapshot.project.topics || []
    const sorted = await runValidatedJsonStage({
      projectId: id,
      inputKey: fingerprintOf({ note: note.text, pages, topics }),
      checkpoint: 'map-note',
      operation: 'revise-story',
      stage: 'story',
      route: 'Sort Note',
      stageContext: { note: note.text },
      file: 'story/note.json',
      tool: 'story_submit_note',
      packet: {
        'packet/NOTE.md': note.text,
        'packet/PAGES.json': JSON.stringify(pages, null, 1),
        'packet/TOPICS.json': JSON.stringify(topics)
      },
      selection: snapshot.project.harness ?? (await detectedHarness()),
      origin: origin(),
      validate: (raw) =>
        validateSort(
          raw,
          pages.map((page) => page.id),
          topics
        )
    })
    await placeNote(id, noteId, sorted.items)
  } catch (error) {
    await changeProject(id, (current) => {
      const note = current.project.notes?.find((item) => item.id === noteId)
      if (!note) return
      note.state = 'failed'
      note.error =
        error instanceof Error && error.message
          ? error.message
          : 'The agent could not sort this note'
      addEvent(current, 'slide', 'Could not sort your note', {
        activity: 'failed'
      })
    }).catch(() => {})
  }
}

/** New pages go in after the page they belong with; changes join the queue. */
export const placeNote = async (
  id: string,
  noteId: string,
  items: SortedIdea[]
) => {
  const changed = await withDeck(id, () => place(id, noteId, items))
  scheduleChanges(id)
  return changed
}

const place = (id: string, noteId: string, items: SortedIdea[]) =>
  changeProject(id, (current) => {
    const note = current.project.notes?.find((item) => item.id === noteId)
    if (!note) return
    const slides = current.project.slides
    const changes: SlideChange[] = []
    const results: NoteResult[] = []
    const lastAfter = new Map<string, string>()
    const queue = (slideId: string, instruction: string) =>
      changes.push({
        id: randomUUID(),
        slideId,
        instruction,
        state: 'queued',
        at: new Date().toISOString()
      })
    for (const item of items) {
      if (item.kind === 'new') {
        const slide: Slide = {
          id: randomUUID(),
          title: item.title || 'A new page',
          svg: null,
          idea: item.idea || item.line,
          fromNote: noteId,
          ...(item.topic ? { topic: item.topic } : {})
        }
        // Two new pages after the same page keep the note's order.
        const anchor = item.after
          ? lastAfter.get(item.after) || item.after
          : null
        const at = anchor ? slides.findIndex((s) => s.id === anchor) : -1
        if (at >= 0) slides.splice(at + 1, 0, slide)
        else slides.push(slide)
        if (item.after) lastAfter.set(item.after, slide.id)
        queue(
          slide.id,
          `A new page from the creator's note: ${item.line}${item.idea && item.idea !== item.line ? ` (${item.idea})` : ''}`
        )
        results.push({
          kind: 'new',
          slideId: slide.id,
          title: slide.title,
          line: item.line
        })
        continue
      }
      const slide = slides.find((s) => s.id === item.page)
      if (!slide) continue
      if (item.kind === 'adds')
        queue(
          slide.id,
          `Add what the creator's note says to this page: ${item.line}`
        )
      results.push({
        kind: item.kind,
        slideId: slide.id,
        title: slide.title,
        line: item.line
      })
    }
    note.state = 'sorted'
    note.results = results
    current.changes = [...(current.changes || []), ...changes]
    // New pages are not new scenes: the map need not become a video.
    reconcileVideo(current.project, current, new Set())
    const count = (kind: NoteResult['kind']) =>
      results.filter((result) => result.kind === kind).length
    addEvent(
      current,
      'slide',
      `Your note: ${[
        count('new') &&
          `${count('new')} new page${count('new') === 1 ? '' : 's'}`,
        count('adds') && `${count('adds')} added to`,
        count('covered') && `${count('covered')} already covered`
      ]
        .filter(Boolean)
        .join(', ')}`,
      { activity: 'complete' }
    )
  })
