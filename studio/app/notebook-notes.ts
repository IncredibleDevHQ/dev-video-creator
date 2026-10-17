import type { Snapshot } from '../shared/api'
import { noteList, notesOf } from './note-landing'
import { button, escape } from './ui'

// The Notebook keeps taking notes once its wireframes are made (review 8
// F02: it became a read-only page, and later thoughts had to find the map's
// Notes). A note here is the map's own: kept at once, then sorted into the
// content map, and the latest say where they landed: the card, and the
// episodes that hold it; an episode lists the notes written in it.

const NOTE_LIMIT = 8000

/** The Notebook's note field, where notes go, and the latest notes. */
export const notebookNotes = (snapshot: Snapshot) => {
  const { project } = snapshot
  return `<section class="notebook-notes" aria-label="Notes">
<form id="notebook-note" class="notebook-note-form"><label class="sr" for="notebook-note-text">Add a note</label><textarea id="notebook-note-text" name="note" rows="2" maxlength="${NOTE_LIMIT}" placeholder="Add a note: something you learned, a link, a half-thought…"></textarea><button type="submit" class="primary">Add note</button></form>
<p class="notebook-notes-where">Notes go to the content map: each becomes a new card, adds to one, or is already covered. ${button('Open the map', 'open-map')}</p>
${noteList(project.id, notesOf(snapshot))}</section>`
}

/** The note any stage opens from the header's More (review 8 F02), with
 * where the latest notes written here went. */
export const noteDialog = (snapshot: Snapshot) => `<h2>Add a note</h2>
<p class="sb-meta">It goes to the content map: a new card, an addition to one, or already covered.</p>
<form id="note-dialog" class="sb-change"><label class="sr" for="note-dialog-text">Your note</label><textarea id="note-dialog-text" name="note" rows="4" maxlength="${NOTE_LIMIT}" placeholder="Something you learned, a link, a half-thought…"></textarea>
<div class="dialog-actions">${button('Cancel', 'close')}<button type="submit" class="primary">Add note</button></div></form>
${noteList(snapshot.project.id, notesOf(snapshot))}`

/** Notes kept while no wireframes are drawn, in the notebook's own editor
 * when a first drawing stopped (review 8 F01: they could not be seen). */
export const waitingNotes = (snapshot: Snapshot) => {
  const waiting = (snapshot.project.notes || []).filter(
    (note) => note.state === 'waiting'
  )
  if (!waiting.length) return ''
  return `<section class="notebook-notes" aria-label="Notes waiting"><p class="notebook-notes-where">${waiting.length === 1 ? 'A note waits' : `${waiting.length} notes wait`}: each is sorted into the map once the wireframes are drawn.</p><ul class="notebook-note-list">${waiting
    .map(
      (note) =>
        `<li class="is-waiting"><p>${escape(note.text.length > 140 ? `${note.text.slice(0, 139)}…` : note.text)}</p></li>`
    )
    .join('')}</ul></section>`
}
