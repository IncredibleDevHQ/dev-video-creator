// A series on the home page, its page (arc, episodes, threads, next
// episode), the dialog that starts one, and the chip on an episode.
import type { Snapshot, NotebookSummary } from '../shared/api'
import { narrativeById } from '../shared/narratives'
import type { Series, SeriesEpisode, SeriesSummary } from '../shared/series'
import { nextPart } from '../shared/series'
import { notebookState } from './notebook-state'
import { escape } from './ui'

export type SeriesPageData = {
  series: Series
  episodes: Array<
    SeriesEpisode & { title: string; status: string; narrative: string | null }
  >
}

/** One of a series' notebooks: its content map, or an episode. */
const seriesEntry = (
  notebooks: NotebookSummary[],
  id: string,
  label: string,
  map = false
) => {
  const item = notebooks.find((notebook) => notebook.id === id)
  const opens = map
    ? `data-action="open-map-of" data-map="${escape(id)}"`
    : `data-notebook="${escape(id)}"`
  return `<li><button type="button" ${opens}><b>${escape(label)}</b><span>${escape(item?.title || label)}</span><small>${escape(item ? notebookState(item) : 'Unavailable')}</small></button></li>`
}

/** A series with its source and episodes together, and how far it has come. */
const seriesRow = (item: SeriesSummary, notebooks: NotebookSummary[]) => {
  const map = item.map
    ? seriesEntry(notebooks, item.map, 'Content map', true)
    : ''
  const episodes = (item.members || [])
    .map((member) =>
      seriesEntry(notebooks, member.notebookId, `Episode ${member.number}`)
    )
    .join('')
  const count = `${item.episodes} ${item.episodes === 1 ? 'episode' : 'episodes'}${item.planned ? ` of ${item.planned} planned` : ''}`
  return `<article class="series-row"><div class="series-row-head"><button type="button" class="series-row-title" ${item.map ? `data-action="open-map-of" data-map="${escape(item.map)}"` : `data-action="open-series-page" data-series="${escape(item.id)}"`}>${escape(item.title)}</button><small>${count}</small></div>${map || episodes ? `<ol>${map}${episodes}</ol>` : ''}</article>`
}

/** A series asked for from a notebook still being drawn: its notebook, and
 * that it starts once the wireframes are drawn. */
const waitingRow = (item: NotebookSummary, notebooks: NotebookSummary[]) =>
  `<article class="series-row is-waiting"><div class="series-row-head"><button type="button" class="series-row-title" data-action="open-map-of" data-map="${escape(item.id)}">${escape(item.waitingSeries || item.title)}</button><small>Starts once its wireframes are drawn</small></div><ol>${seriesEntry(notebooks, item.id, 'Content map', true)}</ol></article>`

/** The creator's series, under their notebooks, the ones waiting for their
 * wireframes first. */
export const seriesSection = (
  list: SeriesSummary[],
  notebooks: NotebookSummary[] = []
) => {
  const waiting = notebooks.filter(
    (item) => item.waitingSeries && !item.archived
  )
  return list.length || waiting.length
    ? `<section class="saved-notebooks saved-series" aria-labelledby="series-heading"><div class="saved-notebooks-heading"><h2 id="series-heading">Your series</h2></div><div class="series-rows">${waiting.map((item) => waitingRow(item, notebooks)).join('')}${list.map((item) => seriesRow(item, notebooks)).join('')}</div></section>`
    : ''
}

/** The notebooks no series uses yet, nor waits for, newest first: home's
 * loose tiles, and the notes a new series can start from. */
export const looseNotebooks = (
  notebooks: NotebookSummary[],
  series: SeriesSummary[]
) => {
  const grouped = new Set(
    series.flatMap((item) =>
      [
        item.map,
        ...(item.members || []).map((member) => member.notebookId)
      ].filter(Boolean)
    )
  )
  return notebooks.filter(
    (item) => !item.archived && !item.waitingSeries && !grouped.has(item.id)
  )
}

/** Its wireframes drawn, as its map's own Start asks: the series starts
 * now. Being drawn: it starts once they are. */
const drawn = (item: NotebookSummary) =>
  item.status === 'ready' && Boolean(item.preview)
const drawing = (item: NotebookSummary) => item.status === 'building'

/** The creator's notebooks to start from: the one just made is chosen,
 * drawn or still being drawn (review 8). */
