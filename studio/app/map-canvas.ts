// The content map as a page of its own: the notebook's pages on a canvas,
// the series made from them with one lane per episode, and what each made
// episode was cut into. Notes added in its rail pile into the map. Pages are
// copied, cut or moved into episodes by dragging or with ⌘C/⌘X/⌘V; the map
// itself never changes because an episode did.
import type { Snapshot } from '../shared/api'
import type { MapView } from '../shared/content-map'
import { api } from './api'
import { mapApi } from './map-api'
import { renderBar, hideMenu } from './map-bar'
import { installMapInput, type DragState } from './map-input'
import {
  extent,
  mapLayout,
  type Box,
  type MapFilter,
  type MapLayout,
  type MapMode
} from './map-layout'
import { paintWorld } from './map-paint'
import { mapNotes, mapPage, mapTools } from './map-view'
import { replacePlayerView } from './player-view'

export type MapSel =
  | { t: 'page'; id: string }
  | { t: 'copy'; id: string }
  | { t: 'lane'; id: string }
  | null
export type MapClip =
  | { mode: 'copy' | 'cut'; slide: string }
  | { mode: 'move'; copy: string; from: string }
  | null
type Hooks = {
  close: () => void
  openEpisode: (id: string) => void
  error: (reason: unknown) => void
}

