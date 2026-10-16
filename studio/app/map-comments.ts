// Comments on the content map, said or typed. The comment tool (C) pins one
// to a card, an episode, a direction, a gap, the series or a spot: hold the
// microphone to say it, or type it. A said comment is kept and written
// down, Jev reads what kind it is, and its thread offers that one next
// step: make it a direction, add it as a note, or ask Studio AI.
import {
  COMMENT_SECONDS,
  type CommentEntry,
  type CommentTarget,
  type MapComment
} from '../shared/voice'
import { targetWords } from './map-ai-canvas'
import type { MapCanvas } from './map-canvas'
import { mapApi } from './map-api'
import { DH, DW, type Box } from './map-layout'
import { dialogOpen, escape } from './ui'
import { voiceIcon } from './voice-icons'
import { CommentRecording } from './comment-recording'

type Point = { x: number; y: number }
type Place = { target: CommentTarget; at: Point }

const KIND_WORDS = {
  direction: 'Direction',
  material: 'Material',
  question: 'Question',
  remark: 'Remark'
} as const
const NEXT = {
  direction: ['direction', 'Make it a direction'],
  material: ['note', 'Add as a note'],
  question: ['ask', 'Ask Studio AI']
} as const

const ago = (at: string) => {
  const s = Math.max(0, (Date.now() - Date.parse(at)) / 1000)
  return s < 60
    ? 'just now'
    : s < 3600
      ? `${Math.round(s / 60)} min ago`
      : s < 86400
        ? `${Math.round(s / 3600)} h ago`
        : new Date(at).toLocaleDateString()
}
const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

/** A comment's place on the canvas, from what it is pinned to. */
export const boxOfTarget = (
  map: MapCanvas,
  target: CommentTarget
): Box | null => {
  const layout = map.layout
  if (!layout) return null
  if (target.kind === 'spot') return { x: target.x, y: target.y, w: 0, h: 0 }
  if (target.kind === 'series') return layout.head || layout.series
  if (target.kind === 'page') return layout.cards[target.id] || null
  if (target.kind === 'copy') return layout.copies[target.id] || null
  if (target.kind === 'lane') return layout.lanes[target.id] || null
  if (target.kind === 'direction') return layout.directions[target.id] || null
  return layout.gaps.find((gap) => gap.id === target.id) || null
}
const pinAt = (box: Box, target: CommentTarget): Point =>
  target.kind === 'spot'
    ? { x: box.x, y: box.y }
    : { x: box.x + box.w - 18, y: box.y + 6 }

/** What a press on the canvas pins a comment to. */
const placeOf = (map: MapCanvas, event: PointerEvent): Place | null => {
  const canvas = map.canvas?.getBoundingClientRect()
  if (!canvas) return null
  const { x, y, k } = map.camera
  const at = {
    x: (event.clientX - canvas.left - x) / k,
    y: (event.clientY - canvas.top - y) / k
  }
  const key =
    (event.target as Element).closest<HTMLElement>('.map-el')?.dataset.k || ''
  const id = key.slice(2)
  // A direction still being written is not kept yet: a comment there pins
  // to its spot on the canvas.
  const target: CommentTarget = key.startsWith('m:')
    ? { kind: 'page', id }
    : key.startsWith('c:')
      ? { kind: 'copy', id }
      : key.startsWith('L:')
        ? { kind: 'lane', id }
        : key.startsWith('d:') && id !== '__draft__'
          ? { kind: 'direction', id }
          : key.startsWith('g:')
            ? { kind: 'gap', id }
            : key === 'B:series'
              ? { kind: 'series' }
              : { kind: 'spot', x: Math.round(at.x), y: Math.round(at.y) }
  const box = boxOfTarget(map, target)
  return { target, at: box ? pinAt(box, target) : at }
}

export class MapComments {
  tool = false
  thread: string | null = null
  composer: Place | null = null
  private recording: {
    rec: CommentRecording
    for: 'new' | 'reply'
    held: boolean
  } | null = null
  /** The microphone button is held down. */
  private pressing = false
  private recordingToken = 0
  private openingMic = false
  /** Something here for Esc: a recording, thread, composer or the tool. */
  get escapable() {
    return Boolean(
      this.recording ||
      this.openingMic ||
      this.composer ||
      this.thread ||
      this.tool
    )
  }
  private sending: Place[] = []
  private ticker = 0
  private audio: HTMLAudioElement | null = null
  private playing = ''
  private drawn = { pins: '', pop: '' }
  constructor(private readonly map: MapCanvas) {}

