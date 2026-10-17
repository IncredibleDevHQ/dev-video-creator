// A card on the map that says what a series gap misses marks the gap, for
// the creator to close with that card (round 2's live run). A mark is the
// card's while the card is on the map: one whose card has gone is no mark,
// so the gap can be marked again, and Covered is never offered for it.
import type { SeriesGap } from '../shared/series'
import { loadProject } from './projects'
import { changeSeries, loadSeries } from './series'
import { coveredBy, onMapOf, type Covered } from './series-gaps'
import { cardsOf, existingOf } from './series-plan'

/**
 * Each open gap a card now says is marked with it, as a plan marks one; a
 * mark whose card has gone is marked again, or dropped. Run after new cards
 * are placed, and when they are drawn with Organise off (nothing placed).
 */
export const markNewCovered = async (seriesId: string, mapId: string) => {
  const map = await loadProject(mapId)
  const series = await loadSeries(seriesId)
  if (!map || !series) return
  const onMap = onMapOf(map.project.slides)
  const marked = (gap: SeriesGap) =>
    Boolean(gap.covered && onMap.has(gap.covered.page))
  const episodeOf = new Map<string, number>()
  for (const item of await existingOf(series))
    for (const page of item.pages) episodeOf.set(page, item.number)
  const number = (notebook?: string) =>
    series.episodes.find((e) => e.notebookId === notebook)?.number
  const cards = cardsOf(map)
  const found = new Map<string, Covered | null>()
  for (const gap of series.gaps || []) {
    if (gap.state !== 'open' || marked(gap)) continue
    const covered = coveredBy(gap.missing, cards, {
      episode: number(gap.episode),
      episodeOf
    })
    if (covered || gap.covered) found.set(gap.id, covered)
  }
  if (!found.size) return
  await changeSeries(seriesId, (current) => {
    for (const gap of current.gaps || []) {
      if (gap.state !== 'open' || marked(gap) || !found.has(gap.id)) continue
      const covered = found.get(gap.id)
      if (covered) gap.covered = covered
      else delete gap.covered
    }
  })
}
