// Undo and Redo on the map for what is done to an episode's cards on the
// canvas: a reorder, a move to another episode, a removal, an Update from
// the map or a Keep. ⌘Z undoes the last of them, ⇧⌘Z does it again, as the
// Undo in its toast does (review 8). Any other change to the map ends the
// history: Undo never reaches back past something it can't undo. A card
// that has changed since says so rather than undoing something else. An
// order put back takes the segues it had again, with no new words; only
// lines it never had are written, and only then does the toast say they
// are (round 2).
import type { MapCopy, MapEpisode } from '../shared/content-map'
import { api } from './api'
import { mapApi } from './map-api'
import type { MapCanvas } from './map-canvas'

/** A reorder within an episode: the card and the order before and after. */
type Order = {
  kind: 'order'
  episode: string
  copy: string
  before: string[]
  after: string[]
}
/** A move to another episode: the card that left (the engine keeps it, so
 * Undo brings back this very card, its lines and its scene), the copy it
 * became there, its map page and the order it went into. */
type Move = {
  kind: 'move'
  from: string
  to: string
  copy: string
  as: string
  page?: string
  after: string[]
}
type Removal = { kind: 'remove'; episode: string; copy: string }
/** Copies brought up to their map cards (Update, or Update all), or one
 * kept as it is (Keep): the engine keeps them as they were for Undo. */
type Update = {
  kind: 'update'
  episode: string
  keep: boolean
  copies: string[]
}
export type MapEdit = Order | Move | Removal | Update
type Step = { work: () => Promise<unknown>; said: string | (() => string) }

/** What an Update or a Keep says, done or done again. */
const updateSaid = (edit: Update, n = edit.copies.length) =>
  edit.keep
    ? 'This episode keeps its version'
    : n === 1
      ? 'Copy updated from the map'
      : `${n} cards updated from the map`

/**
 * The map's Update for an episode's copies (one, or Update all of those
 * that changed on the map), or its Keep for one, with Undo in its toast and
 * on ⌘Z (review 8 F08). True once it went through.
 */
export const updateCopies = async (
  map: MapCanvas,
  episode: string,
  copies: string[],
  keep = false
) => {
  let changed = 0
  const done = await map.run(
    async () => {
      const [slide] = copies
      const result = await mapApi.copies(
        episode,
        keep
          ? { action: 'keep', slide }
          : copies.length === 1
            ? { action: 'update', slide }
            : { action: 'update', slides: copies }
      )
      changed = keep ? 1 : (result.updated ?? copies.length)
    },
    undefined,
    true
  )
  if (!done) return false
  const edit: Update = { kind: 'update', episode, keep, copies }
  if (changed) map.history.record(edit, updateSaid(edit, changed))
  else map.toast('They match the map already')
  return true
}

/** What a reorder says, from what the engine answered: "rewritten" only
 * when a segue is being written (round 2). */
export const reordered = (what: string, rewriting?: boolean) =>
  rewriting === false
    ? `${what}, with the segues this order had.`
    : `${what}. The segues around it are being rewritten.`
/** A card in its episode, by the map page it copies (or its own id). */
export const keyOf = (copy: MapCopy) => copy.copyOf?.slide ?? copy.id
/** An episode's cards in order, by key, as they would be with one moved. */
export const placed = (keys: string[], key: string, index?: number) => {
  const rest = keys.filter((item) => item !== key)
  const at = Math.max(0, Math.min(index ?? rest.length, rest.length))
  return [...rest.slice(0, at), key, ...rest.slice(at)]
}
/** Where a card goes in a lane: after the nearest card that came before it
 * in the order it goes back to, still in the lane; else first. */
const placeAfter = (order: string[], key: string, lane: string[]) => {
  for (let i = order.indexOf(key) - 1; i >= 0; i--) {
    const at = lane.indexOf(order[i])
    if (at >= 0) return at + 1
  }
  return 0
}

type Entry = MapEdit & { id: number }

export class MapHistory {
  private readonly done: Entry[] = []
  private readonly undone: Entry[] = []
  private last = 0
  private busy = false
  constructor(private readonly map: MapCanvas) {}

  clear() {
    this.done.length = 0
    this.undone.length = 0
  }

  /** An edit just made, with Undo in the toast that says so. */
  record(edit: MapEdit, said: string) {
    const id = ++this.last
    // The engine keeps one removal per episode to bring back, one card
    // moved out of each, and its last Update or Keep.
    const older = (item: MapEdit) =>
      (item.kind === edit.kind &&
        (item.kind === 'remove' || item.kind === 'update') &&
        item.episode === (edit as typeof item).episode) ||
      (item.kind === 'move' && edit.kind === 'move' && item.from === edit.from)
    for (const list of [this.done, this.undone])
      for (let i = list.length - 1; i >= 0; i--)
        if (older(list[i])) list.splice(i, 1)
    this.done.push({ ...edit, id })
    if (this.done.length > 20) this.done.shift()
    this.undone.length = 0
    this.map.toast(said, { label: 'Undo', map: `undo:${id}` })
  }

  /** Undoes the last edit; from a toast, only the edit it told of. */
  undo(id?: number) {
    return this.go(this.done, this.undone, true, id)
  }
  redo(id?: number) {
    return this.go(this.undone, this.done, false, id)
  }

