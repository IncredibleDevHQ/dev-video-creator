// The creator's material for the words the studio writes about an episode:
// what its lines, storyboard and posts may promise (claims.ts). The map's
// source with every note added since, the episode's pages and the map cards
// they copy (the latest words, a note's caveat included), and, when asked,
// the pages of the episodes either side, which "last time" and "next time"
// speak of.
import type { Snapshot } from '../shared/api'
import type { Slide } from '../shared/model'
import { materialOf } from './claims'
import { loadProject } from './projects'
import { loadSeries } from './series'

export const episodeMaterial = async (
  snapshot: Snapshot,
  options: { neighbours?: boolean } = {}
) => {
  const map = snapshot.project.copyOfMap
    ? await loadProject(snapshot.project.copyOfMap)
    : null
  const original = (slide: Slide) =>
    map?.project.slides.find((page) => page.id === slide.copyOf?.slide)
  const pages: Slide[] = [...snapshot.project.slides]
  if (options.neighbours && snapshot.project.episode) {
    const order =
      (await loadSeries(snapshot.project.episode.series))?.episodes || []
    const at = order.findIndex(
      (item) => item.notebookId === snapshot.project.id
    )
    const before = at > 0 ? await loadProject(order[at - 1].notebookId) : null
    const after =
      at >= 0 && at < order.length - 1
        ? await loadProject(order[at + 1].notebookId)
        : null
    pages.push(...(before?.project.slides || []))
    if (after?.project.slides[0]) pages.push(after.project.slides[0])
  }
  return materialOf(map?.project.source ?? snapshot.project.source, [
    ...pages,
    ...pages.flatMap((slide) => original(slide) ?? [])
  ])
}
