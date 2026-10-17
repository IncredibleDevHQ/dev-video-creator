// Where each note went, said where it was written: the card it made, added
// to or found already saying it, and the episodes that hold that card, one
// line a note (review 8 F02, round 2's audit: an episode's Notebook listed
// none of its notes, the map's named cards but never episodes, and a note
// added from Video said only that it was saved). Read from the map, and read
// again while a note is still on its way.
import type { Snapshot } from '../shared/api'
import type { MapNote } from '../shared/content-map'
import type { AppContext } from './app-context'
import { notice } from './download'
import { mapApi } from './map-api'
import { escape } from './ui'

const read = new Map<string, MapNote[]>()
const readAt = new Map<string, number>()
const following = new Map<string, ReturnType<typeof setTimeout>>()
/** Notes just added in each notebook, each said once it lands: a later
 * read, or another note added, never drops one (F02). */
const awaited = new Map<string, Set<string>>()

const listed = (numbers: number[]) =>
  numbers.length === 1
    ? `Episode ${numbers[0]}`
    : `Episodes ${numbers.slice(0, -1).join(', ')} and ${numbers.at(-1)}`

/** One line: where the note went, the card and its episodes: those whose
 * copy took an addition, and those whose copy waits for an Update. */
export const noteLine = (note: MapNote) => {
  if (note.state === 'waiting')
    return 'Saved · sorted into the map once the wireframes are drawn'
  if (note.state === 'sorting') return 'Sorting into the map…'
  if (note.state === 'failed') return note.error || 'Could not sort this note'
  const said = (note.results || []).map((result) => {
    const card = `“${result.title}”`
    // An addition says it lands only once it has (F02).
    if (result.kind === 'adds' && result.landing === 'adding')
      return `Being added to ${card}`
    if (result.kind === 'adds' && result.landing === 'failed')
      return `Not added to ${card}: ${result.failure || 'the card could not be changed'}`
    // Episodes, when read: a new card no episode holds yet says so.
    const where = !result.episodes
      ? ''
      : result.episodes.length
        ? ` in ${listed(result.episodes)}`
        : result.kind === 'new'
          ? ', no episode yet'
          : ''
    const waits = result.waits?.length
      ? `; waits for your Update in ${result.waits.map((n) => `Ep ${n}`).join(', ')}`
      : ''
    return result.kind === 'new'
      ? `New card ${card}${where}`
      : result.kind === 'adds'
        ? `Added to ${card}${where}${waits}`
        : `Already covered by ${card}`
  })
  const more = said.length > 2 ? ` · ${said.length - 2} more` : ''
  return said.length ? `${said.slice(0, 2).join(' · ')}${more}` : 'Sorted'
}

/**
 * The notes a notebook lists: an episode's, as last read from the map; the
 * map's own from its snapshot, which is current, each card with the
 * episodes last read for it.
 */
export const notesOf = (snapshot: Snapshot) => {
  const { project } = snapshot
  const last = read.get(project.id)
  if (project.copyOfMap) return last || []
  const seen = new Map(
    (last || []).flatMap((note) =>
      (note.results || []).map((r) => [`${note.id} ${r.slideId}`, r] as const)
    )
  )
  // The map's own queue is current: an addition still in it, or failed
  // there, says so before any read.
  const queued = (change?: string) =>
    snapshot.changes?.find((item) => item.id === change)
  return (project.notes || []).slice(-3).map((note) => ({
    ...note,
    ...(note.results
      ? {
          results: note.results.map((result) => {
            const was = seen.get(`${note.id} ${result.slideId}`)
            const change = queued(result.change)
            return {
              ...result,
              episodes: was?.episodes,
              ...(was?.waits ? { waits: was.waits } : {}),
              ...(change?.state === 'failed'
                ? { landing: 'failed' as const, failure: change.message }
                : change
                  ? { landing: 'adding' as const }
                  : was?.landing
                    ? { landing: was.landing, failure: was.failure }
                    : {})
            }
          })
        }
      : {})
  }))
}

/** The latest notes, newest first, each with where it went. */
export const noteList = (notebook: string, notes: MapNote[]) =>
  `<ul class="notebook-note-list" data-note-list="${escape(notebook)}"${notes.length ? '' : ' hidden'}>${[
    ...notes
  ]
    .reverse()
    .map(
      (note) =>
        `<li class="is-${note.state}"><p>${escape(note.text.length > 140 ? `${note.text.slice(0, 139)}…` : note.text)}</p><small>${escape(noteLine(note))}</small></li>`
    )
    .join('')}</ul>`

const pending = (note: MapNote) =>
  note.state === 'waiting' ||
  note.state === 'sorting' ||
  Boolean(note.results?.some((result) => result.landing === 'adding'))

/**
 * Reads where a notebook's notes went and shows it in place, again every
 * few seconds while one is on its way; the note just added (`added`) says
 * where it went once it lands, on whatever stage the creator is.
 */
export const followNotes = async (
  app: AppContext,
  notebook: string,
  added?: string,
  tries = 0
) => {
  clearTimeout(following.get(notebook))
  const mine = awaited.get(notebook) || new Set<string>()
  awaited.set(notebook, mine)
  if (added) mine.add(added)
  readAt.set(notebook, Date.now())
  let notes: MapNote[]
  try {
    notes = await mapApi.notes(notebook)
  } catch {
    return
  }
  if (!Array.isArray(notes)) return
  read.set(notebook, notes)
  if (app.snapshot?.project.id === notebook)
    for (const list of document.querySelectorAll(
      `[data-note-list="${notebook}"]`
    ))
      list.outerHTML = noteList(notebook, notesOf(app.snapshot))
  // Each note just added, said once it lands; one gone is dropped.
  for (const id of [...mine]) {
    const note = notes.find((item) => item.id === id)
    if (note && pending(note)) continue
    mine.delete(id)
    if (note) notice(`Your note: ${noteLine(note)}`, true)
  }
  // Read again while a note is on its way, for ten minutes at most.
  if (notes.some(pending) && tries < 200)
    following.set(
      notebook,
      setTimeout(
        () => void followNotes(app, notebook, undefined, tries + 1),
        3000
      )
    )
  else mine.clear()
}

/** On the Notebook stage: where its notes went, read once in a while. */
export const watchNotes = (app: AppContext) => {
  const snapshot = app.snapshot
  if (!snapshot || snapshot.sourceOnly || snapshot.readOnly) return
  const { project } = snapshot
  if (!project.copyOfMap && !project.notes?.length) return
  if (Date.now() - (readAt.get(project.id) || 0) < 10_000) return
  void followNotes(app, project.id)
}
