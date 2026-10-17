// Undo and Redo on the map for what is done to an episode's cards on the
// canvas: a reorder, a move to another episode, a removal. ⌘Z undoes the
// last of them, ⇧⌘Z does it again, as the Undo in its toast does (review
// 8). Any other change to the map ends the history: Undo never reaches
// back past something it can't undo. A card that has changed since says
// so rather than undoing something else. Segues are rewritten as for any
// reorder; one still running is run again on the order put back.
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
export type MapEdit = Order | Move | Removal
type Step = { work: () => Promise<unknown>; said: string }

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
    // The engine keeps one removal per episode to bring back, and one card
    // moved out of each.
    const older = (item: MapEdit) =>
      (item.kind === 'remove' &&
        edit.kind === 'remove' &&
        item.episode === edit.episode) ||
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
    const step = this.step(edit, back)
    if (!step) {
      from.pop()
      return this.map.toast(`Nothing to ${word}: that card has changed since`)
    }
    this.busy = true
    try {
      // Refused, it stays to be tried again; its own run keeps the history.
      if (!(await this.map.run(step.work, undefined, true))) return
      // Another change ended the history meanwhile: nothing to redo after.
      const at = from.indexOf(edit)
      if (at < 0) return
      from.splice(at, 1)
      to.push(edit)
      this.map.toast(step.said, {
        label: back ? 'Redo' : 'Undo',
        map: `${back ? 'redo' : 'undo'}:${edit.id}`
      })
    } finally {
      this.busy = false
    }
  }

  /** What undoing (back) or redoing an edit sends, and says; null when its
   * card is no longer where the edit left it. */
  private step(edit: MapEdit, back: boolean): Step | null {
    const episode = (id: string) =>
      this.map.view?.episodes.find((e) => e.notebook === id)
    const find = (lane: MapEpisode | undefined, key: string) =>
      lane?.copies.find((copy) => keyOf(copy) === key)
    if (edit.kind === 'order') {
      const lane = episode(edit.episode)
      if (!lane?.copies.some((copy) => copy.id === edit.copy)) return null
      const rest = lane.copies
        .filter((copy) => copy.id !== edit.copy)
        .map(keyOf)
      const key = keyOf(lane.copies.find((copy) => copy.id === edit.copy)!)
      const index = placeAfter(back ? edit.before : edit.after, key, rest)
      return {
        work: () =>
          mapApi.copies(edit.episode, {
            action: 'move',
            slide: edit.copy,
            to: edit.episode,
            index
          }),
        said: back
          ? 'Put back. The segues around it are being rewritten.'
          : 'Moved again. The segues around it are being rewritten.'
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
    if (back)
      return {
        work: () => api.slide(edit.episode, { action: 'undo-delete' }),
        said: 'Back in the episode'
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