const seriesFrom = (notebooks: NotebookSummary[], chosen: string) => {
  if (!notebooks.length) return ''
  const rows = notebooks
    .map((item) => {
      const open = drawn(item) || drawing(item)
      return `<label${open ? '' : ' class="is-waiting"'}><input type="radio" name="from" value="${escape(item.id)}" data-title="${escape(item.title)}"${drawing(item) ? ' data-drawing' : ''}${item.id === chosen ? ' checked' : ''}${open ? '' : ' disabled'}> ${escape(item.title)}${drawn(item) ? '' : ` <small>${escape(notebookState(item))}</small>`}</label>`
    })
    .join('')
  const later = notebooks.some((item) => item.id === chosen && drawing(item))
  return `<fieldset class="series-from"><legend>From your notes</legend><div>${rows}<label><input type="radio" name="from" value=""${chosen ? '' : ' checked'}> Nothing yet</label></div><p class="series-later"${later ? '' : ' hidden'}>The series starts once its wireframes are drawn.</p></fieldset>`
}

/** The notes the start chooses: the newest notebook, drawn or being drawn,
 * else nothing yet. */
const firstChoice = (notebooks: NotebookSummary[]) =>
  notebooks[0] && (drawn(notebooks[0]) || drawing(notebooks[0]))
    ? notebooks[0]
    : undefined

/** The switch at the start: what the series is about, the notes it starts
 * from, how it grows and who presents it, asked once for every episode; a
 * repo only for a series that follows code (review 8: the form asked for
 * structure and a repo first, and each episode for camera and voice). */
export const newSeriesDialog = (notebooks: NotebookSummary[] = []) => {
  const chosen = firstChoice(notebooks)
  return `<h2>Start a series</h2>
<form id="series-form" class="series-form">
<label for="series-about">What it is about</label>
<textarea id="series-about" name="about" required rows="3" placeholder="What you are learning or building, and who it is for"></textarea>
${seriesFrom(notebooks, chosen?.id ?? '')}
<label for="series-title">Title</label>
<input id="series-title" name="title" maxlength="120" autocomplete="off"${chosen ? ` placeholder="${escape(chosen.title)}"` : ' required'}>
<div class="series-choices">
<fieldset class="series-growth"><legend>How it grows</legend>
<label><input type="radio" name="growth" value="arc" checked> The studio plans the episodes <small>From your notes or what it is about; nothing is fixed.</small></label>
<label><input type="radio" name="growth" value="one"> One episode at a time <small>You add each one as you go.</small></label>
</fieldset>
<fieldset class="series-led"><legend>Who presents it</legend>
<label><input type="radio" name="led" value="notes" checked> A generated voice <small>Nothing for you to record.</small></label>
<label><input type="radio" name="led" value="presenter"> You, on camera <small>You record your camera and voice for each episode.</small></label>
</fieldset>
</div>
<details class="series-code"${chosen ? ' hidden' : ''}><summary>From a code repository</summary>
<div class="series-code-fields"><div>
<label for="series-repo">Repo <small>its folder on this computer</small></label>
<input id="series-repo" name="path" placeholder="/Users/you/code/project" autocomplete="off">
</div><div>
<label for="series-branch">Branch <small>the episodes start from it</small></label>
<input id="series-branch" name="branch" placeholder="The repo’s current branch" autocomplete="off">
</div></div>
</details>
<div class="dialog-actions"><button type="button" class="quiet" data-action="close">Cancel</button><button class="primary">Start the series</button></div>
</form>`
}

/** The notes listed again as they stand now, the creator's choice kept
 * while it can still be made: a notebook drawn meanwhile says so in place
 * (review 8: the dialog never changed as the drawing finished). */
export const refreshSeriesFrom = (
  root: ParentNode,
  notebooks: NotebookSummary[]
) => {
  const list = root.querySelector<HTMLElement>('#series-form .series-from')
  if (!list) return
  const was = list.querySelector<HTMLInputElement>(
    'input[name="from"]:checked'
  )?.value
  const still = notebooks.find((item) => item.id === was)
  const chosen =
    was === ''
      ? ''
      : still && (drawn(still) || drawing(still))
        ? still.id
        : (firstChoice(notebooks)?.id ?? '')
  list.outerHTML = seriesFrom(notebooks, chosen)
  syncSeriesForm(root)
}

/** Keeps the start in step with the notes chosen: a notebook names the
 * series unless it is given a title, one still drawn says when the series
 * starts, and a repo is for a series from code. */
