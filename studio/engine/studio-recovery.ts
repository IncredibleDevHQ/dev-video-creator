// After a restart, the background work the engine was doing for repos,
// demos, teasers, posts, uploads and arcs is gone with the process. Each is
// marked as stopped, with why, so the page offers to try again instead of
// saying "asking…" forever.
import type { Snapshot } from '../shared/api'
import type { Series } from '../shared/series'
import { listRows, readRow, writeRow } from './persistence'
import { changeProject, loadProject } from './projects'

export const RESTARTED = 'The studio restarted before this finished. Try again.'

/** Marks a notebook's interrupted work as stopped; says whether any was. */
export const settleNotebook = (
  snapshot: Snapshot,
  at = new Date().toISOString()
) => {
  let changed = false
  for (const [key, ask] of Object.entries(snapshot.repoAsks || {}))
    if (ask.state === 'asking') {
      snapshot.repoAsks![key] = {
        ...ask,
        state: 'failed',
        error: RESTARTED,
        at
      }
      changed = true
    }
  for (const slide of snapshot.project.slides)
    if (
      slide.capture &&
      ['planning', 'capturing'].includes(slide.capture.state)
    ) {
      slide.capture = {
        ...slide.capture,
        state: 'failed',
        error: RESTARTED,
        at
      }
      changed = true
    }
  const release = snapshot.project.release
  for (const teaser of release?.teasers || [])
    if (teaser.state === 'cutting') {
      teaser.state = 'failed'
      teaser.error = RESTARTED
      changed = true
    }
  for (const item of release?.campaign || [])
    if (item.state === 'posting') {
      // It may have gone out before the restart: as a post with no answer,
      // the creator checks the feed, and posting again asks first.
      item.state = 'unknown'
      item.note =
        'The studio restarted while this was being posted: it may have gone out. Check your feed before posting it again.'
      changed = true
    }
  if (release?.drafting?.state === 'drafting') {
    release.drafting = { state: 'failed', error: RESTARTED, at }
    changed = true
  }
  // The content map's background work: sorting notes, picking an episode's
  // pages, writing its segues, grouping the map.
  for (const note of snapshot.project.notes || [])
    if (note.state === 'sorting') {
      note.state = 'failed'
      note.error = RESTARTED
      changed = true
    }
  const { picking, segues, grouping } = snapshot.project
  if (picking?.state === 'picking') {
    snapshot.project.picking = { ...picking, state: 'failed', error: RESTARTED }
    changed = true
  }
  if (segues?.state === 'writing') {
    snapshot.project.segues = { state: 'failed', error: RESTARTED }
    changed = true
  }
  if (grouping?.state === 'grouping') {
    snapshot.project.grouping = { state: 'failed', error: RESTARTED }
    changed = true
  }
  if (release?.youtube?.state === 'uploading') {
    // A resumable upload may have finished on YouTube: say where to look.
    release.youtube = {
      ...release.youtube,
      state: 'failed',
      error: `${RESTARTED} Check YouTube Studio first: the upload may have gone through.`,
      at
    }
    changed = true
  }
  return changed
}

export const settleSeries = (series: Series, at = new Date().toISOString()) => {
  if (series.planning?.state !== 'planning') return false
  series.planning = { state: 'failed', error: RESTARTED, at }
  return true
}

/** At startup: every notebook and series with work that was cut off. */
export const settleInterruptedWork = async () => {
  for (const id of await listRows('projects')) {
    const saved = await loadProject(id)
    if (saved && settleNotebook(structuredClone(saved)))
      await changeProject(id, (current) => {
        settleNotebook(current)
      })
  }
  for (const id of await listRows('series')) {
    const series = await readRow<Series>('series', id)
    if (series && settleSeries(series)) await writeRow('series', id, series)
  }
}