  private get open() {
    return (this.map.view?.comments || []).filter(
      (comment) => comment.state === 'open'
    )
  }
  private stagePoint(p: Point): Point {
    const stage = this.map.root
      .querySelector('.map-stage')
      ?.getBoundingClientRect()
    const canvas = this.map.canvas?.getBoundingClientRect()
    const { x, y, k } = this.map.camera
    return {
      x: (canvas?.left ?? 0) - (stage?.left ?? 0) + x + p.x * k,
      y: (canvas?.top ?? 0) - (stage?.top ?? 0) + y + p.y * k
    }
  }

  /** A map opens: nothing of the last one's is left open. */
  reset() {
    this.cancelRecording()
    this.audio?.pause()
    this.audio = null
    this.playing = ''
    this.tool = false
    this.thread = null
    this.composer = null
    this.sending = []
  }

  /** Where a popover goes beside a pin: to its right, or to its left when
   * the right has no room, and always inside the canvas. */
  private popStyle(p: Point, height: number) {
    const stage = this.map.root
      .querySelector('.map-stage')
      ?.getBoundingClientRect()
    const width = 330
    const room = (stage?.width ?? 1200) - 12
    const left = p.x + 16 + width > room ? p.x - 16 - width : p.x + 16
    const top = Math.min(p.y + 8, (stage?.height ?? 800) - height - 12)
    return `left:${Math.round(Math.max(12, Math.min(left, room - width)))}px;top:${Math.round(Math.max(12, top))}px`
  }

  setTool(on: boolean) {
    this.cancelRecording()
    this.tool = on
    if (!on) this.composer = null
    this.paint()
  }

  private pins() {
    const seen = new Map<string, number>()
    const pin = (
      key: string,
      at: Point,
      cls: string,
      inner: string,
      label: string
    ) => {
      const n = seen.get(key) || 0
      seen.set(key, n + 1)
      return `<button type="button" class="map-pin ${cls}" ${label} style="transform:translate(${Math.round(at.x + n * 22)}px,${Math.round(at.y)}px) scale(calc(1 / var(--k, 1))) translateY(-100%)">${inner}</button>`
    }
    const placed = this.open.map((comment) => {
      const box = boxOfTarget(this.map, comment.target)
      if (!box) return ''
      const at = pinAt(box, comment.target)
      const face =
        comment.by === 'ai' ? voiceIcon('spark', 12) : voiceIcon('person', 12)
      const count = comment.replies.length
        ? `<b>${comment.replies.length + 1}</b>`
        : ''
      const said = comment.text || 'A said comment'
      return pin(
        `${Math.round(at.x)}:${Math.round(at.y)}`,
        at,
        `is-${comment.by}${this.thread === comment.id ? ' is-open' : ''}${comment.audio ? ' is-said' : ''}`,
        `<i>${face}</i>${count}`,
        `data-pin="${comment.id}" aria-label="Comment by ${comment.by === 'ai' ? 'Studio AI' : 'you'}: ${escape(said.slice(0, 80))}" title="${escape(`${comment.by === 'ai' ? 'Studio AI' : 'You'}: ${said.length > 140 ? `${said.slice(0, 139)}…` : said}`)}"`
      )
    })
    const waiting = this.sending.map((place, i) =>
      pin(
        `s${i}`,
        place.at,
        'is-creator is-sending',
        '<i></i>',
        'aria-label="Writing the comment down" disabled'
      )
    )
    return [...placed, ...waiting].join('')
  }

  private composerHtml(place: Place) {
    const at = this.stagePoint(place.at)
    const recording = this.recording?.for === 'new'
    return `<form class="map-pop map-compose" data-comment-form="new" style="${this.popStyle(at, 110)}">
<header><span>On ${escape(targetWords(place.target, this.map.snapshot, this.map.view))}</span><button type="button" class="map-pop-x" data-comment="close" aria-label="Close">${voiceIcon('close', 14)}</button></header>
${recording ? this.recordingHtml() : `<div class="map-compose-row"><button type="button" class="map-hold" data-comment-mic="new" title="Hold to talk, or click to start and stop">${voiceIcon('mic')}<span>Hold to talk</span></button><input name="text" autocomplete="off" placeholder="Or write it…" aria-label="Comment"><button type="submit" class="primary">Post</button></div>`}
</form>`
  }

