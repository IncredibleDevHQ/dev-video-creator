// Talking with Studio AI on the content map. Talk opens a call: the
// microphone streams to the engine (which holds the Realtime connection and
// its key), Studio AI's voice plays as it comes, the creator's words show
// as a caption with Jev's reading of them, its words in a bubble by its
// cursor, and each tool it calls runs here, one at a time, with that cursor.
import type {
  VoiceClientMessage,
  VoiceIntent,
  VoiceReading,
  VoiceServerMessage
} from '../shared/voice'
import { Aliases, canvasText, heldWords } from './map-ai-canvas'
import { AiCursor } from './map-ai'
import { runAiTool } from './map-ai-tools'
import type { MapCanvas } from './map-canvas'
import { escape } from './ui'
import { openMic, VoicePlayer, type Mic } from './voice-audio'
import { voiceIcon } from './voice-icons'
import { TALK_TIP } from './map-view'

const NEEDS_KEY = 'Studio AI needs an OpenAI key · click to set up'

type CallState =
  | 'off'
  | 'joining'
  | 'listening'
  | 'hearing'
  | 'thinking'
  | 'speaking'
  | 'acting'

const STATE_WORDS: Record<CallState, string> = {
  off: '',
  joining: 'Joining…',
  listening: 'Listening',
  hearing: 'Hearing you…',
  thinking: 'Thinking…',
  speaking: 'Speaking',
  acting: 'Working on the canvas'
}
export const INTENT_LABEL: Record<VoiceIntent, string> = {
  plan: 'Planning',
  direction: 'Direction',
  material: 'New material',
  episode: 'Episodes',
  brief: 'Outcome and audience',
  gap: 'Gap',
  comment: 'Comment',
  question: 'Question',
  chat: 'Chat'
}

/** Jev's reading as a chip: what it heard, and whether it asks for a change. */
export const readingChip = (
  reading: VoiceReading | null | undefined,
  jev: boolean
) => {
  if (reading === undefined) return ''
  if (!reading)
    return `<span class="map-reading is-missing" title="${jev ? 'Jev could not read this one' : 'Add TYPESAFE_API_KEY to .env for Jev'}">Not classified</span>`
  const top = Object.entries(reading.probabilities)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(
      ([key, p]) =>
        `${INTENT_LABEL[key as VoiceIntent]} ${Math.round(p * 100)}%`
    )
    .join(' · ')
  const asks =
    reading.yes >= 0.5
      ? 'said yes'
      : reading.act >= 0.5
        ? 'asks for a change'
        : 'no change'
  return `<span class="map-reading${reading.act >= 0.5 ? ' is-act' : ''}" title="Jev: ${escape(top)}"><b>${INTENT_LABEL[reading.intent]}</b> · ${asks}</span>`
}

/** What the creator has selected, as Studio AI can name it. */
const selectedWords = (map: MapCanvas, aliases: Aliases) => {
  const sel = map.sel
  if (!sel) return ''
  if (sel.t === 'series') return 'the series'
  if (sel.t === 'page') {
    const title = map.snapshot?.project.slides.find(
      (s) => s.id === sel.id
    )?.title
    return `the card “${title || ''}” (${aliases.of('c', sel.id)})`
  }
  if (sel.t === 'lane') {
    const ep = map.view?.episodes.find((e) => e.notebook === sel.id)
    return ep
      ? `Ep ${ep.number} “${ep.title}” (${aliases.of('e', sel.id)})`
      : ''
  }
  if (sel.t === 'direction') return `the direction ${aliases.of('d', sel.id)}`
  if (sel.t === 'gap') {
    const gap = map.view?.series?.gaps.find((g) => g.id === sel.id)
    return gap ? `the gap “${gap.missing}”` : ''
  }
  const ep = map.episodeOf(sel.id)
  const copy = ep?.copies.find((c) => c.id === sel.id)
  return ep && copy
    ? `“${copy.title}” in Ep ${ep.number} (${aliases.of('e', ep.notebook)})`
    : ''
}

export class VoiceCall {
  state: CallState = 'off'
  readonly cursor: AiCursor
  readonly aliases = new Aliases()
  private socket: WebSocket | null = null
  private generation = 0
  private mic: Mic | null = null
  private micBlocked = false
  private needsKey = false
  private player: VoicePlayer | null = null
  private jev = false
  private you: { item: string; text: string; reading?: VoiceReading | null } = {
    item: '',
    text: ''
  }
  private held = ''
  private reason = ''
  private sent = ''
  private waiting: string[] = []
  private typing = false
  private tools: Promise<unknown> = Promise.resolve()
  private frame = 0
  private level = 0
  private fade: ReturnType<typeof setTimeout> | null = null
  private drawn = ''
  constructor(private readonly map: MapCanvas) {
    this.cursor = new AiCursor(map)
  }
  get on() {
    return this.state !== 'off'
  }

