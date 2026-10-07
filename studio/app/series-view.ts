// A series on the home page, its page (arc, episodes, threads, next
// episode), the dialog that starts one, and the chip on an episode.
import type { Snapshot } from '../shared/api'
import { narrativeById } from '../shared/narratives'
import type { Series, SeriesEpisode, SeriesSummary } from '../shared/series'
import { nextPart } from '../shared/series'
import { escape } from './ui'

export type SeriesPageData = {
  series: Series
  episodes: Array<
    SeriesEpisode & { title: string; status: string; narrative: string | null }
  >
}

/** The creator's series, under their notebooks. */
export const seriesSection = (list: SeriesSummary[]) =>
  list.length
    ? `<section class="saved-series" aria-labelledby="series-heading">
<div class="saved-notebooks-heading"><h2 id="series-heading">Your series</h2></div>
<div class="series-tiles">${list
        .map(
          (item) =>
            `<button type="button" class="series-tile" data-action="open-series" data-series="${escape(item.id)}"><span class="tile-title">${escape(item.title)}</span><span class="tile-meta">${item.episodes} ${item.episodes === 1 ? 'episode' : 'episodes'}${item.planned ? ` of ${item.planned} planned` : ''}</span></button>`
        )
        .join('')}</div></section>`
    : ''

/** The switch at the start: a series, its subject, and how it grows. */
export const newSeriesDialog = () => `<h2>Start a series</h2>
<form id="series-form" class="series-form">
<label for="series-title">Title</label>
<input id="series-title" name="title" required maxlength="120" autocomplete="off">
<label for="series-about">What it is about</label>
<textarea id="series-about" name="about" required rows="4" placeholder="The work it follows, who it is for, where it is going"></textarea>
<fieldset class="series-growth"><legend>How it grows</legend>
<label><input type="radio" name="growth" value="one" checked> One episode at a time</label>
<label><input type="radio" name="growth" value="arc"> Plan the arc first <small>3–5 episodes, nothing fixed</small></label>
</fieldset>
<label for="series-repo">Repo <small>optional, its folder on this computer</small></label>
<input id="series-repo" name="path" placeholder="/Users/you/code/project" autocomplete="off">
<label for="series-branch">Branch <small>the episodes start from it</small></label>
<input id="series-branch" name="branch" placeholder="The repo’s current branch" autocomplete="off">
<div class="dialog-actions"><button type="button" class="quiet" data-action="close">Cancel</button><button class="primary">Start the series</button></div>
</form>`

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
export const seriesPageView = (page: SeriesPageData) => {
  const { series } = page
  const next = nextPart(series)
  const repo = series.repos[0]
  return `<h2>${escape(series.title)}</h2>
<p class="series-about">${escape(series.about)}${repo ? ` <small>${escape(repo.name)} · ${escape(repo.branch)}</small>` : ''}</p>
<h3>Arc</h3>${arcView(page)}
<h3>Episodes</h3>${
    page.episodes.length
      ? `<ol class="series-episodes">${page.episodes
          .map(
            (item) =>
              `<li><button type="button" class="quiet" data-notebook="${escape(item.notebookId)}">${item.number}. ${escape(item.title)}</button><small>${escape(narrativeById(item.narrative ?? undefined)?.name || 'No template yet')}</small></li>`
          )
          .join('')}</ol>`
      : '<p class="series-none">No episode yet.</p>'
  }
<form id="episode-form" class="episode-form" data-series="${escape(series.id)}">
<label for="episode-source">${next ? `Next: ${escape(next.part.title)}` : `Episode ${page.episodes.length + 1}`}</label>
<textarea id="episode-source" name="source" rows="3" placeholder="${repo ? 'Paste its blog or notes, or leave empty to start from what changed on the branch' : 'Paste its blog, notes or a link'}"></textarea>
${next ? `<input type="hidden" name="part" value="${next.index}">` : ''}
<button class="primary">Add the episode</button>
</form>
<form id="threads-form" class="threads-form" data-series="${escape(series.id)}">
<label for="series-threads">Threads <small>carried from one episode to the next, one a line</small></label>
<textarea id="series-threads" name="threads" rows="3">${escape(series.threads.join('\n'))}</textarea>
<button class="quiet">Keep the threads</button>
</form>
<div class="dialog-actions"><button type="button" class="quiet" data-action="close">Close</button></div>`
}

/** On an episode's notebook: which series, which number. */
export const episodeChip = (snapshot: Snapshot) => {
  const episode = snapshot.project.episode
  return episode
    ? `<span aria-hidden="true">·</span><button type="button" class="choice" data-action="open-series" data-series="${escape(episode.series)}">Episode ${episode.number}</button>`
    : ''
}
