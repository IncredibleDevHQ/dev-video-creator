// The creator's say in the plan: directions (notes on the canvas, about the
// whole series, one episode, or some cards), the outcome and audience, and
// what to do about a gap. A direction is answered by the next plan: followed,
// partly or not, and why.
import { randomUUID } from 'node:crypto'
import type { Snapshot } from '../shared/api'
import type { Direction, Series, SeriesGap } from '../shared/series'
import { Refusal } from './refusal'
import { changeSeries } from './series'

const words = (value: unknown, limit: number) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit)

/** The series' directions, with an older line of "ideas" as the first. */
export const directionsOf = (series: Series): Direction[] => {
  const directions = series.directions || []
  return series.ideas && !directions.some((d) => d.id === 'ideas')
    ? [{ id: 'ideas', text: series.ideas, at: series.createdAt }, ...directions]
    : directions
}

/** What a direction is about, in words the planner reads. */
export const scopeOf = (
  direction: Direction,
  map: Snapshot,
  episodes: Array<{ notebook: string; number: number; title: string }>
) => {
  const episode = direction.to?.episode
    ? episodes.find((item) => item.notebook === direction.to!.episode)
    : undefined
  if (episode) return `episode ${episode.number}, “${episode.title}”`
  const titles = (direction.to?.pages || [])
    .map((id) => map.project.slides.find((slide) => slide.id === id)?.title)
    .filter(Boolean)
  if (titles.length)
    return `the cards ${titles.map((t) => `“${t}”`).join(', ')}`
  return 'the whole series'
}

const MAX = 30

/** Adds a direction, or changes one: its words, what it is wired to, where
 * it sits. A changed text waits for the next plan's answer. */
export const saveDirection = (seriesId: string, raw: unknown) => {
  const value = (raw ?? {}) as Record<string, unknown>
  return changeSeries(seriesId, (series) => {
    const all = directionsOf(series)
    const id = value.id ? String(value.id) : ''
    const existing = id ? all.find((item) => item.id === id) : undefined
    if (id && !existing) throw new Refusal('That direction is gone')
    const text =
      value.text === undefined ? existing?.text || '' : words(value.text, 600)
    if (!text) throw new Refusal('Write the direction first')
    if (!existing && all.length >= MAX)
      throw new Refusal(`A series takes up to ${MAX} directions`)
    const to = value.to === undefined ? existing?.to : toOf(value.to, series)
    const spot = value.spot === undefined ? existing?.spot : spotOf(value.spot)
    const next: Direction = {
      id: existing?.id || randomUUID(),
      text,
      at: existing?.at || new Date().toISOString(),
      ...(to ? { to } : {}),
      ...(spot ? { spot } : {}),
      // An answer holds only for the words and the wiring it answered.
      ...(existing?.answer &&
      existing.text === text &&
      JSON.stringify(existing.to || null) === JSON.stringify(to || null)
        ? { answer: existing.answer }
        : {})
    }
    series.directions = existing
      ? all.map((item) => (item.id === existing.id ? next : item))
      : [...all, next]
    delete series.ideas
  })
}

const toOf = (raw: unknown, series: Series): Direction['to'] => {
  const value = (raw ?? {}) as Record<string, unknown>
  if (value.episode) {
    const episode = String(value.episode)
    if (!series.episodes.some((item) => item.notebookId === episode))
      throw new Refusal('Wire it to an episode of this series')
    return { episode }
  }
  const pages = Array.isArray(value.pages)
    ? [...new Set(value.pages.map(String))].slice(0, 12)
    : []
  return pages.length ? { pages } : undefined
}
const spotOf = (raw: unknown) => {
  const value = (raw ?? {}) as Record<string, unknown>
  const x = Number(value.x)
  const y = Number(value.y)
  return Number.isFinite(x) && Number.isFinite(y)
    ? { x: Math.round(x), y: Math.round(y) }
    : undefined
}

export const removeDirection = (seriesId: string, raw: unknown) => {
  const id = String((raw as { id?: unknown })?.id || '')
  return changeSeries(seriesId, (series) => {
    const all = directionsOf(series)
    if (!all.some((item) => item.id === id))
      throw new Refusal('That direction is gone')
    series.directions = all.filter((item) => item.id !== id)
    delete series.ideas
  })
}

/** The outcome and audience in the creator's words (no longer suggested),
 * and whether new cards organise themselves. */
export const updateBrief = (seriesId: string, raw: unknown) => {
  const value = (raw ?? {}) as Record<string, unknown>
  return changeSeries(seriesId, (series) => {
    const suggested = new Set(series.suggested || [])
    for (const key of ['outcome', 'audience'] as const) {
      if (value[key] === undefined) continue
      const text = words(value[key], key === 'outcome' ? 300 : 200)
      if (text) series[key] = text
      else delete series[key]
      suggested.delete(key)
    }
    series.suggested = [...suggested]
    if (value.organize !== undefined) {
      series.organize = value.organize === true
      delete series.autoplan
    }
    if (value.title !== undefined) {
      const title = words(value.title, 120)
      if (!title) throw new Refusal('Give the series a title')
      series.title = title
    }
  })
}

/** What to do about a gap: an episode explains it, it doesn't matter, or it
 * is open again. A card closes a gap when it is placed against it. */
export const setGap = (seriesId: string, raw: unknown) => {
  const value = (raw ?? {}) as Record<string, unknown>
  const state = String(value.state || '') as SeriesGap['state']
  if (!['explained', 'ignored', 'open'].includes(state))
    throw new Refusal('Choose explained, ignored or open')
  return changeSeries(seriesId, (series) => {
    const gap = series.gaps?.find((item) => item.id === String(value.id))
    if (!gap) throw new Refusal('That gap is gone')
    gap.state = state
    if (state === 'open') delete gap.closedBy
  })
}
