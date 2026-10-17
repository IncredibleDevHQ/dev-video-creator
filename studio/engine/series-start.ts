// A series as the creator starts it from home: from one of their notebooks,
// whose drawn pages become the episodes and whose plan the studio proposes,
// or from what it is about alone (review 8: the notes first, the structure
// proposed, never asked for up front).
import { startMapSeries } from './map-episodes'
import { loadProject } from './projects'
import { Refusal } from './refusal'
import { createSeries } from './series'
import { planSeries } from './series-plan'

export const startSeries = async (raw: unknown) => {
  const value = (raw ?? {}) as Record<string, unknown>
  const from = typeof value.from === 'string' ? value.from : ''
  if (!from) return createSeries(value)
  if (!/^[a-zA-Z0-9_-]+$/.test(from))
    throw new Refusal('Choose one of your notebooks')
  const had = (await loadProject(from))?.project.mapSeries
  const series = await startMapSeries(from, {
    title: value.title,
    about: value.about
  })
  // A notebook's series already started stays as it is.
  if (series.id === had || value.growth === 'one') return series
  return planSeries(series.id, {})
}
