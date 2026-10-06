// The template gallery as a page of its own, opened from home, the make-video
// dialog or the video: a rail of groups, lists of stories and templates whose
// cards play in turn, a search, and a template opened to its storyboard
// player and slot list, ready to use for the open video.
import { replacePlayerView } from './player-view'
import {
  templateGalleryPage,
  templatePlayer,
  templateResults,
  templateStage,
  type GalleryState,
  type GalleryUse
} from './template-gallery-view'
import { storyStage } from './template-gallery-parts'
import { LOOP } from './template-sketch-kit'
import {
  storyById,
  storyTemplates,
  templateById
} from '../shared/video-templates'
import type { Branding } from '../shared/settings'

/** What the gallery needs to know about where it was opened from. */
export type GalleryContext = {
  look: Branding | undefined
  use: GalleryUse
  current: string | undefined
  back: string
}

const CARD_SECONDS = 4.5
const reducedMotion = () =>
  typeof matchMedia === 'function' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches

export class TemplateGallery {
  isOpen = false
  private group: GalleryState['group'] = 'all'
  private story = 'all'
  private query = ''
  private templateId: string | null = null
  private slot = 0
  private playing = true
  private tick = 0
  private cards: ReturnType<typeof setInterval> | null = null
  private player: ReturnType<typeof setTimeout> | null = null
  private context: GalleryContext = {
    look: undefined,
    use: null,
    current: undefined,
    back: 'Back'
  }
  constructor(
    private root: HTMLElement,
    private onClose: () => void,
    private onUse: (templateId: string) => void
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
  open(context: GalleryContext, templateId?: string) {
    this.context = context
    this.isOpen = true
    this.group = 'all'
    this.story = 'all'
    this.query = ''
    this.templateId = templateId && templateById(templateId) ? templateId : null
    this.slot = 0
    this.playing = !reducedMotion()
    this.draw()
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
      story: this.story,
      query: this.query,
      templateId: this.templateId,
      slot: this.slot,
      playing: this.playing,
      ...this.context
    }
  }
  private draw() {
    this.stop()
    replacePlayerView(this.root, templateGalleryPage(this.state()), null)
    if (this.templateId) this.schedulePlayer()
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
   * never blank while sketches start over: a template's card to its next
   * slot, a story's tile to its next way of telling it. Cards out of view
   * wait.
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
        const template = templateById(stage.dataset.template)
        if (!template) return
        const fresh = document.createElement('div')
        if ('tplVariants' in stage.dataset) {
          const variants = storyTemplates(template.story)
          fresh.innerHTML = storyStage(
            variants[(variants.indexOf(template) + 1) % variants.length]
          )
        } else
          fresh.innerHTML = templateStage(
            template,
            (Number(stage.dataset.slot) + 1) % template.slots.length,
            { cycle: true }
          )
        stage.replaceWith(fresh.firstElementChild!)
      })
  }
  /** The player shows each slot for one full loop of its sketch. */
  private schedulePlayer() {
    if (!this.playing) return
    this.player = setTimeout(() => {
      const template = templateById(this.templateId)
      if (!template) return
      this.showSlot((this.slot + 1) % template.slots.length)
    }, LOOP * 1000)
  }
  /** A slot change redraws the player and its chapters, nothing else. */
  private showSlot(index: number) {
    const template = templateById(this.templateId)
    if (!template) return
    this.slot = (index + template.slots.length) % template.slots.length
    if (this.player) clearTimeout(this.player)
    this.player = null
    const fresh = document.createElement('div')
    fresh.innerHTML = templatePlayer(this.state(), template)
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
  /** Goes to a list: a group, a story, or everything. */
  private list(group: GalleryState['group'], story = 'all') {
    this.group = group
    this.story = story
    this.query = ''
    this.templateId = null
    this.draw()
    window.scrollTo?.(0, 0)
  }
  private click(event: Event) {
    const target = (event.target as Element).closest<HTMLElement>(
      '[data-tpl-close],[data-tpl-group],[data-tpl-story],[data-tpl-jump],[data-tpl-try],[data-tpl-open],[data-tpl-slot],[data-tpl-step],[data-tpl-play],[data-tpl-use]'
    )
    if (!target) return
    event.preventDefault()
    event.stopPropagation()
    const data = target.dataset
    if ('tplClose' in data) return this.close()
    if (data.tplGroup) return this.list(data.tplGroup as GalleryState['group'])
    if (data.tplStory)
      return this.list(storyById(data.tplStory).group, data.tplStory)
    if (data.tplJump)
      return this.root
        .querySelector(`#tpl-story-${data.tplJump}`)
        ?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
    if (data.tplTry) {
      const field =
        this.root.querySelector<HTMLInputElement>('[data-tpl-search]')
      if (field) field.value = data.tplTry
      this.find(data.tplTry)
      return field?.focus()
    }
    if (data.tplOpen) {
      this.templateId = data.tplOpen
      this.slot = 0
      this.playing = !reducedMotion()
      this.draw()
      return window.scrollTo?.(0, 0)
    }
    if (data.tplSlot !== undefined) return this.showSlot(Number(data.tplSlot))
    if (data.tplStep) return this.showSlot(this.slot + Number(data.tplStep))
    if ('tplPlay' in data) {
      this.playing = !this.playing
      return this.showSlot(this.slot)
    }
    if (data.tplUse) {
      const id = data.tplUse
      this.stop()
      this.isOpen = false
      this.onUse(id)
    }
  }
}