  /** Opens the call. Studio AI joins once the engine says it is ready. */
  start() {
    if (this.on) return
    if (this.needsKey) {
      // Nothing waits for a call that can't start (review 7).
      this.waiting = []
      this.showSetup()
      return
    }
    this.generation++
    this.micBlocked = false
    this.held = ''
    this.state = 'joining'
    this.reason = ''
    this.sent = ''
    this.paint()
    try {
      this.player = new VoicePlayer()
      void this.player.resume()
      const scheme = location.protocol === 'https:' ? 'wss' : 'ws'
      const socket = new WebSocket(
        `${scheme}://${location.host}/api/projects/${this.map.mapId}/voice`
      )
      socket.binaryType = 'arraybuffer'
      this.socket = socket
      socket.onopen = () => {
        if (this.socket === socket) this.context(true)
      }
      socket.onmessage = (event) => {
        if (this.socket !== socket) return
        try {
          this.receive(JSON.parse(String(event.data)) as VoiceServerMessage)
        } catch {
          // Not a message of the call's.
        }
      }
      socket.onclose = () => {
        if (this.socket === socket) this.end(this.reason || 'The call ended')
      }
      socket.onerror = () => {
        if (this.socket !== socket) return
        this.reason ||= 'Studio AI could not be reached'
      }
    } catch {
      this.end('Studio AI could not be reached')
    }
  }

  /** Ends the call from this side. */
  stop() {
    if (!this.on) return
    this.send({ type: 'stop' })
    this.end('')
  }

  private end(reason: string) {
    if (!this.on) return
    this.generation++
    this.waiting = []
    this.tools = Promise.resolve()
    if (this.fade) clearTimeout(this.fade)
    this.state = 'off'
    this.mic?.stop()
    this.mic = null
    this.player?.close()
    this.player = null
    const socket = this.socket
    this.socket = null
    try {
      socket?.close()
    } catch {
      // Already closed.
    }
    cancelAnimationFrame(this.frame)
    this.cursor.hide()
    this.you = { item: '', text: '' }
    this.typing = false
    this.paint()
    if (reason) this.map.toast(reason)
  }

  private showSetup() {
    const button = this.map.root.querySelector<HTMLElement>(
      '[data-voice="talk"]'
    )
    const menu = this.map.slot('menu')
    const stage = this.map.root.querySelector('.map-stage')
    if (!button || !menu || !stage) return
    menu.className = 'map-menu is-setup'
    // Not any menu's: the next menu click opens that menu (review 7).
    delete menu.dataset.for
    menu.innerHTML =
      '<div role="dialog" aria-labelledby="map-setup-title"><p id="map-setup-title">Studio AI needs an OpenAI key</p><button type="button" class="primary" data-map="keys">Add a key in Settings</button><button type="button" data-voice="check-key">Try connecting again</button></div>'
    menu.hidden = false
    const anchor = button.getBoundingClientRect(),
      bounds = stage.getBoundingClientRect()
    menu.style.left = `${Math.max(8, Math.min(bounds.width - 300, anchor.right - bounds.left + 8))}px`
    menu.style.top = `${Math.max(8, Math.min(bounds.height - menu.offsetHeight - 8, anchor.top - bounds.top))}px`
    menu.querySelector<HTMLElement>('.primary')?.focus()
  }

  /** Words for Studio AI, typed or from a comment; a call opens if needed. */
  say(text: string) {
    if (!text.trim()) return
    if (this.state === 'off' || this.state === 'joining') {
      this.waiting.push(text)
      return this.start()
    }
    this.send({ type: 'say', text })
  }

  /** The canvas changed: Studio AI reads it again. */
  context(force = false) {
    if (this.socket?.readyState !== WebSocket.OPEN) return
    const text = canvasText(
      this.map.snapshot,
      this.map.view,
      this.aliases,
      selectedWords(this.map, this.aliases)
    )
    if (!force && text === this.sent) return
    this.sent = text
    this.send({ type: 'context', text })
  }

  private send(message: VoiceClientMessage) {
    if (this.socket?.readyState === WebSocket.OPEN)
      this.socket.send(JSON.stringify(message))
  }