export class MapCanvas {
  isOpen = false
  mapId = ''
  snapshot: Snapshot | null = null
  view: MapView | null = null
  layout: MapLayout | null = null
  mode: MapMode = 'order'
  filter: MapFilter = 'all'
  sel: MapSel = null
  clip: MapClip = null
  camera = { x: 0, y: 0, k: 1 }
  els = new Map<string, HTMLElement & { _html?: string }>()
  fly: Record<string, { x: number; y: number }> = {}
  drag: DragState | null = null
  naming: { slides: string[] } | null = null
  changing: string | null = null
  private fitted = false
  private poll: ReturnType<typeof setInterval> | null = null
  private unsubscribe: (() => void) | null = null
  private toastTimer: ReturnType<typeof setTimeout> | null = null
  constructor(
    readonly root: HTMLElement,
    readonly hooks: Hooks
  ) {
    installMapInput(this)
  }
  slot(name: string) {
    return this.root.querySelector<HTMLElement>(`[data-map-slot="${name}"]`)
  }
  get world() {
    return this.root.querySelector<HTMLElement>('[data-map-world]')
  }
  get canvas() {
    return this.root.querySelector<HTMLElement>('[data-map-canvas]')
  }
  /** Opens the map of a notebook: an episode opens the map it copies. */
  async open(id: string): Promise<void> {
    this.stop()
    this.isOpen = true
    this.mapId = id
    this.snapshot = null
    this.view = null
    this.sel = null
    this.clip = null
    this.fitted = false
    this.els.clear()
    replacePlayerView(this.root, mapPage('Loading…'), null)
    const url = new URL(location.href)
    url.searchParams.set('map', id)
    history.replaceState(null, '', url)
    try {
      const snapshot = await api.load(id)
      if (snapshot.project.copyOfMap)
        return this.open(snapshot.project.copyOfMap)
      this.snapshot = snapshot
      await this.refresh()
      this.unsubscribe = api.subscribe(
        id,
        (update) => {
          if (!this.isOpen || update.project.id !== this.mapId) return
          this.snapshot = update
          this.paint()
        },
        () => {}
      )
      // Episodes change apart from the map: their segues, their videos.
      this.poll = setInterval(() => {
        if (!document.hidden && !this.drag) void this.refresh().catch(() => {})
      }, 3000)
    } catch (reason) {
      this.hooks.error(reason)
    }
  }
  async refresh() {
    if (!this.isOpen) return
    const view = await mapApi.view(this.mapId)
    if (!this.isOpen || view.notebook !== this.mapId) return
    this.view = view
    this.paint()
  }
  close() {
    if (!this.isOpen) return
    this.dismiss()
    this.hooks.close()
  }
  /** Leaves without drawing what is behind, for a caller that draws next. */
  dismiss() {
    this.stop()
    this.isOpen = false
    const url = new URL(location.href)
    url.searchParams.delete('map')
    history.replaceState(null, '', url)
  }
  private stop() {
    if (this.poll) clearInterval(this.poll)
    this.poll = null
    this.unsubscribe?.()
    this.unsubscribe = null
  }
  paint() {
    if (!this.isOpen || !this.snapshot || !this.world) return
    const title = this.slot('title')
    if (title) title.textContent = this.snapshot.project.title
    this.fill(
      'tools',
      mapTools(this.snapshot, this.view, this.mode, this.filter)
    )
    this.fill('notes', mapNotes(this.snapshot))
    this.layout = mapLayout(this.snapshot, this.view, this.mode)
    paintWorld(this)
    renderBar(this)
    if (!this.fitted && this.view) {
      this.fitted = true
      this.fit()
    }
  }
  private fill(name: string, html: string) {
    const node = this.slot(name) as (HTMLElement & { _html?: string }) | null
    if (node && node._html !== html) {
      node.innerHTML = html
      node._html = html
    }
  }
  applyCamera(animate = false) {
    const world = this.world
    if (!world) return
    world.style.transition = animate
      ? 'transform .45s cubic-bezier(.2,.8,.2,1)'
      : ''
    world.style.transform = `translate(${this.camera.x}px,${this.camera.y}px) scale(${this.camera.k})`
  }
  fit(focus?: Box) {
    if (!this.layout || !this.canvas) return
    const box = extent(this.layout, focus)
    const rect = this.canvas.getBoundingClientRect()
    const width = rect.width - 24
    const height = rect.height - 90
    if (width <= 0 || height <= 0) return
    const k = Math.max(0.2, Math.min(width / box.w, height / box.h, 1))
    this.camera = {
      k,
      x: 12 + (width - box.w * k) / 2 - box.x * k,
      y: 16 + Math.max(0, (height - box.h * k) / 2) - box.y * k
    }
    this.applyCamera(true)
  }
  select(sel: MapSel) {
    this.sel = sel
    hideMenu(this)
    this.paint()
  }
  toast(text: string) {
    const node = this.slot('toast')
    if (!node) return
    node.textContent = text
    node.hidden = false
    if (this.toastTimer) clearTimeout(this.toastTimer)
    this.toastTimer = setTimeout(() => {
      node.hidden = true
    }, 3200)
  }
  /** Runs a change, then shows the map as it is now. */
  async run(work: () => Promise<unknown>, said?: string) {
    try {
      await work()
      if (said) this.toast(said)
      this.snapshot = await api.load(this.mapId)
      await this.refresh()
    } catch (reason) {
      this.hooks.error(reason)
    }
  }
  episodeOf(copy: string) {
    return this.view?.episodes.find((e) => e.copies.some((c) => c.id === copy))
  }
  /** Copies (or cuts) a map page into an episode, at a place in its lane. */
  copyInto(slide: string, episode: string, index?: number, only = false) {
    const from = this.layout?.cards[slide]
    const ep = this.view?.episodes.find((e) => e.notebook === episode)
    if (from) this.fly[`pending:${episode}`] = { x: from.x, y: from.y }
    return this.run(
      async () => {
        const result = await mapApi.copies(episode, {
          action: 'add',
          slide,
          index,
          only
        })
        if (only && result.shared)
          this.toast(
            `Another episode uses this page, so it was copied, not cut`
          )
      },
      `${only ? 'Cut' : 'Copied'} into Ep ${ep?.number ?? ''}. The map keeps the original.`
    )
  }
  moveCopy(copy: string, to: string, index?: number) {
    const from = this.episodeOf(copy)
    if (!from) return
    return this.run(
      () =>
        mapApi.copies(from.notebook, {
          action: 'move',
          slide: copy,
          to,
          index
        }),
      from.notebook === to
        ? 'Moved. The segues around it are being rewritten.'
        : 'Moved to the other episode.'
    )
  }
  removeCopy(copy: string) {
    const from = this.episodeOf(copy)
    if (!from) return
    this.sel = { t: 'lane', id: from.notebook }
    return this.run(
      () => mapApi.copies(from.notebook, { action: 'remove', slide: copy }),
      'Removed from the episode. The map keeps the page.'
    )
  }
  paste() {
    const clip = this.clip
    if (!clip) return this.toast('Select a page and press ⌘C first')
    let episode = this.sel?.t === 'lane' ? this.sel.id : null
    let index: number | undefined
    if (this.sel?.t === 'copy') {
      const ep = this.episodeOf(this.sel.id)
      if (ep) {
        episode = ep.notebook
        index = ep.copies.findIndex((c) => c.id === this.sel!.id) + 1
      }
    }
    if (!episode) return this.toast('Select an episode to paste into')
    if (clip.mode === 'move') {
      this.clip = null
      return this.moveCopy(clip.copy, episode, index)
    }
    if (clip.mode === 'cut') this.clip = null
    return this.copyInto(clip.slide, episode, index, clip.mode === 'cut')
  }
  /** Asks what the new episode is about, in the bar; the pages go with it. */
  newEpisode(slides: string[] = []) {
    if (!this.view?.series) return
    this.naming = { slides }
    this.paint()
    this.root
      .querySelector<HTMLInputElement>('[data-map-form="episode"] input')
      ?.focus()
  }
  /** A new episode: the pages chosen, else an empty one to drop pages in. */
  async addEpisode(title: string) {
    const series = this.view?.series
    const slides = this.naming?.slides || []
    this.naming = null
    if (!series) return
    await this.run(
      () =>
        mapApi.addEpisode(series.id, {
          title: title.trim() || undefined,
          slides
        }),
      slides.length
        ? 'Episode added. Its segues are being written.'
        : 'Empty episode added: drop pages into it.'
    )
    this.fitted = false
    this.paint()
  }
  async startSeries() {
    await this.run(
      () => mapApi.startSeries(this.mapId),
      'Series started. Add its first episode.'
    )
    this.fitted = false
  }
}