  private recordingHtml() {
    const held = this.recording?.held
    return `<div class="map-recording" role="status"><button type="button" class="map-hold is-recording" data-comment-mic="stop" title="Stop and post">${voiceIcon('mic')}</button><span class="map-rec-time" data-rec-time>0:00</span><span class="map-rec-meter" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span><span class="map-rec-hint">${held ? 'Release to post' : 'Click to post'} · Esc to cancel</span></div>`
  }

  private entryHtml(entry: CommentEntry) {
    const who = entry.by === 'ai' ? 'Studio AI' : 'You'
    const play = entry.audio
      ? `<button type="button" class="map-play${this.playing === entry.audio.objectKey ? ' is-playing' : ''}" data-comment="play:${entry.audio.objectKey}" aria-label="Play the recording">${voiceIcon(this.playing === entry.audio.objectKey ? 'pause' : 'play', 12)}<span>${clock(entry.audio.seconds)}</span></button>`
      : ''
    const text = entry.text
      ? `<p>${escape(entry.text)}</p>`
      : `<p class="map-unheard">${entry.unheard ? 'Not written down: play it' : ''}</p>`
    return `<li class="map-entry is-${entry.by}"><i class="map-face is-${entry.by === 'ai' ? 'ai' : 'you'}">${entry.by === 'ai' ? voiceIcon('spark', 12) : voiceIcon('person', 12)}</i><div><p class="map-entry-meta"><b>${who}</b><span>${ago(entry.at)}</span>${play}</p>${text}</div></li>`
  }

  /** The other next steps, and Delete, behind More. */
  private moreHtml(
    comment: MapComment,
    others: ReadonlyArray<readonly [string, string]>
  ) {
    return `<details class="map-thread-more"><summary>More</summary><div>${others.map(([action, label]) => `<button type="button" data-comment="${action}:${comment.id}">${label}</button>`).join('')}<button type="button" class="danger" data-comment="remove:${comment.id}">Delete</button></div></details>`
  }

  private threadHtml(comment: MapComment) {
    const box = boxOfTarget(this.map, comment.target)
    const at = this.stagePoint(
      box ? pinAt(box, comment.target) : { x: 0, y: 0 }
    )
    const kind = comment.kind
      ? `<span class="map-kind" title="Jev read this as ${KIND_WORDS[comment.kind].toLowerCase()}${comment.sure ? ` (${Math.round(comment.sure * 100)}% sure)` : ''}">${KIND_WORDS[comment.kind]}</span>`
      : ''
    const next =
      comment.kind && comment.kind !== 'remark' ? NEXT[comment.kind] : null
    const others = (
      Object.values(NEXT) as ReadonlyArray<readonly [string, string]>
    ).filter(([action]) => action !== next?.[0])
    const recording = this.recording?.for === 'reply'
    return `<section class="map-pop map-thread" role="dialog" aria-label="Comment" style="${this.popStyle(at, 330)}">
<header><span>On ${escape(targetWords(comment.target, this.map.snapshot, this.map.view))}</span>${kind}<button type="button" class="map-pop-x" data-comment="close" aria-label="Close">${voiceIcon('close', 14)}</button></header>
<ol class="map-thread-list">${[comment, ...comment.replies].map((entry) => this.entryHtml(entry)).join('')}</ol>
<div class="map-thread-actions">${next ? `<button type="button" class="primary" data-comment="${next[0]}:${comment.id}">${next[1]}</button>` : ''}<button type="button" class="quiet" data-comment="resolve:${comment.id}">Resolve</button>${this.moreHtml(comment, others)}</div>
<form class="map-reply" data-comment-form="reply">${recording ? this.recordingHtml() : `<button type="button" class="map-hold is-small" data-comment-mic="reply" title="Hold to talk, or click to start and stop">${voiceIcon('mic', 14)}</button><input name="text" autocomplete="off" placeholder="Reply…" aria-label="Reply"><button type="submit" class="map-call-btn" aria-label="Send">${voiceIcon('send', 14)}</button>`}</form>
</section>`
  }

