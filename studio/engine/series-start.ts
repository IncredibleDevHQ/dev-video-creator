// A series as the creator starts it from home: from one of their notebooks,
// whose drawn pages become the episodes and whose plan the studio proposes,
// or from what it is about alone (review 8: the notes first, the structure
// proposed, never asked for up front), with who presents it. A notebook
// still being drawn keeps the series as asked, and it starts once drawn.
import { seriesLed, type WaitingSeries } from '../shared/series'
import { addEvent } from './activity'
import { startMapSeries } from './map-episodes'
import { changeProject, loadProject } from './projects'
import { Refusal } from './refusal'
import { changeSeries, createSeries } from './series'
import { planSeries } from './series-plan'

const words = (value: unknown, limit: number) =>
  String(value ?? '')
    .trim()
    .slice(0, limit)

/** Kept on a notebook still being drawn; false when it is drawn already,
 * read in the notebook's own queue, so the drawing never finishes between
 * the look and the keeping. */
const keepWhileDrawn = async (id: string, value: Record<string, unknown>) => {
  let kept = false
  await changeProject(id, (current) => {
    if (current.status !== 'building' || current.project.mapSeries) return
    const led = seriesLed(value.led)
    const waiting: WaitingSeries = {
      title: words(value.title, 120),
      about: words(value.about, 4000),
      growth: value.growth === 'one' ? 'one' : 'arc',
      ...(led ? { led } : {}),
      at: new Date().toISOString()
    }
    current.project.waitingSeries = waiting
    addEvent(
      current,
      'slide',
      'The series starts once the wireframes are drawn'
    )
    kept = true
  })
  return kept
}

export const startSeries = async (raw: unknown) => {
  const value = (raw ?? {}) as Record<string, unknown>
  const from = typeof value.from === 'string' ? value.from : ''
  if (!from) return createSeries(value)
  if (!/^[a-zA-Z0-9_-]+$/.test(from))
    throw new Refusal('Choose one of your notebooks')
  const notebook = await loadProject(from)
  if (!notebook) throw new Refusal('Notebook not found')
  if (await keepWhileDrawn(from, value)) return { waiting: from }
  const had = notebook.project.mapSeries
  const started = await startMapSeries(from, {
    title: value.title,
    about: value.about
  })
  // A notebook's series already started stays as it is.
  if (started.id === had) return started
  const led = seriesLed(value.led)
  const series = led
    ? await changeSeries(started.id, (current) => {
        current.led = led
      })
    : started
  if (value.growth === 'one') return series
  return planSeries(series.id, {})
}

/** Once a notebook's wireframes are drawn: the series asked for meanwhile
 * starts, as it was asked, its plan too. Taken off the notebook first, so
 * it starts once; when it cannot, the notebook says why and home offers it
 * again. */
export const startWaitingSeries = async (id: string) => {
  if (!(await loadProject(id))?.project.waitingSeries) return
  let waiting: WaitingSeries | undefined
  await changeProject(id, (current) => {
    if (current.status !== 'ready') return
    waiting = current.project.waitingSeries
    delete current.project.waitingSeries
  })
  if (!waiting) return
  try {
    return await startSeries({ ...waiting, from: id })
  } catch (error) {
    await changeProject(id, (current) => {
      addEvent(
        current,
        'slide',
        `The series could not start: ${error instanceof Error ? error.message : 'try again from home'}`
      )
    })
    throw error
  }
}