  private async ready(jev: boolean) {
    this.jev = jev
    const generation = this.generation
    const socket = this.socket
    try {
      const mic = await openMic((pcm, level) => {
        if (generation !== this.generation || socket !== this.socket) return
        this.level = level
        if (socket?.readyState === WebSocket.OPEN) socket.send(pcm)
      })
      if (generation !== this.generation || !this.on) return mic.stop()
      this.mic?.stop()
      this.mic = mic
    } catch {
      if (generation !== this.generation || !this.on) return
      // Without a microphone the call still takes typed words.
      this.micBlocked = true
      this.typing = true
    }
    if (!this.on) return this.mic?.stop()
    this.set('listening')
    this.cursor.show()
    for (const text of this.waiting.splice(0)) this.send({ type: 'say', text })
    this.meter()
  }

  private set(state: CallState) {
    if (!this.on || this.state === state) return
    this.state = state
    this.paint()
  }

  private receive(message: VoiceServerMessage) {
    switch (message.type) {
      case 'ready':
        return void this.ready(message.jev)
      case 'speech':
        if (message.state === 'started') {
          // Talked over: the voice stops, and the AI learns what was heard.
          const heard = this.player?.stop()
          if (heard) this.send({ type: 'played', ...heard })
          this.cursor.say('', true)
          this.set('hearing')
        } else this.set('thinking')
        return
      case 'you':
        this.you = {
          item: message.item,
          text: message.text,
          ...(this.you.item === message.item && this.you.reading !== undefined
            ? { reading: this.you.reading }
            : {})
        }
        this.held = ''
        return this.caption(message.final)
      case 'reading':
        if (message.item !== this.you.item) return
        this.you.reading = message.reading
        return this.caption(true)
      case 'ai':
        return this.cursor.say(message.text, message.final)
      case 'audio':
        this.player?.push(message.item, message.data)
        if (this.state !== 'acting') this.set('speaking')
        return
      case 'busy':
        if (message.state === 'thinking' && this.state !== 'acting')
          this.set('thinking')
        return
      case 'tool': {
        const generation = this.generation
        this.tools = this.tools.then(() =>
          this.run(message.call, message.name, message.args, generation)
        )
        return
      }
      case 'held':
        this.held = message.why
        return this.caption(true)
      case 'error':
        if (message.code === 'no-key') {
          this.needsKey = true
          this.reason = ''
          this.end('')
          this.showSetup()
          return
        }
        this.reason = message.message
        return this.map.toast(message.message)
      case 'closed':
        this.reason = message.reason
        return
    }
  }

  private async run(
    call: string,
    name: string,
    args: Record<string, unknown>,
    generation: number
  ) {
    const active = () => this.on && generation === this.generation
    if (!active()) return
    this.set('acting')
    const output = await runAiTool(
      this.map,
      this.cursor,
      this.aliases,
      name,
      args,
      active
    )
    if (!active()) return
    this.context()
    this.send({ type: 'tool_result', call, output })
    this.set(this.player?.speaking ? 'speaking' : 'listening')
  }

  /** The level meters, and back to listening once the voice has played. */
  private meter() {
    cancelAnimationFrame(this.frame)
    const tick = () => {
      if (!this.on) return
      const dock = this.map.root.querySelector<HTMLElement>('.map-voice')
      const speaking = Boolean(this.player?.speaking)
      dock?.style.setProperty(
        '--you',
        this.mic?.muted ? '0' : Math.min(1, this.level * 6).toFixed(3)
      )
      const voice = speaking ? (this.player?.level() ?? 0) : 0
      dock?.style.setProperty('--ai', voice.toFixed(3))
      // Its cursor glows with its voice, as Figma pulses a speaker's cursor.
      this.cursor.voice(voice)
      if (this.state === 'speaking' && !speaking) this.set('listening')
      this.frame = requestAnimationFrame(tick)
    }
    this.frame = requestAnimationFrame(tick)
  }

  private caption(final: boolean) {
    if (this.fade) clearTimeout(this.fade)
    this.paint()
    if (final)
      this.fade = setTimeout(() => {
        this.you = { item: '', text: '' }
        this.held = ''
        this.paint()
      }, 7000)
  }