  /** Pins on the canvas, and the composer or a thread over it. */
  paint() {
    const world = this.map.world
    const stage = this.map.root.querySelector('.map-stage')
    if (!world || !stage) return
    let layer = world.querySelector<HTMLElement>('.map-pins')
    if (!layer) {
      layer = document.createElement('div')
      layer.className = 'map-pins'
      layer.style.setProperty('--k', String(this.map.camera.k))
      world.appendChild(layer)
      this.drawn.pins = ''
    }
    const pins = this.pins()
    if (pins !== this.drawn.pins) {
      layer.innerHTML = pins
      this.drawn.pins = pins
    }
    let pop = stage.querySelector<HTMLElement>('.map-pops')
    if (!pop) {
      pop = document.createElement('div')
      pop.className = 'map-pops'
      stage.appendChild(pop)
      this.drawn.pop = ''
    }
    const thread = this.thread
      ? this.open.find((comment) => comment.id === this.thread)
      : undefined
    // A thread resolved or removed elsewhere takes its reply with it.
    if (this.thread && !thread) {
      this.cancelRecording()
      this.thread = null
    }
    const hint =
      this.tool && !this.composer
        ? '<p class="map-comment-hint" role="status">Click where the comment goes · Esc to stop</p>'
        : ''
    const html =
      hint +
      (this.composer
        ? this.composerHtml(this.composer)
        : thread
          ? this.threadHtml(thread)
          : '')
    if (html !== this.drawn.pop) {
      const draft = pop.querySelector<HTMLInputElement>('input[name=text]')
      const focused = draft === document.activeElement
      pop.innerHTML = html
      this.drawn.pop = html
      const input = pop.querySelector<HTMLInputElement>('input[name=text]')
      if (input && draft) input.value = draft.value
      if (input && focused) input.focus()
    }
    this.map.canvas?.classList.toggle('is-commenting', this.tool)
    const button = this.map.root.querySelector<HTMLElement>(
      '[data-comment="tool"]'
    )
    button?.setAttribute('aria-pressed', String(this.tool))
  }

  private async startRecording(kind: 'new' | 'reply') {
    if (this.recording || this.openingMic) return
    const token = ++this.recordingToken
    const thread = this.thread
    const composer = this.composer
    this.openingMic = true
    try {
      const rec = await CommentRecording.start()
      if (
        token !== this.recordingToken ||
        !this.map.isOpen ||
        thread !== this.thread ||
        composer !== this.composer
      ) {
        rec.cancel()
        return
      }
      // Let go before the microphone opened: a click, so the next stops it.
      this.recording = { rec, for: kind, held: this.pressing }
    } catch {
      if (token !== this.recordingToken) return
      this.map.toast(
        'The microphone is off: allow it in the browser, or type the comment'
      )
      return
    } finally {
      if (token === this.recordingToken) this.openingMic = false
    }
    this.paint()
    const tick = () => {
      const recording = this.recording
      if (!recording) return
      const seconds = recording.rec.seconds
      const pop = this.map.root.querySelector<HTMLElement>('.map-pops')
      const time = pop?.querySelector('[data-rec-time]')
      if (time) time.textContent = clock(seconds)
      pop?.style.setProperty('--rec', recording.rec.level().toFixed(3))
      if (seconds >= COMMENT_SECONDS) return void this.finishRecording()
      this.ticker = requestAnimationFrame(tick)
    }
    this.ticker = requestAnimationFrame(tick)
  }

  /** The thread closes; a reply being said to it goes too (review 7). */
  private closeThread() {
    this.cancelRecording()
    this.thread = null
    this.paint()
  }

  private cancelRecording() {
    this.recordingToken++
    this.openingMic = false
    this.pressing = false
    cancelAnimationFrame(this.ticker)
    this.recording?.rec.cancel()
    this.recording = null
  }

  private async finishRecording() {
    const recording = this.recording
    if (!recording) return
    cancelAnimationFrame(this.ticker)
    this.recording = null
    const token = this.recordingToken
    const mapId = this.map.mapId
    const thread = this.thread
    const composer = this.composer
    const { blob, seconds } = await recording.rec.stop()
    if (
      token !== this.recordingToken ||
      !this.map.isOpen ||
      mapId !== this.map.mapId ||
      thread !== this.thread ||
      composer !== this.composer
    )
      return
    if (seconds < 0.6 || blob.size < 400) {
      this.map.toast('Too short to keep: hold the microphone while you talk')
      return this.paint()
    }
    const place = recording.for === 'new' ? this.composer : null
    const meta =
      recording.for === 'reply'
        ? { reply: this.thread, seconds }
        : place
          ? {
              target: place.target,
              seconds,
              about: targetWords(place.target, this.map.snapshot, this.map.view)
            }
          : null
    if (!meta) return this.paint()
    if (place) {
      // One press, one comment: C comments again.
      this.sending.push(place)
      this.composer = null
      this.tool = false
    }
    this.paint()
    try {
      const response = await fetch(
        `/api/projects/${this.map.mapId}/comments/voice`,
        {
          method: 'PUT',
          headers: {
            'content-type': blob.type || 'audio/webm',
            'x-studio-comment': encodeURIComponent(JSON.stringify(meta))
          },
          body: blob
        }
      )
      const body = (await response.json()) as {
        comments?: MapComment[]
        error?: string
      }
      if (!response.ok || !body.comments)
        throw new Error(body.error || 'The comment could not be kept')
      this.take(body.comments)
      const latest = place
        ? body.comments.at(-1)
        : body.comments.find((c) => c.id === this.thread)
      const entry = place ? latest : latest?.replies.at(-1)
      this.map.toast(
        entry?.text
          ? 'Comment kept and written down'
          : 'Comment kept; it could not be written down'
      )
    } catch (reason) {
      this.map.hooks.error(reason)
    } finally {
      if (place) this.sending = this.sending.filter((p) => p !== place)
      this.paint()
    }
  }