  private async go(from: Entry[], to: Entry[], back: boolean, id?: number) {
    const edit = from.at(-1)
    const word = back ? 'undo' : 'redo'
    if (!edit) return this.map.toast(`Nothing to ${word}`)
    if ((id !== undefined && edit.id !== id) || this.busy) return
    this.busy = true
    try {
      const step = await this.step(edit, back)
      if (!step) {
        const at = from.indexOf(edit)
        if (at >= 0) from.splice(at, 1)
        return this.map.toast(`Nothing to ${word}: that card has changed since`)
      }
      // Refused, it stays to be tried again; its own run keeps the history.
      if (!(await this.map.run(step.work, undefined, true))) return
      // Another change ended the history meanwhile: nothing to redo after.
      const at = from.indexOf(edit)
      if (at < 0) return
      from.splice(at, 1)
      to.push(edit)
      this.map.toast(typeof step.said === 'string' ? step.said : step.said(), {
        label: back ? 'Redo' : 'Undo',
        map: `${back ? 'redo' : 'undo'}:${edit.id}`
      })
    } finally {
      this.busy = false
    }
  }

  /** What undoing (back) or redoing an edit sends, and says; null when its
   * card is no longer where the edit left it. */
  private async step(edit: MapEdit, back: boolean): Promise<Step | null> {
    const episode = (id: string) =>
      this.map.view?.episodes.find((e) => e.notebook === id)
    const find = (lane: MapEpisode | undefined, key: string) =>
      lane?.copies.find((copy) => keyOf(copy) === key)
    if (edit.kind === 'update') {
      const lane = episode(edit.episode)
      const n = edit.copies.length
      if (!edit.copies.every((id) => lane?.copies.some((c) => c.id === id)))
        return null
      if (!back)
        return {
          work: () =>
            mapApi.copies(
              edit.episode,
              edit.keep
                ? { action: 'keep', slide: edit.copies[0] }
                : { action: 'update', slides: edit.copies }
            ),
          said: updateSaid(edit)
        }
      return {
        work: () => mapApi.copies(edit.episode, { action: 'undo-update' }),
        said: edit.keep
          ? 'It waits for your Update again'
          : n === 1
            ? 'Put back as it was'
            : `${n} cards put back as they were`
      }
    }
    if (edit.kind === 'order') {
      const lane = episode(edit.episode)
      if (!lane?.copies.some((copy) => copy.id === edit.copy)) return null
      const rest = lane.copies
        .filter((copy) => copy.id !== edit.copy)
        .map(keyOf)
      const key = keyOf(lane.copies.find((copy) => copy.id === edit.copy)!)
      const index = placeAfter(back ? edit.before : edit.after, key, rest)
      let rewriting: boolean | undefined
      return {
        work: async () => {
          const moved = await mapApi.copies(edit.episode, {
            action: 'move',
            slide: edit.copy,
            to: edit.episode,
            index
          })
          rewriting = moved.rewriting
        },
        said: () => reordered(back ? 'Put back' : 'Moved again', rewriting)
      }
    }
    if (edit.kind === 'move') {
      const from = episode(edit.from)
      const to = episode(edit.to)
      const has = (lane: MapEpisode | undefined, id: string) =>
        lane?.copies.some((copy) => copy.id === id)
      if (!from || !to) return null
      // Back: the copy it became is still there, and its page isn't here
      // again; the engine puts back the card that left, as it was.
      if (back)
        return has(to, edit.as) && !(edit.page && find(from, edit.page))
          ? {
              work: () =>
                mapApi.copies(edit.from, {
                  action: 'unmove',
                  slide: edit.copy
                }),
              said: `Back in Ep ${from.number}`
            }
          : null
      if (!has(from, edit.copy) || (edit.page && find(to, edit.page)))
        return null
      const card = from.copies.find((copy) => copy.id === edit.copy)!
      const index = placeAfter(edit.after, keyOf(card), to.copies.map(keyOf))
      return {
        work: async () => {
          const moved = await mapApi.copies(edit.from, {
            action: 'move',
            slide: edit.copy,
            to: edit.to,
            index
          })
          edit.as = moved.as || ''
        },
        said: `Moved to Ep ${to.number}`
      }
    }
    if (back) {
      // The episode keeps its last removal: one removed since, on the map
      // or its Wireframe stage, is never brought back for this card (round
      // 2). Not loaded, the engine still refuses another.
      if (episode(edit.episode)?.copies.some((copy) => copy.id === edit.copy))
        return null
      const kept = await api.load(edit.episode).then(
        (episode) => episode.deletedSlide?.slide.id ?? null,
        () => undefined
      )
      if (kept !== undefined && kept !== edit.copy) return null
      return {
        work: () =>
          mapApi.copies(edit.episode, { action: 'unremove', slide: edit.copy }),
        said: 'Back in the episode'
      }
    }
    if (!episode(edit.episode)?.copies.some((copy) => copy.id === edit.copy))
      return null
    return {
      work: () =>
        mapApi.copies(edit.episode, { action: 'remove', slide: edit.copy }),
      said: 'Removed from the episode again. The map keeps the page.'
    }
  }
}