  /** The call at the top of the canvas: its state, meters and caption. */
  private dock() {
    // At rest the Talk button sits with the creation tools (as Miro keeps
    // its AI at the top of the creation bar); the call takes the top.
    if (!this.on) return ''
    const muted = Boolean(this.mic?.muted)
    const caption = this.you.text
      ? `<p class="map-caption"><span class="map-caption-who">You</span><span class="map-caption-text">${escape(this.you.text)}</span>${readingChip(this.you.reading, this.jev)}</p>`
      : ''
    const held = this.held
      ? `<p class="map-held" role="status"><b>Held</b> ${escape(heldWords(this.held))}</p>`
      : ''
    return `<div class="map-call is-${this.state}" role="group" aria-label="Call with Studio AI">
<span class="map-call-faces"><i class="map-face is-you" title="You">${voiceIcon('person', 14)}</i><i class="map-face is-ai" title="Studio AI">${voiceIcon('spark', 14)}</i></span>
<span class="map-call-state" role="status">${this.micBlocked ? 'Microphone off · type instead' : STATE_WORDS[this.state]}</span>
<span class="map-call-meter" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
<button type="button" class="map-call-btn" data-voice="mute" aria-pressed="${muted}" title="${muted ? 'Unmute' : 'Mute'}" ${this.mic ? '' : 'disabled'}>${voiceIcon(muted ? 'micOff' : 'mic')}</button>
<button type="button" class="map-call-btn" data-voice="type" aria-pressed="${this.typing}" title="Type to Studio AI">${voiceIcon('keyboard')}</button>
<button type="button" class="map-call-end" data-voice="end">End</button>
</div>${this.typing ? `<form class="map-call-type" data-voice-form><input name="text" autocomplete="off" placeholder="Type to Studio AI…" aria-label="Type to Studio AI"><button type="submit" class="map-call-btn" title="Send">${voiceIcon('send')}</button></form>` : ''}${caption}${held}`
  }

  /** Draws the dock and tells Studio AI what changed on the canvas. */
  paint() {
    const stage = this.map.root.querySelector('.map-stage')
    if (!stage) return
    let dock = stage.querySelector<HTMLElement>('.map-voice')
    if (!dock) {
      dock = document.createElement('div')
      dock.className = 'map-voice'
      stage.appendChild(dock)
      this.drawn = ''
    }
    const html = this.dock()
    if (html !== this.drawn) {
      // A half-typed line survives the redraw.
      const draft = dock.querySelector<HTMLInputElement>(
        '[data-voice-form] input'
      )
      const focused = draft === document.activeElement
      dock.innerHTML = html
      this.drawn = html
      const input = dock.querySelector<HTMLInputElement>(
        '[data-voice-form] input'
      )
      if (input && draft) input.value = draft.value
      if (input && focused) input.focus()
    }
    dock.classList.toggle('is-on', this.on)
    // Without a key, Talk stays enabled in its set-up state (review 7).
    const talk = this.map.root.querySelector<HTMLElement>('[data-voice="talk"]')
    const tip = this.needsKey ? NEEDS_KEY : TALK_TIP
    talk?.classList.toggle('is-setup', this.needsKey)
    if (talk?.hasAttribute('title') && talk.title !== tip) talk.title = tip
    this.context()
  }

  /** A reopened map asks for the key again: it may have been added since. */
  recheckKey() {
    this.needsKey = false
  }

  /** The dock's buttons and its typing line. */
  install() {
    const root = this.map.root
    root.addEventListener('click', (event) => {
      const button = (event.target as Element).closest<HTMLElement>(
        '[data-voice]'
      )
      if (!button || !this.map.isOpen) return
      const action = button.dataset.voice
      if (action === 'check-key') {
        this.needsKey = false
        const menu = this.map.slot('menu')
        if (menu) menu.hidden = true
        this.start()
      } else if (action === 'talk') this.start()
      else if (action === 'end') this.stop()
      else if (action === 'mute' && this.mic) {
        this.mic.muted = !this.mic.muted
        this.paint()
      } else if (action === 'type') {
        this.typing = !this.typing
        this.paint()
        root.querySelector<HTMLInputElement>('[data-voice-form] input')?.focus()
      }
    })
    root.addEventListener('submit', (event) => {
      const form = (event.target as Element).closest<HTMLFormElement>(
        '[data-voice-form]'
      )
      if (!form) return
      event.preventDefault()
      event.stopPropagation()
      const input = form.querySelector<HTMLInputElement>('input')
      const text = input?.value.trim() || ''
      if (input) input.value = ''
      if (text) this.say(text)
    })
    this.map.onCamera.push((animate) => this.cursor.follow(animate))
  }
}
