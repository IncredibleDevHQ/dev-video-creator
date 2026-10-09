// The content map as a page of its own: the notebook's pages on a canvas,
// the series made from them with one lane per episode, and what each made
// episode was cut into. Notes added in its rail pile into the map. Pages are
// copied, cut or moved into episodes by dragging or with ⌘C/⌘X/⌘V; the map
// itself never changes because an episode did.
import type { Snapshot } from '../shared/api'
import type { MapView } from '../shared/content-map'
import { api } from './api'
import { confirmAction } from './confirm-action'
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
import { mapNotes, mapPage, mapStages, mapTools } from './map-view'
import { replacePlayerView } from './player-view'

export type MapSel =
  | { t: 'page'; id: string }
  | { t: 'copy'; id: string }
  | { t: 'lane'; id: string }
  | { t: 'series' }
  | null
export type MapClip =
  | { mode: 'copy' | 'cut'; slide: string }
  | { mode: 'move'; copy: string; from: string }
  | null
type Hooks = {
  close: () => void
  openEpisode: (id: string) => void
  /** Opens a notebook's Wireframe stage at one of its pages. */
  openPage: (id: string, index: number) => void
  /** Leaves the map for one of the notebook's stages. */
  openStage: (stage: 'notebook' | 'presentation' | 'video') => void
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
  renaming: { kind: 'episode' | 'series'; id: string; title: string } | null =
    null
  from = ''
  changing: string | null = null
  /** Long notes the creator opened with More. */
  openNotes = new Set<string>()
  /** The episode whose last removed page Undo brings back. */
  undo: { episode: string } | null = null
  private adding = false
  private fitted = false
  private fittedPages = 0
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
  async open(id: string, from = id): Promise<void> {
    this.stop()
    this.isOpen = true
    this.mapId = id
    // An episode opens its map; closing the map goes back to the episode.
    this.from = from
    this.snapshot = null
    this.view = null
    this.sel = null
    this.clip = null
    this.fitted = false
    this.fittedPages = 0
    this.els.clear()
    replacePlayerView(this.root, mapPage('Loading…'), null)
    const url = new URL(location.href)
    url.searchParams.set('map', id)
    history.replaceState(null, '', url)
    try {
      const snapshot = await api.load(id)
      // Closed, or another map opened, while this one loaded.
      if (!this.isOpen || this.mapId !== id) return
      if (snapshot.project.copyOfMap)
        return this.open(snapshot.project.copyOfMap, from)
      this.snapshot = snapshot
      await this.refresh()
      if (!this.isOpen || this.mapId !== id) return
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
    this.fill('stages', mapStages(this.snapshot))
    this.fill('notes', mapNotes(this.snapshot, this.openNotes))
    // Notes pile into a drawn map; while it forms they wait.
    const ready = this.snapshot.status === 'ready'
    const note = this.root.querySelector<HTMLTextAreaElement>(
      '[data-map-form="note"] textarea'
    )
    const add = this.root.querySelector<HTMLButtonElement>(
      '[data-map-form="note"] button'
    )
    if (note && note.disabled === ready) {
      note.disabled = !ready
      note.placeholder = ready
        ? 'Add a note: an idea, a link, a half-thought…'
        : 'Notes open once the map is drawn'
    }
    if (add) add.disabled = !ready
    this.layout = mapLayout(this.snapshot, this.view, this.mode)
    paintWorld(this)
    renderBar(this)
    // Fit once the map has its pages: at first, and when the story plans them.
    const pages = this.layout ? Object.keys(this.layout.cards).length : 0
    if ((!this.fitted || (this.fittedPages === 0 && pages > 0)) && this.view) {
      this.fitted = true
      this.fittedPages = pages
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
    const zoom = this.slot('zoom')
    if (zoom) zoom.textContent = `${Math.round(this.camera.k * 100)}%`
    // Lines keep their width on screen at any zoom (set on the lines only,
    // so the cards' styles are left alone).
    this.root
      .querySelector<SVGElement>('[data-map-wires]')
      ?.style.setProperty('--k', String(this.camera.k))
  }
  fit(focus?: Box) {
    if (!this.layout || !this.canvas) return
    const box = extent(this.layout, focus)
    const rect = this.canvas.getBoundingClientRect()
    const width = rect.width - 24
    const height = rect.height - 90
    if (width <= 0 || height <= 0) return
    const k = Math.max(0.2, Math.min(width / box.w, height / box.h, 1))
    // Too big even at the smallest zoom, it shows from its top left.
    this.camera = {
      k,
      x: 12 + Math.max(0, (width - box.w * k) / 2) - box.x * k,
      y: 16 + Math.max(0, (height - box.h * k) / 2) - box.y * k
    }
    this.applyCamera(true)
  }
  select(sel: MapSel) {
    this.sel = sel
    hideMenu(this)
    this.paint()
  }
  /** A short line over the canvas; with an action, a button that does it. */
  toast(text: string, action?: { label: string; map: string }) {
    const node = this.slot('toast')
    if (!node) return
    node.innerHTML = action
      ? `<span></span><button type="button" class="quiet" data-map="${action.map}">${action.label}</button>`
      : '<span></span>'
    node.querySelector('span')!.textContent = text
    node.hidden = false
    if (this.toastTimer) clearTimeout(this.toastTimer)
    this.toastTimer = setTimeout(
      () => {
        node.hidden = true
      },
      action ? 7000 : 3200
    )
  }
  /** Runs a change, then shows the map as it is now. True when it went through. */
  async run(work: () => Promise<unknown>, said?: string | (() => string)) {
    try {
      await work()
      if (said) this.toast(typeof said === 'function' ? said() : said)
      this.snapshot = await api.load(this.mapId)
      await this.refresh()
      return true
    } catch (reason) {
      this.hooks.error(reason)
      return false
    }
  }
  episodeOf(copy: string) {
    return this.view?.episodes.find((e) => e.copies.some((c) => c.id === copy))
  }
  /** Copies (or cuts) a map page into an episode, at a place in its lane. */
  copyInto(slide: string, episode: string, index?: number, only = false) {
    const from = this.layout?.cards[slide]
    const ep = this.view?.episodes.find((e) => e.notebook === episode)
    // A drop flies in from where it was let go; the bar's copy, from the page.
    if (from) this.fly[`pending:${episode}`] ||= { x: from.x, y: from.y }
    let said = `${only ? 'Cut' : 'Copied'} into Ep ${ep?.number ?? ''}. The map keeps the original.`
    return this.run(
      async () => {
        const result = await mapApi.copies(episode, {
          action: 'add',
          slide,
          index,
          only
        })
        if (only && result.shared)
          said = 'Another episode uses this page, so it was copied, not cut'
      },
      () => said
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
  /** Removes a page from its episode, with Undo; a made scene asks first. */
  async removeCopy(copy: string) {
    const from = this.episodeOf(copy)
    const item = from?.copies.find((c) => c.id === copy)
    if (!from || !item) return
    if (
      item.scene?.made &&
      !(await confirmAction({
        title: 'Remove this page and its made scene?',
        detail: `The scene made for “${item.title}” in Ep ${from.number} goes with it. Undo brings both back.`,
        action: 'Remove page'
      }))
    )
      return
    this.sel = { t: 'lane', id: from.notebook }
    // Undo is offered only for a removal that happened (review 6).
    const removed = await this.run(() =>
      mapApi.copies(from.notebook, { action: 'remove', slide: copy })
    )
    if (!removed) return
    this.undo = { episode: from.notebook }
    this.toast('Removed from the episode. The map keeps the page.', {
      label: 'Undo',
      map: 'undo-remove'
    })
  }
  /** Brings back the page last removed, and its scene. */
  async undoRemove() {
    const undo = this.undo
    this.undo = null
    if (!undo) return
    await this.run(
      () => api.slide(undo.episode, { action: 'undo-delete' }),
      'Back in the episode'
    )
  }
  paste() {
    const clip = this.clip
    if (!clip) return this.toast('Select a page and press ⌘C first')
    let episode = this.sel?.t === 'lane' ? this.sel.id : null
    let index: number | undefined
    const sel = this.sel
    if (sel?.t === 'copy') {
      const ep = this.episodeOf(sel.id)
      if (ep) {
        episode = ep.notebook
        index = ep.copies.findIndex((c) => c.id === sel.id) + 1
      }
    }
    if (!episode) return this.toast('Select an episode to paste into')
    if (clip.mode === 'move') {
      this.clip = null
      // In its own lane, the copy leaves first: places after it move up one.
      const lane = this.view?.episodes.find((e) => e.notebook === episode)
      const was = lane?.copies.findIndex((c) => c.id === clip.copy) ?? -1
      if (index !== undefined && was >= 0 && was < index) index -= 1
      return this.moveCopy(clip.copy, episode, index)
    }
    if (clip.mode === 'cut') this.clip = null
    return this.copyInto(clip.slide, episode, index, clip.mode === 'cut')
  }
  /** Asks what the new episode is about, in the bar; the pages go with it. */
  newEpisode(slides: string[] = []) {
    if (!this.view?.series) return
    this.naming = { slides }
    this.sel = null
    this.paint()
    this.root
      .querySelector<HTMLInputElement>('[data-map-form="episode"] input')
      ?.focus()
  }
  /** A new episode: the pages chosen, else an empty one to drop pages in. */
  async addEpisode(text: string, empty = false) {
    const series = this.view?.series
    const slides = this.naming?.slides || []
    // One click, one episode: the form goes at once and a second submit
    // while the first is in flight does nothing (review 6).
    if (this.adding) return
    this.naming = null
    this.paint()
    if (!series) return
    this.adding = true
    const said = text.trim()
    // Said what it is about and no pages: the agent picks them.
    const about = !slides.length && !empty && said ? said : undefined
    await this.run(
      () =>
        mapApi.addEpisode(series.id, {
          ...(about ? { about } : { title: said || undefined }),
          slides
        }),
      slides.length
        ? 'Episode added. Its segues are being written.'
        : about
          ? 'Episode added: the agent is picking its pages from the map.'
          : 'Empty episode added: drop pages into it.'
    ).finally(() => {
      this.adding = false
    })
    this.fitted = false
    this.paint()
  }
  /** Asks for a new title, in the bar. */
  rename(kind: 'episode' | 'series', id: string, title: string) {
    this.renaming = { kind, id, title }
    this.paint()
    const input = this.root.querySelector<HTMLInputElement>(
      '[data-map-form="rename"] input'
    )
    input?.focus()
    input?.select()
  }
  async saveTitle(title: string) {
    const renaming = this.renaming
    this.renaming = null
    if (!renaming || !title.trim() || title.trim() === renaming.title)
      return this.paint()
    await this.run(
      () =>
        renaming.kind === 'series'
          ? mapApi.renameSeries(renaming.id, title.trim())
          : mapApi.renameEpisode(renaming.id, title.trim()),
      renaming.kind === 'series'
        ? 'Series renamed'
        : 'Episode renamed: the episodes either side say its new title'
    )
  }
  /** Shows a page: selects it and brings it into view. */
  reveal(id: string) {
    const box = this.layout?.cards[id]
    this.select({ t: 'page', id })
    if (box)
      this.fit({
        x: box.x - 160,
        y: box.y - 120,
        w: box.w + 320,
        h: box.h + 240
      })
  }
  async startSeries() {
    await this.run(
      () => mapApi.startSeries(this.mapId),
      'Series started. Add its first episode.'
    )
    this.fitted = false
  }
}
