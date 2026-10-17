import type { Snapshot } from '../shared/api'
import type { MapNote } from '../shared/content-map'
import { button, escape } from './ui'

// The Notebook keeps taking notes once its wireframes are made (review 8
// F02: it became a read-only page, and later thoughts had to find the map's
// Notes). A note here is the map's own: kept at once, then sorted into the
// content map, and the latest say where they landed.

const NOTE_LIMIT = 8000

const landed = (note: MapNote) => {
  if (note.state === 'waiting')
    return 'Saved · sorted into the map once the wireframes are drawn'
  if (note.state === 'sorting') return 'Sorting into the map…'
  if (note.state === 'failed') return note.error || 'Could not sort this note'
  const said = (note.results || []).map((result) =>
    result.kind === 'new'
      ? `New card “${result.title}”`
      : result.kind === 'adds'
        ? `Added to “${result.title}”`
        : `Already covered by “${result.title}”`
  )
  const more = said.length > 2 ? ` · ${said.length - 2} more` : ''
  return said.length ? `${said.slice(0, 2).join(' · ')}${more}` : 'Sorted'
}

/** The Notebook's note field, where notes go, and the latest notes. */
export const notebookNotes = (snapshot: Snapshot) => {
  const { project } = snapshot
  // An episode's notes go to the series' map, which shows them.
  const recent = project.copyOfMap ? [] : (project.notes || []).slice(-3)
  const list = recent.length
    ? `<ul class="notebook-note-list">${recent
        .reverse()
        .map(
          (note) =>
            `<li class="is-${note.state}"><p>${escape(note.text.length > 140 ? `${note.text.slice(0, 139)}…` : note.text)}</p><small>${escape(landed(note))}</small></li>`
        )
        .join('')}</ul>`
    : ''
  return `<section class="notebook-notes" aria-label="Notes">
<form id="notebook-note" class="notebook-note-form"><label class="sr" for="notebook-note-text">Add a note</label><textarea id="notebook-note-text" name="note" rows="2" maxlength="${NOTE_LIMIT}" placeholder="Add a note: something you learned, a link, a half-thought…"></textarea><button type="submit" class="primary">Add note</button></form>
<p class="notebook-notes-where">Notes go to the content map: each becomes a new card, adds to one, or is already covered. ${button('Open the map', 'open-map')}</p>
${list}</section>`
}
