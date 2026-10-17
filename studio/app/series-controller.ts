// Starting a series, its page, the arc, and adding the next episode.
import type { Snapshot } from '../shared/api'
import type { Series, SeriesSummary } from '../shared/series'
import type { AppContext } from './app-context'
import {
  looseNotebooks,
  newSeriesDialog,
  seriesPageView,
  type SeriesPageData
} from './series-view'
import { studioApi } from './studio-api'
import { busy, typingIn } from './ui'
import { saveBeforeLeaving } from './notebook-editor'

export const seriesApi = {
  list: () => studioApi.request<SeriesSummary[]>('/series'),
  page: (id: string) => studioApi.request<SeriesPageData>(`/series/${id}`),
  create: (body: unknown) =>
    studioApi.request<Series | SeriesPageData>('/series', 'POST', body),
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

export const clickSeries = async (
  app: AppContext,
  target: HTMLButtonElement,
  action: string | undefined
) => {
  if (action === 'new-series') {
    app.showDialog(newSeriesDialog(looseNotebooks(app.notebooks, app.series)))
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
    const created = (await busy(form.querySelector('button.primary')!, () =>
      seriesApi.create({
        title: values.get('title'),
        about: values.get('about'),
        growth: values.get('growth'),
        ...(from
          ? { from }
          : { repos: path ? [{ path, ...(branch ? { branch } : {}) }] : [] })
      })
    )) as Series
    app.series = await seriesApi.list()
    if (from) {
      // Its map shows the series, and the episodes as they are planned.
      app.dialog.close()
      void app.mapCanvas.open(from)
      return
    }
    // The home page behind the dialog shows the new series' tile.
    app.render()
    await showSeries(app, created.id)
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