export const syncSeriesForm = (root: ParentNode) => {
  const form = root.querySelector<HTMLFormElement>('#series-form')
  if (!form) return
  const from = form.querySelector<HTMLInputElement>(
    'input[name="from"]:checked'
  )
  const named = from?.value ? from.dataset.title || '' : ''
  const title = form.querySelector<HTMLInputElement>('#series-title')
  title?.toggleAttribute('required', !from?.value)
  title?.setAttribute('placeholder', named)
  const later = form.querySelector<HTMLElement>('.series-later')
  if (later) later.hidden = !from?.hasAttribute('data-drawing')
  const code = form.querySelector<HTMLElement>('.series-code')
  if (code) code.hidden = Boolean(from?.value)
}

const arcView = (page: SeriesPageData) => {
  const { series } = page
  if (series.planning?.state === 'planning')
    return '<p class="series-planning" role="status">Planning the arc…</p>'
  const failed =
    series.planning?.state === 'failed'
      ? `<p class="series-failed">${escape(series.planning.error || 'The agent could not plan the arc')}</p>`
      : ''
  if (!series.arc)
    return `${failed}<p class="series-arc-ask"><button type="button" class="quiet" data-action="plan-arc" data-series="${escape(series.id)}">${failed ? 'Try again' : 'Plan the arc'}</button></p>`
  const taken = new Map(page.episodes.map((item) => [item.part, item]))
  return `${failed}<ol class="series-arc">${series.arc.parts
    .map((part, index) => {
      const episode = taken.get(index)
      const template = narrativeById(part.narrative)
      return `<li class="${episode ? 'is-made' : ''}"><b>${escape(part.title)}</b>${template ? ` <small>${escape(template.name)}</small>` : ''}<p>${escape(part.carries)}</p>${
        episode
          ? `<button type="button" class="quiet" data-notebook="${escape(episode.notebookId)}">Open episode ${episode.number}</button>`
          : ''
      }</li>`
    })
    .join(
      ''
    )}</ol><p class="series-range">${series.arc.episodes[0]}–${series.arc.episodes[1]} episodes · <button type="button" class="quiet" data-action="plan-arc" data-series="${escape(series.id)}">Plan again</button></p>`
}

/** The series' page: its arc, its episodes, its threads, the next one. */
export const seriesPageView = (page: SeriesPageData, standalone = false) => {
  const { series } = page
  const next = nextPart(series)
  const repo = series.repos[0]
  return `<h2>${escape(series.title)}</h2>
<p class="series-about">${escape(series.about)}${repo ? ` <small>${escape(repo.name)} · ${escape(repo.branch)}</small>` : ''}</p>
${series.map ? '' : `<h3>Arc</h3>${arcView(page)}`}
<h3>Episodes</h3>${
    page.episodes.length
      ? `<ol class="series-episodes">${page.episodes
          .map(
            (item) =>
              `<li><button type="button" class="button" data-notebook="${escape(item.notebookId)}">Open episode ${item.number}: ${escape(item.title)}</button><small>Template: ${escape(narrativeById(item.narrative ?? undefined)?.name || 'Not selected')}</small></li>`
          )
          .join('')}</ol>`
      : '<p class="series-none">No episode yet.</p>'
  }
${
  // A map's series takes its episodes from the map's pages, on the canvas.
  series.map
    ? `<p class="series-about">Its episodes are copies of the pages of a content map. <button type="button" class="primary" data-action="open-map-of" data-map="${escape(series.map)}">Open the map</button></p>`
    : `<form id="episode-form" class="episode-form" data-series="${escape(series.id)}">
<label for="episode-source">${next ? `Next: ${escape(next.part.title)}` : `Episode ${page.episodes.length + 1}`}</label>
<textarea id="episode-source" name="source" rows="3" placeholder="${repo ? 'Paste its blog or notes, or leave empty to start from what changed on the branch' : 'Paste its blog, notes or a link'}"></textarea>
${next ? `<input type="hidden" name="part" value="${next.index}">` : ''}
<button class="primary">Add the episode</button>
</form>`
}
<form id="threads-form" class="threads-form" data-series="${escape(series.id)}">
<label for="series-threads">Threads <small>carried from one episode to the next, one a line</small></label>
<textarea id="series-threads" name="threads" rows="3">${escape(series.threads.join('\n'))}</textarea>
<button class="primary">Save threads</button>
</form>
${standalone ? '' : '<div class="dialog-actions"><button type="button" class="quiet" data-action="close">Close</button></div>'}`
}

/** On an episode's notebook: which series, which number. */
export const episodeChip = (snapshot: Snapshot) => {
  const episode = snapshot.project.episode
  return episode
    ? `<span aria-hidden="true">·</span><button type="button" class="choice" data-action="open-series" data-series="${escape(episode.series)}">Episode ${episode.number}</button>`
    : ''
}
