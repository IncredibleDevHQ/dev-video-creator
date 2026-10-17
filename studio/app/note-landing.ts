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

const listed = (numbers: number[]) =>
  numbers.length === 1
    ? `Episode ${numbers[0]}`
    : `Episodes ${numbers.slice(0, -1).join(', ')} and ${numbers.at(-1)}`

/** One line: where the note went, the card and its episodes. */
export const noteLine = (note: MapNote) => {
  if (note.state === 'waiting')
    return 'Saved · sorted into the map once the wireframes are drawn'
  if (note.state === 'sorting') return 'Sorting into the map…'
  if (note.state === 'failed') return note.error || 'Could not sort this note'
  const said = (note.results || []).map((result) => {
    const card = `“${result.title}”`
    // Episodes, when read: a new card no episode holds yet says so.
    const where = !result.episodes
      ? ''
      : result.episodes.length
        ? ` in ${listed(result.episodes)}`
        : result.kind === 'new'
          ? ', no episode yet'
          : ''
    return result.kind === 'new'
      ? `New card ${card}${where}`
      : result.kind === 'adds'
        ? `Added to ${card}${where}`
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
  const episodes = new Map(
    (last || []).flatMap((note) =>
      (note.results || []).map((r) => [r.slideId, r.episodes] as const)
    )
  )
  return (project.notes || []).slice(-3).map((note) => ({
    ...note,
    ...(note.results
      ? {
          results: note.results.map((result) => ({
            ...result,
            episodes: episodes.get(result.slideId)
          }))
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
  note.state === 'waiting' || note.state === 'sorting'

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
  const mine = notes.find((note) => note.id === added)
  if (mine && !pending(mine)) notice(`Your note: ${noteLine(mine)}`, true)
  // Read again while a note is on its way, for ten minutes at most.
  if (notes.some(pending) && tries < 200)
    following.set(
      notebook,
      setTimeout(
        () =>
          void followNotes(
            app,
            notebook,
            mine && pending(mine) ? added : undefined,
            tries + 1
          ),
        3000
      )
    )
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
