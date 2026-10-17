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
import { renderBar, hideMenu, holdsClip } from './map-bar'
import { installMapInput, type DragState } from './map-input'
import { installFlowInput, tellOrganized } from './map-flow-input'
import { queueItems, queuePill } from './map-nodes'
import {
  extent,
  mapLayout,
  type Box,
  type MapFilter,
  type MapLayout,
  type MapMode
} from './map-layout'
import { paintWorld } from './map-paint'
import {
  mapFailed,
  mapGone,
  mapNotes,
  mapPage,
  mapStages,
  mapTools
} from './map-view'
import { replacePlayerView } from './player-view'
import { MapComments } from './map-comments'
import {
  installChrome,
  noteCount,
  restoreChrome,
  restoreView
} from './map-chrome'
import { VoiceCall } from './map-voice'

export type MapSel =
  | { t: 'page'; id: string }
  | { t: 'copy'; id: string }
  | { t: 'lane'; id: string }
  | { t: 'direction'; id: string }
  | { t: 'gap'; id: string }
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
  /** Opens Settings at its API keys; Back comes back to this map. */
  openKeys: () => void
  error: (reason: unknown) => void
}

type ToastAction = { label: string; map: string }
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
  /** The bar asks how to plan the series' episodes. */
  askingPlan = false
  renaming: { kind: 'episode' | 'series'; id: string; title: string } | null =
    null
  from = ''
  changing: string | null = null
  /** Long notes the creator opened with More. */
  openNotes = new Set<string>()
  /** The episode whose last removed page Undo brings back. */
  undo: { episode: string } | null = null
  /** The direction note being written. */
  editingDirection: string | null = null
  draftDirection: import('../shared/series').Direction | null = null
  /** A connection being dragged from a node's handle: its wire's path. */
  connecting = ''
  /** The Queue is open. */
  queueOpen = false
  /** The organising run already told (null until the map's view loads); a
   * new one says what moved. */
  toldRun: string | null = null
  /** The organising stop last said, by when it stopped. */
  toldStop = ''
  /** The bar asks for a note (from the Add menu, or to fill a gap). */
  noteAsk: { text: string; gap?: string } | null = null
  /** The bar asks for the series' outcome or audience. */
  briefing: 'outcome' | 'audience' | null = null
  private adding = false
  /** A paste on its way: a second ⌘V waits for it. */
  private pasting = false
  /** The map just opened: its last view is put back once, else it fits. */
  private returning = true
  private fitted = false
  private fittedPages = 0
  private fittedLanes = 0
  private poll: ReturnType<typeof setInterval> | null = null
  private unsubscribe: (() => void) | null = null
  private toastTimer: ReturnType<typeof setTimeout> | null = null
  /** Whether the toast showing offers an action, such as Undo. */
  private toastActs = false
  /** News that waits for a toast with an action to go. */
  private toastsWaiting: Array<{ text: string; action?: ToastAction }> = []
  /** What follows the camera: Studio AI's cursor, the comments' pins. */
  readonly onCamera: Array<(animate: boolean) => void> = []
  /** Talking with Studio AI, and comments said or typed. */
  readonly voice: VoiceCall
  readonly comments: MapComments
  constructor(
    readonly root: HTMLElement,
    readonly hooks: Hooks
  ) {
    installMapInput(this)
    installFlowInput(this)
    this.voice = new VoiceCall(this)
    this.comments = new MapComments(this)
    this.voice.install()
    this.comments.install()
    installChrome(this)
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
    this.toldRun = null
    this.returning = true
    this.comments.reset()
    this.voice.recheckKey()
    this.fitted = false
    this.fittedPages = 0
    this.fittedLanes = 0
    this.els.clear()
    replacePlayerView(this.root, mapPage('Loading…'), null)
    restoreChrome(this)
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
      // A map deleted since its link was made says so, with the way back.
      // Any other failure says why on the page, with Try again, never
      // Loading… (the studio offline, for one).
      const why = reason instanceof Error ? reason.message : ''
      if (!this.isOpen || this.mapId !== id) return
      const back = from === id ? '' : from
      replacePlayerView(
        this.root,
        /not found/i.test(why) ? mapGone(back) : mapFailed(id, back, why),
        null
      )
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
    this.voice.stop()
    this.comments.reset()
    this.draftDirection = null
    this.editingDirection = null
    // A question half asked belongs to this map, not the next (review 7).
    this.noteAsk = null
    this.briefing = null
    this.naming = null
    this.changing = null
    this.renaming = null
    this.askingPlan = false
    this.toastsWaiting = []
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
    this.fill('notes', mapNotes(this.snapshot, this.openNotes, this.view))
    this.fill('note-count', noteCount(this))
    // Notes pile in any time: while the map forms they are kept, and sorted
    // once it is drawn (review 8 F01: the field was shut while it formed).
    const note = this.root.querySelector<HTMLTextAreaElement>(
      '[data-map-form="note"] textarea'
    )
    const said =
      this.snapshot.status === 'ready'
        ? 'Add a note: an idea, a link, a half-thought…'
        : 'Add a note: it joins the map once the wireframes are drawn'
    if (note && note.placeholder !== said) note.placeholder = said
    if (this.view?.series) {
      this.view.series.directions = this.view.series.directions.filter(
        (direction) => direction.id !== '__draft__'
      )
      if (this.draftDirection)
        this.view.series.directions.push(this.draftDirection)
    }
    this.layout = mapLayout(this.snapshot, this.view, this.mode)
    paintWorld(this)
    renderBar(this)
    this.fill(
      'queue',
      queuePill(queueItems(this.snapshot, this.view), this.queueOpen)
    )
    tellOrganized(this)
    this.comments.paint()
    this.voice.paint()
    // Fit once the map has its pages: at first, when the story plans them,
    // and when a plan's first episodes appear.
    const pages = this.layout ? Object.keys(this.layout.cards).length : 0
    const lanes = this.layout ? Object.keys(this.layout.lanes).length : 0
    const grew =
      (this.fittedPages === 0 && pages > 0) ||
      (this.fittedLanes === 0 && lanes > 0)
    if ((!this.fitted || grew) && this.view) {
      this.fitted = true
      this.fittedPages = pages
      this.fittedLanes = lanes
      const back = this.returning && pages > 0 && restoreView(this)
      if (pages > 0) this.returning = false
      if (!back) this.fit()
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
    for (const follow of this.onCamera) follow(animate)
  }
  /** How far the open Notes panel reaches over the canvas from its right
   * edge, as it floats over it (0 with it shut): what is fitted, or brought
   * into view from the keyboard, keeps clear of it (review 8). */
  covered(rect: { right: number }) {
    const rail = this.root.querySelector('.map-page.is-notes-open .map-rail')
    const box = rail?.getBoundingClientRect()
    return box?.width ? Math.max(0, rect.right - box.left) : 0
  }
  fit(focus?: Box) {
    if (!this.layout || !this.canvas) return
    const box = extent(this.layout, focus)
    const rect = this.canvas.getBoundingClientRect()
    // The tool bar floats on the left: what is fitted starts past it, and
    // ends before an open Notes panel.
    const left = 72
    const width = rect.width - left - 16 - this.covered(rect)
    const height = rect.height - 90
    if (width <= 0 || height <= 0) return
    const k = Math.max(0.2, Math.min(width / box.w, height / box.h, 1))
    // Too big even at the smallest zoom, it shows from its top left.
    this.camera = {
      k,
      x: left + Math.max(0, (width - box.w * k) / 2) - box.x * k,
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
  /** Shows a line under the map; news the creator did not ask for (later)
   * waits while a toast offers an action, so it never takes an Undo away. */
  toast(text: string, action?: ToastAction, later = false) {
    const node = this.slot('toast')
    if (!node) return
    if (later && !node.hidden && this.toastActs) {
      this.toastsWaiting.push({ text, action })
      return
    }
    node.innerHTML = action
      ? `<span></span><button type="button" class="quiet" data-map="${action.map}">${action.label}</button>`
      : '<span></span>'
    node.querySelector('span')!.textContent = text
    node.hidden = false
    if (this.toastTimer) clearTimeout(this.toastTimer)
    this.toastActs = Boolean(action)
    this.toastTimer = setTimeout(
      () => {
        node.hidden = true
        this.toastActs = false
        const next = this.toastsWaiting.shift()
        if (next) this.toast(next.text, next.action, true)
      },
      action ? 7000 : 3200
    )
  }
  /** What adding a note says: sorted now, or kept until the map is drawn. */
  get noteSaid() {
    return this.snapshot?.status === 'ready'
      ? 'Note added: sorting it into the map'
      : 'Note saved: it joins the map once the wireframes are drawn'
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
  /** Pastes into the selected episode. A cut stays on the clipboard until
   * it lands, so a refused paste can go somewhere else (review 8); an
   * episode with the page already says so first, as Copy to does. */
  async paste() {
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
    const lane = this.view?.episodes.find((e) => e.notebook === episode)
    if (clip.mode === 'move' && !this.episodeOf(clip.copy)) {
      this.clip = null
      this.paint()
      return this.toast('The cut page has left its episode: cut it again')
    }
    if (holdsClip(this, clip, episode))
      return this.toast(
        `Ep ${lane?.number ?? ''} has that page already: select another episode`
      )
    if (this.pasting) return
    this.pasting = true
    try {
      let landed: boolean | undefined
      if (clip.mode === 'move') {
        // In its own lane, the copy leaves first: places after it move up.
        const was = lane?.copies.findIndex((c) => c.id === clip.copy) ?? -1
        if (index !== undefined && was >= 0 && was < index) index -= 1
        landed = await this.moveCopy(clip.copy, episode, index)
      } else
        landed = await this.copyInto(
          clip.slide,
          episode,
          index,
          clip.mode === 'cut'
        )
      // A copy stays to be pasted again; a cut goes once it has landed.
      if (landed && clip.mode !== 'copy' && this.clip === clip) {
        this.clip = null
        this.paint()
      }
    } finally {
      this.pasting = false
    }
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
  /** Asks, in the bar, for the creator's episode ideas and the length. */
  askPlan() {
    this.askingPlan = true
    this.sel = null
    this.paint()
    this.root
      .querySelector<HTMLInputElement>(
        '[data-map-form="plan"] input[name=ideas]'
      )
      ?.focus()
  }
  /** Plans the series' episodes from the map: the series starts first if
   * there is none. */
  async planEpisodes(data: FormData) {
    this.askingPlan = false
    this.paint()
    // The length is the series' own, set with its slider.
    await this.run(async () => {
      const series = this.view?.series || (await mapApi.startSeries(this.mapId))
      await mapApi.planSeries(series.id, {
        ideas: String(data.get('ideas') || '').trim(),
        organize: data.get('organize') === 'on'
      })
    }, 'Planning the series: it reads every card, then the episodes take shape')
  }
  async startSeries() {
    await this.run(
      () => mapApi.startSeries(this.mapId),
      'Series started. Say what a viewer can do by the end, then plan it.'
    )
    // The series comes into view now, not at some later refresh: it
    // jumped there when the length was saved (Jev series run).
    this.fitted = false
    this.paint()
  }
}
