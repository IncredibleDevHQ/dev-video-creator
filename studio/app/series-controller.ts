// Starting a series, its page, the arc, and adding the next episode.
import type { NotebookSummary, Snapshot } from '../shared/api'
import { ledBy, type Series, type SeriesSummary } from '../shared/series'
import { api } from './api'
import type { AppContext } from './app-context'
import {
  looseNotebooks,
  newSeriesDialog,
  refreshSeriesFrom,
  seriesPageView,
  type SeriesPageData
} from './series-view'
import { studioApi } from './studio-api'
import { busy, typingIn } from './ui'
import { saveBeforeLeaving } from './notebook-editor'

export const seriesApi = {
  list: () => studioApi.request<SeriesSummary[]>('/series'),
  page: (id: string) => studioApi.request<SeriesPageData>(`/series/${id}`),
  /** A series, or, from a notebook still being drawn, that it waits. */
  create: (body: unknown) =>
    studioApi.request<Series | { waiting: string }>('/series', 'POST', body),
  update: (id: string, body: unknown) =>
    studioApi.request<SeriesPageData>(`/series/${id}`, 'POST', body),
  planArc: (id: string) =>
    studioApi.request<SeriesPageData>(`/series/${id}/arc`, 'POST', {}),
  addEpisode: (id: string, body: unknown) =>
    studioApi.request<{ series: Series; notebook: Snapshot }>(
      `/series/${id}/episodes`,
      'POST',
      body
    )
}

/** Who presents the series a notebook is an episode of, for its Make; a
 * series that cannot be read leaves Make as it always started. */
export const episodeLed = (snapshot: Snapshot) => {
  const id = snapshot.project.episode?.series
  return id
    ? seriesApi.page(id).then(
        (page) => ledBy(page.series),
        () => undefined
      )
    : Promise.resolve(undefined)
}

let watching: ReturnType<typeof setTimeout> | null = null
/** Shows a series' page, and follows it while the arc is planned. */
export const showSeries = async (
  app: AppContext,
  id: string,
  standalone = false
) => {
  const page = await seriesApi.page(id)
  if (standalone || app.seriesPage?.series.id === id) {
    app.dialog.close()
    app.closeStream?.()
    app.closeStream = null
    app.snapshot = null
    app.opening.reset()
    app.seriesPage = page
    history.replaceState(null, '', `/?series=${encodeURIComponent(id)}`)
    app.render()
  } else {
    app.showDialog(seriesPageView(page))
    app.dialog.dataset.series = id
  }
  if (watching) clearTimeout(watching)
  if (page.series.planning?.state === 'planning') watchSeries(app, id)
}

// Follows the arc's planning, never refreshing under the creator's typing.
const watchSeries = (app: AppContext, id: string) => {
  watching = setTimeout(() => {
    watching = null
    if (
      app.seriesPage?.series.id !== id &&
      (!app.dialog.open || app.dialog.dataset.series !== id)
    )
      return
    if (typingIn(app.seriesPage ? app.root : app.dialog)) watchSeries(app, id)
    else void showSeries(app, id).catch(app.error)
  }, 3000)
}

/** The notebooks and series as they are now; as last read when they cannot
 * be read. */
const freshHome = async (app: AppContext) => {
  ;[app.notebooks, app.series] = await Promise.all([
    api.notebooks().catch(() => app.notebooks),
    seriesApi.list().catch(() => app.series)
  ])
  return looseNotebooks(app.notebooks, app.series)
}
const statesOf = (notebooks: NotebookSummary[]) =>
  notebooks.map((item) => `${item.id}:${item.status}`).join()

let following: ReturnType<typeof setTimeout> | null = null
/** While the start is open and a notebook in it is being drawn, its list
 * follows the drawing, in place. */
const followStart = (app: AppContext, shown: NotebookSummary[]) => {
  if (following) clearTimeout(following)
  following = null
  if (!shown.some((item) => item.status === 'building')) return
  following = setTimeout(async () => {
    following = null
    if (!app.dialog.open || !app.dialog.querySelector('#series-form')) return
    const now = await freshHome(app)
    if (!app.dialog.open || !app.dialog.querySelector('#series-form')) return
    if (statesOf(now) !== statesOf(shown)) refreshSeriesFrom(app.dialog, now)
    followStart(app, now)
  }, 3000)
}

export const clickSeries = async (
  app: AppContext,
  target: HTMLButtonElement,
  action: string | undefined
) => {
  if (action === 'new-series') {
    // Opened again, it shows the notebooks as they stand now.
    const notebooks = await freshHome(app)
    app.showDialog(newSeriesDialog(notebooks))
    followStart(app, notebooks)
    return true
  }
  if (
    (action === 'open-series' || action === 'open-series-page') &&
    target.dataset.series
  ) {
    await showSeries(app, target.dataset.series, action === 'open-series-page')
    return true
  }
  if (action === 'plan-arc' && target.dataset.series) {
    const id = target.dataset.series
    await busy(target, () => seriesApi.planArc(id))
    await showSeries(app, id)
    return true
  }
  return false
}

export const submitSeries = async (
  app: AppContext,
  form: HTMLFormElement,
  values: FormData
) => {
  if (form.id === 'series-form') {
    // From a notebook, its pages are the episodes' and its repos theirs.
    const from = String(values.get('from') || '')
    const path = String(values.get('path') || '').trim()
    const branch = String(values.get('branch') || '').trim()
    const created = await busy(form.querySelector('button.primary')!, () =>
      seriesApi.create({
        title: values.get('title'),
        about: values.get('about'),
        growth: values.get('growth'),
        led: values.get('led'),
        ...(from
          ? { from }
          : { repos: path ? [{ path, ...(branch ? { branch } : {}) }] : [] })
      })
    )
    await freshHome(app)
    if (from) {
      // Its map shows the series, and the episodes as they are planned; a
      // map still being drawn says when its series starts.
      app.dialog.close()
      await app.mapCanvas.open(from)
      if ('waiting' in created)
        app.mapCanvas.toast('The series starts once the wireframes are drawn.')
      return
    }
    // The home page behind the dialog shows the new series' tile.
    app.render()
    if ('id' in created) await showSeries(app, created.id)
  }
  if (form.id === 'episode-form' && form.dataset.series) {
    // The new episode opens in place of the notes on show: they are saved
    // first, or left only when the creator says so (review 6).
    if (!(await saveBeforeLeaving(app))) return
    const part = values.get('part')
    const series = form.dataset.series
    const { notebook } = await busy(form.querySelector('button')!, () =>
      seriesApi.addEpisode(series, {
        source: String(values.get('source') || ''),
        ...(part === null ? {} : { part: Number(part) })
      })
    )
    app.dialog.close()
    app.stage = 'notebook'
    app.attach(notebook)
    app.render()
  }
  if (form.id === 'threads-form' && form.dataset.series) {
    const page = await seriesApi.update(form.dataset.series, {
      threads: String(values.get('threads') || '').split('\n')
    })
    if (app.seriesPage?.series.id === form.dataset.series) {
      app.seriesPage = page
      app.render()
    } else {
      app.showDialog(seriesPageView(page))
      app.dialog.dataset.series = form.dataset.series
    }
  }
}