  /** The comments as the engine has them now. */
  private take(comments: MapComment[]) {
    if (this.map.view) this.map.view.comments = comments
    this.map.paint()
  }

  private async act(action: string, id: string) {
    const comment = this.open.find((c) => c.id === id)
    if (!comment) return
    const mapId = this.map.mapId
    const resolve = async (outcome: string) =>
      this.take(
        (await mapApi.comments(mapId, { action: 'resolve', id, outcome }))
          .comments
      )
    try {
      if (action === 'resolve') {
        this.closeThread()
        await resolve('')
      } else if (action === 'remove') {
        this.closeThread()
        this.take(
          (await mapApi.comments(mapId, { action: 'remove', id })).comments
        )
      } else if (action === 'note') {
        if (!comment.text)
          return this.map.toast('Write it down first: it was not heard')
        // On an open gap, the note fills it, as the gap's own note does.
        const on = comment.target.kind === 'gap' ? comment.target.id : ''
        const gap = this.map.view?.series?.gaps.some(
          (entry) => entry.id === on && entry.state === 'open'
        )
          ? on
          : undefined
        await mapApi.note(mapId, comment.text, gap)
        this.closeThread()
        await resolve('Added as a note')
        this.map.toast(
          gap
            ? 'Added as a note: organising puts it where the gap is'
            : 'Added as a note: it is being sorted into cards'
        )
      } else if (action === 'direction') {
        const series = this.map.view?.series
        if (!series)
          return this.map.toast(
            'Start a series first: directions guide its plan'
          )
        if (!comment.text)
          return this.map.toast('Write it down first: it was not heard')
        const target = comment.target
        const to =
          target.kind === 'lane'
            ? { episode: target.id }
            : target.kind === 'page'
              ? { pages: [target.id] }
              : target.kind === 'copy' && this.map.episodeOf(target.id)
                ? { episode: this.map.episodeOf(target.id)!.notebook }
                : null
        const box = boxOfTarget(this.map, target)
        const spot = box
          ? { x: Math.round(box.x - DW - 40), y: Math.round(box.y - DH / 2) }
          : undefined
        await mapApi.direction(series.id, {
          text: comment.text,
          to,
          ...(spot ? { spot } : {})
        })
        this.closeThread()
        await resolve('Made a direction')
        await this.map.refresh()
        this.map.toast('Made a direction: the next plan answers it')
      } else if (action === 'ask') {
        const about = targetWords(
          comment.target,
          this.map.snapshot,
          this.map.view
        )
        const said =
          comment.text || '(a said comment that was not written down)'
        this.closeThread()
        this.paint()
        this.map.voice.say(`About my comment on ${about}: ${said}`)
        this.map.toast('Asked Studio AI')
      }
    } catch (reason) {
      this.map.hooks.error(reason)
    }
  }

  private togglePlay(key: string) {
    if (this.playing === key) {
      this.audio?.pause()
      this.playing = ''
      return this.paint()
    }
    this.audio?.pause()
    this.audio = new Audio(`/objects/${encodeURIComponent(key)}`)
    this.playing = key
    this.audio.onended = () => {
      this.playing = ''
      this.paint()
    }
    void this.audio.play().catch(() => {
      this.playing = ''
      this.paint()
    })
    this.paint()
  }

