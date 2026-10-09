// The template gallery as a page of its own, opened from home, the make-video
// dialog or the video: a rail of groups, lists of templates whose cards walk
// their beats in turn, a search, and a template opened to its directions and
// its beats, ready to use for the open video.
import { replacePlayerView } from './player-view'
import {
  templateGalleryPage,
  templatePlayer,
  templateResults,
  type GalleryState,
  type GalleryUse
} from './template-gallery-view'
import { nextStage, telling } from './template-gallery-parts'
import { LOOP } from './template-sketch-kit'
import { narrativeById, presetFor, type PresetId } from '../shared/narratives'
import type { Branding } from '../shared/settings'

/** What the gallery needs to know about where it was opened from. */
export type GalleryContext = {
  look: Branding | undefined
  use: GalleryUse
  current: GalleryState['current']
  back: string
  /** The templates suggested for this post, best first. */
  suggested?: string[]
}

const CARD_SECONDS = 4.5
const reducedMotion = () =>
  typeof matchMedia === 'function' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches

export class TemplateGallery {
  isOpen = false
  private group: GalleryState['group'] = 'all'
  private query = ''
  private narrative: string | null = null
  private preset: PresetId | null = null
  private beat = 0
  private playing = true
  private tick = 0
  private cards: ReturnType<typeof setInterval> | null = null
  private player: ReturnType<typeof setTimeout> | null = null
  private context: GalleryContext = {
    look: undefined,
    use: null,
    current: {},
    back: 'Back'
  }
  constructor(
    private root: HTMLElement,
    private onClose: () => void,
    private onUse: (narrative: string, preset: PresetId) => void
  ) {
    root.addEventListener('click', (event) => {
      if (this.isOpen) this.click(event)
    })
    root.addEventListener('input', (event) => {
      if (this.isOpen) this.search(event)
    })
    globalThis.addEventListener?.('keydown', (event) => {
      if (this.isOpen) this.key(event as KeyboardEvent)
    })
  }
  open(context: GalleryContext, narrative?: string) {
    this.context = context
    this.isOpen = true
    this.group = 'all'
    this.query = ''
    this.show(narrative && narrativeById(narrative) ? narrative : null)
    window.scrollTo?.(0, 0)
  }
  close() {
    if (!this.isOpen) return
    this.dismiss()
    this.onClose()
  }
  /** Leaves without drawing what is behind, for a caller that draws next. */
  dismiss() {
    this.stop()
    this.isOpen = false
  }
  private state(): GalleryState {
    return {
      group: this.group,
      query: this.query,
      narrative: this.narrative,
      preset: this.preset,
      beat: this.beat,
      playing: this.playing,
      ...this.context
    }
  }
  /** Opens a template on the video's own direction, else its default. */
  private show(id: string | null) {
    const narrative = narrativeById(id)
    this.narrative = narrative?.id ?? null
    this.preset = narrative
      ? presetFor(
          narrative,
          this.context.current.narrative === narrative.id
            ? this.context.current.preset
            : null
        )
      : null
    this.beat = 0
    this.playing = !reducedMotion()
    this.draw()
  }
  private draw() {
    this.stop()
    replacePlayerView(this.root, templateGalleryPage(this.state()), null)
    if (this.narrative) this.schedulePlayer()
    else if (!reducedMotion())
      this.cards = setInterval(
        () => this.advanceCards(),
        (CARD_SECONDS / 3) * 1000
      )
  }
  private stop() {
    if (this.cards) clearInterval(this.cards)
    if (this.player) clearTimeout(this.player)
    this.cards = null
    this.player = null
  }
  /**
   * The cards move on in turn, a third of them at each tick, so the grid is
   * never blank while sketches start over: each card to its next beat.
   * Cards out of view wait.
   */
  private advanceCards() {
    this.tick++
    const height = window.innerHeight || 0
    this.root
      .querySelectorAll<HTMLElement>('[data-tpl-cycle]')
      .forEach((stage, index) => {
        if ((this.tick + index) % 3) return
        const box = stage.getBoundingClientRect?.()
        if (box && height && (box.bottom < 0 || box.top > height)) return
        const markup = nextStage(stage)
        if (!markup) return
        const fresh = document.createElement('div')
        fresh.innerHTML = markup
        stage.replaceWith(fresh.firstElementChild!)
      })
  }
  /** The player shows each beat for one full loop of its sketch. */
  private schedulePlayer() {
    if (!this.playing) return
    this.player = setTimeout(() => this.showBeat(this.beat + 1), LOOP * 1000)
  }
  /** A beat change redraws the player and its chapters, nothing else. */
  private showBeat(index: number) {
    const narrative = narrativeById(this.narrative)
    if (!narrative) return
    const count = telling(narrative, this.preset).told.length
    this.beat = ((index % count) + count) % count
    if (this.player) clearTimeout(this.player)
    this.player = null
    const fresh = document.createElement('div')
    fresh.innerHTML = templatePlayer(this.state(), narrative)
    this.root
      .querySelector('.tpl-player')
      ?.replaceWith(fresh.firstElementChild!)
    this.schedulePlayer()
  }
  /** A search redraws the results only, so the field keeps its focus. */
  private search(event: Event) {
    const field = event.target as HTMLInputElement
    if (!field.matches?.('[data-tpl-search]')) return
    this.find(field.value)
  }
  private find(query: string) {
    this.query = query
    const results = this.root.querySelector('.tpl-results')
    if (results) results.innerHTML = templateResults(this.state())
  }
  /** "/" goes to the search field from anywhere on the page but a field. */
  private key(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null
    if (
      event.key !== '/' ||
      event.metaKey ||
      event.ctrlKey ||
      target?.closest?.('input, textarea, select, [contenteditable="true"]')
    )
      return
    const field = this.root.querySelector<HTMLInputElement>('[data-tpl-search]')
    if (!field) return
    event.preventDefault()
    field.focus()
  }
  /** Goes to a list: a group, or everything. */
  private list(group: GalleryState['group']) {
    this.group = group
    this.query = ''
    this.narrative = null
    this.draw()
    window.scrollTo?.(0, 0)
  }
  private click(event: Event) {
    const target = (event.target as Element).closest<HTMLElement>(
      '[data-tpl-close],[data-tpl-group],[data-tpl-try],[data-tpl-open],[data-tpl-preset],[data-tpl-beat],[data-tpl-step],[data-tpl-play],[data-tpl-use]'
    )
    if (!target) return
    event.preventDefault()
    event.stopPropagation()
    const data = target.dataset
    if ('tplClose' in data) return this.close()
    if (data.tplGroup) return this.list(data.tplGroup as GalleryState['group'])
    if (data.tplTry) {
      const field =
        this.root.querySelector<HTMLInputElement>('[data-tpl-search]')
      if (field) field.value = data.tplTry
      this.find(data.tplTry)
      return field?.focus()
    }
    if (data.tplOpen) {
      this.show(data.tplOpen)
      return window.scrollTo?.(0, 0)
    }
    if (data.tplPreset) {
      this.preset = data.tplPreset as PresetId
      this.beat = 0
      return this.draw()
    }
    if (data.tplBeat !== undefined) return this.showBeat(Number(data.tplBeat))
    if (data.tplStep) return this.showBeat(this.beat + Number(data.tplStep))
    if ('tplPlay' in data) {
      this.playing = !this.playing
      return this.showBeat(this.beat)
    }
    if (data.tplUse) {
      const narrative = narrativeById(data.tplUse)
      if (!narrative) return
      this.stop()
      this.isOpen = false
      this.onUse(narrative.id, presetFor(narrative, data.preset))
    }
  }
}