  private async submit(form: HTMLFormElement) {
    const input = form.querySelector<HTMLInputElement>('input[name=text]')
    const text = input?.value.trim() || ''
    if (!text) return
    if (input) input.value = ''
    try {
      if (form.dataset.commentForm === 'new' && this.composer) {
        const place = this.composer
        this.composer = null
        this.tool = false
        this.take(
          (
            await mapApi.comments(this.map.mapId, {
              action: 'add',
              target: place.target,
              text,
              about: targetWords(place.target, this.map.snapshot, this.map.view)
            })
          ).comments
        )
        this.thread = this.open.at(-1)?.id || null
      } else if (form.dataset.commentForm === 'reply' && this.thread) {
        this.take(
          (
            await mapApi.comments(this.map.mapId, {
              action: 'reply',
              id: this.thread,
              text
            })
          ).comments
        )
      }
      this.paint()
    } catch (reason) {
      this.map.hooks.error(reason)
    }
  }

  /** The tool, pins, the composer and threads, and holding to talk. */
  install() {
    const root = this.map.root
    root.addEventListener(
      'pointerdown',
      (event) => {
        if (!this.map.isOpen || event.button !== 0) return
        const target = event.target as Element
        const mic = target.closest<HTMLElement>('[data-comment-mic]')
        if (mic) {
          event.preventDefault()
          const kind = mic.dataset.commentMic
          if (kind === 'stop') return void this.finishRecording()
          this.pressing = true
          return void this.startRecording(kind === 'reply' ? 'reply' : 'new')
        }
        if (target.closest('.map-pin, .map-pop')) return event.stopPropagation()
        if (!this.tool || !target.closest('[data-map-canvas]')) return
        if (target.closest('button, a, input, textarea, .map-port')) return
        event.preventDefault()
        event.stopPropagation()
        const place = placeOf(this.map, event)
        if (!place) return
        this.cancelRecording()
        this.thread = null
        this.composer = place
        this.paint()
        root
          .querySelector<HTMLInputElement>('[data-comment-form="new"] input')
          ?.focus()
      },
      true
    )
    // A long press records while held; a quick click starts, the next stops.
    root.addEventListener('pointerup', () => {
      this.pressing = false
      const recording = this.recording
      if (!recording?.held) return
      if (recording.rec.seconds > 0.45) void this.finishRecording()
      else {
        recording.held = false
        this.paint()
      }
    })
    root.addEventListener('click', (event) => {
      const target = event.target as Element
      const pin = target.closest<HTMLElement>('[data-pin]')
      if (pin) {
        this.cancelRecording()
        this.composer = null
        this.thread =
          this.thread === pin.dataset.pin ? null : pin.dataset.pin || null
        return this.paint()
      }
      const button = target.closest<HTMLElement>('[data-comment]')
      if (!button) return
      const [action, arg] = (button.dataset.comment || '').split(/:(.*)/s)
      if (action === 'tool') return this.setTool(!this.tool)
      if (action === 'close') {
        this.cancelRecording()
        this.composer = null
        this.thread = null
        return this.paint()
      }
      if (action === 'play') return this.togglePlay(arg)
      void this.act(action, arg)
    })
    root.addEventListener(
      'submit',
      (event) => {
        const form = (event.target as Element).closest<HTMLFormElement>(
          '[data-comment-form]'
        )
        if (!form) return
        event.preventDefault()
        event.stopPropagation()
        void this.submit(form)
      },
      true
    )
    globalThis.addEventListener?.('keydown', (event) => {
      if (!this.map.isOpen || event.defaultPrevented || dialogOpen()) return
      const e = event as KeyboardEvent
      const typing = (e.target as Element)?.closest?.(
        'input, textarea, select, [contenteditable]'
      )
      const menu = this.map.slot('menu')
      if (e.key === 'Escape' && this.escapable) {
        const recording = this.recording || this.openingMic
        // One at a time: a menu over it first; typed words leave the field.
        if (menu && !menu.hidden) return
        const words = (typing as HTMLTextAreaElement | null)?.value?.trim()
        e.preventDefault()
        e.stopImmediatePropagation()
        if (!recording && words) return (typing as HTMLElement).blur()
        if (recording) this.cancelRecording()
        else if (this.composer || this.thread) {
          this.composer = null
          this.thread = null
        } else this.tool = false
        return this.paint()
      }
      if (
        typing ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        (menu && !menu.hidden)
      )
        return
      if (e.key.toLowerCase() === 'c') {
        e.preventDefault()
        this.setTool(!this.tool)
      }
    })
    this.map.onCamera.push(() => {
      this.map.world
        ?.querySelector<HTMLElement>('.map-pins')
        ?.style.setProperty('--k', String(this.map.camera.k))
      if (this.composer || this.thread) {
        this.drawn.pop = ''
        this.paint()
      }
    })
  }
}
