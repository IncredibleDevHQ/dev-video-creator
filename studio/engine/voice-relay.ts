// The voice socket. The page streams the creator's microphone here, and the
// engine holds Studio AI's Realtime connection with the key only it reads;
// audio and events go both ways. Jev reads each thing the creator says, and
// a tool the AI calls goes to the page (which runs it with the AI's cursor)
// only when the gate lets it; otherwise the AI is told why it was held.
import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import { WebSocket, WebSocketServer } from 'ws'
import { askJev, jevConfigured } from './jev'
import { openAiKey, withoutKeys } from './model-gateway'
import { loadProject } from './projects'
import { foreignSocket } from './request-guard'
import {
  gate,
  instructionsUpdate,
  readingFrom,
  readingQuestions,
  readingState,
  realtimeUrl,
  REALTIME_VOICE,
  sessionUpdate,
  type Heard,
  type Turn
} from './voice-agent'
import { VOICE_TOOLS } from '../shared/voice'
import type {
  ToolOutcome,
  VoiceReading,
  VoiceServerMessage,
  VoiceToolName
} from '../shared/voice'

/** What the relay reaches out to; checks replace them with stand-ins. */
export const voiceDeps = {
  key: openAiKey,
  url: realtimeUrl,
  jev: jevConfigured,
  classify: async (state: unknown): Promise<VoiceReading | null> =>
    readingFrom(await askJev(state, readingQuestions(), { retries: 1 }))
}

/** How long a tool waits for Jev's reading of what asked for it. */
const WAIT_FOR_READING = 12_000
const QUIET_MS = 6 * 60_000
const LONGEST_MS = 30 * 60_000

type RealtimeEvent = {
  type?: string
  item_id?: string
  delta?: string
  transcript?: string
  item?: { type?: string; call_id?: string; name?: string; arguments?: string }
  error?: { message?: string; code?: string }
}

const sessions = new Set<VoiceSession>()

class VoiceSession {
  private ai: WebSocket | null = null
  private key = ''
  private canvas = ''
  private sentCanvas = ''
  private sessionSent = false
  private ready = false
  private talk: Turn[] = []
  private heard = new Map<
    string,
    { promise: Promise<Heard>; settle: (heard: Heard) => void }
  >()
  private latest: string | null = null
  private yours = new Map<string, string>()
  private theirs = new Map<string, string>()
  private pending = new Set<string>()
  private responding = false
  private owed = false
  private typed = 0
  private last = Date.now()
  private readonly began = Date.now()
  private ticker: ReturnType<typeof setInterval> | null = null
  private refresh: ReturnType<typeof setTimeout> | null = null
  private closed = false

  constructor(
    private readonly page: WebSocket,
    readonly mapId: string
  ) {}

  async start() {
    sessions.add(this)
    this.page.on('message', (data, binary) => this.fromPage(data, binary))
    this.page.on('close', () => this.close('The page left'))
    this.page.on('error', () => this.close('The page left'))
    const key = await voiceDeps.key().catch(() => '')
    if (this.closed) return
    if (!key) {
      // Said by a code, so the page offers the way to add one (review 7).
      this.toPage({
        type: 'error',
        code: 'no-key',
        message:
          'Studio AI needs an OpenAI key: add one in Settings → API keys, or OPENAI_API_KEY in .env'
      })
      return this.close('No OpenAI key')
    }
    this.key = key
    const ai = new WebSocket(voiceDeps.url(), {
      headers: { Authorization: `Bearer ${key}` }
    })
    this.ai = ai
    ai.on('message', (data) => {
      let event: RealtimeEvent
      try {
        event = JSON.parse(String(data)) as RealtimeEvent
      } catch {
        return
      }
      this.fromAi(event)
    })
    ai.on('unexpected-response', (request, response) => {
      request.destroy()
      this.toPage({
        type: 'error',
        message:
          response.statusCode === 401
            ? 'OpenAI refused the key'
            : `OpenAI's voice service answered ${response.statusCode}`
      })
      this.close('Studio AI could not join')
    })
    ai.on('error', () => {
      this.toPage({
        type: 'error',
        message: 'Studio AI could not reach OpenAI’s voice service'
      })
      this.close('Studio AI could not join')
    })
    ai.on('close', () => this.close('Studio AI left the call'))
    this.ticker = setInterval(() => {
      const now = Date.now()
      if (now - this.began > LONGEST_MS)
        this.close('The call reached 30 minutes. Press Talk to start again.')
      else if (now - this.last > QUIET_MS)
        this.close('Studio AI left after six quiet minutes.')
    }, 15_000)
  }

  close(reason: string) {
    if (this.closed) return
    this.closed = true
    sessions.delete(this)
    if (this.ticker) clearInterval(this.ticker)
    if (this.refresh) clearTimeout(this.refresh)
    for (const entry of this.heard.values()) entry.settle(null)
    this.toPage({ type: 'closed', reason })
    try {
      if (this.ai?.readyState === WebSocket.OPEN) this.ai.close(1000)
      else this.ai?.terminate()
    } catch {
      // Already gone.
    }
    try {
      this.page.close(1000)
    } catch {
      // Already gone.
    }
  }

  private toPage(message: VoiceServerMessage) {
    if (this.page.readyState === WebSocket.OPEN)
      this.page.send(JSON.stringify(message))
  }

  private toAi(event: Record<string, unknown>) {
    if (this.ai?.readyState === WebSocket.OPEN)
      this.ai.send(JSON.stringify(event))
  }

  private fromPage(data: unknown, binary: boolean) {
    if (binary) {
      // The microphone: PCM16 at 24 kHz, appended as it comes.
      if (!this.ready) return
      const bytes = Buffer.isBuffer(data)
        ? data
        : Array.isArray(data)
          ? Buffer.concat(data as Buffer[])
          : Buffer.from(data as ArrayBuffer)
      if (bytes.length)
        this.toAi({
          type: 'input_audio_buffer.append',
          audio: bytes.toString('base64')
        })
      return
    }
    let message: Record<string, unknown>
    try {
      message = JSON.parse(String(data)) as Record<string, unknown>
    } catch {
      return
    }
    if (!message || typeof message !== 'object') return
    switch (message.type) {
      case 'context':
        this.canvas = String(message.text || '').slice(0, 24_000)
        return this.sendCanvas()
      case 'say':
        this.last = Date.now()
        return this.say(String(message.text || ''))
      case 'tool_result':
        this.last = Date.now()
        return this.answer(
          String(message.call || ''),
          outcomeOf(message.output)
        )
      case 'played': {
        // The creator spoke over the AI: what they heard is what it said.
        const item = String(message.item || '')
        const ms = Number(message.ms)
        if (item && Number.isFinite(ms))
          this.toAi({
            type: 'conversation.item.truncate',
            item_id: item,
            content_index: 0,
            audio_end_ms: Math.max(0, Math.round(ms))
          })
        return
      }
      case 'stop':
        return this.close('You ended the call')
    }
  }

  private sendCanvas() {
    if (!this.sessionSent || this.canvas === this.sentCanvas) return
    if (this.refresh) clearTimeout(this.refresh)
    this.refresh = setTimeout(() => {
      this.refresh = null
      if (this.canvas === this.sentCanvas) return
      this.sentCanvas = this.canvas
      this.toAi(instructionsUpdate(this.canvas))
    }, 300)
  }

  private fromAi(event: RealtimeEvent) {
    const item = String(event.item_id || '')
    switch (event.type) {
      case 'session.created':
        this.sessionSent = true
        this.sentCanvas = this.canvas
        return this.toAi(sessionUpdate(this.canvas))
      case 'session.updated':
        if (this.ready) return
        this.ready = true
        return this.toPage({
          type: 'ready',
          voice: REALTIME_VOICE,
          jev: voiceDeps.jev()
        })
      case 'input_audio_buffer.speech_started':
        this.last = Date.now()
        return this.toPage({ type: 'speech', state: 'started' })
      case 'input_audio_buffer.speech_stopped':
        return this.toPage({ type: 'speech', state: 'stopped' })
      case 'input_audio_buffer.committed':
        return void this.expect(item)
      case 'conversation.item.input_audio_transcription.delta': {
        const text = (this.yours.get(item) || '') + String(event.delta || '')
        this.yours.set(item, text)
        return this.toPage({ type: 'you', item, text, final: false })
      }
      case 'conversation.item.input_audio_transcription.completed':
        this.yours.delete(item)
        return void this.understand(item, String(event.transcript || ''))
      case 'conversation.item.input_audio_transcription.failed':
        return this.expect(item).settle({ text: '', reading: null })
      case 'response.created':
        this.responding = true
        this.owed = false
        return this.toPage({ type: 'busy', state: 'thinking' })
      case 'response.output_audio.delta':
      case 'response.audio.delta':
        return this.toPage({ type: 'audio', item, data: String(event.delta) })
      case 'response.output_audio_transcript.delta':
      case 'response.audio_transcript.delta': {
        const text = (this.theirs.get(item) || '') + String(event.delta || '')
        this.theirs.set(item, text)
        return this.toPage({ type: 'ai', item, text, final: false })
      }
      case 'response.output_audio_transcript.done':
      case 'response.audio_transcript.done': {
        const text = String(event.transcript ?? this.theirs.get(item) ?? '')
        this.theirs.delete(item)
        this.toPage({ type: 'ai', item, text, final: true })
        // After the creator's words it answers, once Jev has read them.
        void this.heardFor(this.latest).then(() =>
          this.talk.push({ who: 'ai', said: text.slice(0, 600) })
        )
        return
      }
      case 'response.output_item.done':
        if (event.item?.type === 'function_call') void this.call(event.item)
        return
      case 'response.done':
        this.responding = false
        this.toPage({ type: 'busy', state: 'idle' })
        return this.continue()
      case 'error':
        return this.aiError(event.error)
    }
  }

  /** The creator's words, kept until Jev has read them. */
  private expect(item: string) {
    let entry = this.heard.get(item)
    if (!entry) {
      let settle: (heard: Heard) => void = () => {}
      const promise = new Promise<Heard>((resolve) => {
        settle = resolve
      })
      entry = { promise, settle }
      this.heard.set(item, entry)
      this.latest = item
      // Only the last few are ever waited on.
      if (this.heard.size > 40)
        this.heard.delete(this.heard.keys().next().value!)
    }
    return entry
  }

  private async understand(item: string, said: string) {
    const text = said.trim()
    const entry = this.expect(item)
    this.toPage({ type: 'you', item, text, final: true })
    if (!text) return entry.settle({ text, reading: null })
    const before = this.talk.slice()
    this.talk.push({ who: 'creator', said: text.slice(0, 600) })
    if (this.talk.length > 24) this.talk.splice(0, this.talk.length - 24)
    const reading = voiceDeps.jev()
      ? await voiceDeps
          .classify(readingState(text, before, this.canvas))
          .catch(() => null)
      : null
    this.toPage({ type: 'reading', item, reading })
    entry.settle({ text, reading })
  }

  private heardFor(item: string | null): Promise<Heard> {
    const entry = item ? this.heard.get(item) : undefined
    if (!entry) return Promise.resolve(null)
    return Promise.race([
      entry.promise,
      new Promise<Heard>((resolve) =>
        setTimeout(() => resolve({ text: '', reading: null }), WAIT_FOR_READING)
      )
    ])
  }

  /** Typed words: the same as said ones, read at once. */
  private say(raw: string) {
    const text = raw.trim().slice(0, 2000)
    if (!text || !this.ready) return
    const item = `typed-${++this.typed}`
    void this.understand(item, text)
    this.toAi({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }]
      }
    })
    this.owed = true
    if (this.responding) this.toAi({ type: 'response.cancel' })
    else this.continue()
  }

  private usedConfirmations = new Set<string>()

  private async call(item: NonNullable<RealtimeEvent['item']>) {
    const call = String(item.call_id || '')
    const name = String(item.name || '')
    if (!call) return
    this.pending.add(call)
    let args: Record<string, unknown> = {}
    try {
      const parsed = JSON.parse(item.arguments || '{}') as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
        args = parsed as Record<string, unknown>
    } catch {
      return this.answer(call, {
        ok: false,
        error: 'The arguments were not JSON'
      })
    }
    const utterance = this.latest
    const decision = gate(name, args, await this.heardFor(utterance))
    const big = VOICE_TOOLS[name as keyof typeof VOICE_TOOLS]?.big
    if (decision.run && big && utterance) {
      if (this.usedConfirmations.has(utterance)) {
        this.toPage({
          type: 'held',
          call,
          name,
          why: 'That confirmation has already been used; ask again for this change'
        })
        return this.answer(call, {
          ok: false,
          error: 'Ask for a new confirmation for this change'
        })
      }
      this.usedConfirmations.add(utterance)
    }
    if (this.closed) return
    if (!decision.run) {
      this.toPage({ type: 'held', call, name, why: decision.why })
      return this.answer(call, { ok: false, error: `Held: ${decision.why}` })
    }
    this.toPage({ type: 'tool', call, name: name as VoiceToolName, args })
  }

  /** A tool's outcome back to the AI; once none is left, it carries on.
   * The canvas as it is now goes first, so the answer reads it. */
  private answer(call: string, output: ToolOutcome) {
    if (!this.pending.delete(call)) return
    if (this.refresh && this.canvas !== this.sentCanvas) {
      clearTimeout(this.refresh)
      this.refresh = null
      this.sentCanvas = this.canvas
      this.toAi(instructionsUpdate(this.canvas))
    }
    this.toAi({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: call,
        output: JSON.stringify(output)
      }
    })
    if (!this.pending.size) {
      this.owed = true
      this.continue()
    }
  }

  private continue() {
    if (!this.owed || this.pending.size || this.responding) return
    this.owed = false
    this.toAi({ type: 'response.create' })
  }

  private aiError(error: RealtimeEvent['error']) {
    const code = String(error?.code || '')
    const message = String(error?.message || '')
    // What the relay's own timing causes is no news for the creator.
    if (/cancel_not_active|active_response|truncat|audio_end/i.test(code))
      return
    console.error(`Studio AI: ${code || 'error'}`)
    this.toPage({
      type: 'error',
      message: withoutKeys(message || 'Studio AI hit a problem', this.key, 300)
    })
  }
}

/** A tool's outcome from the page, kept to what the AI is told. */
const outcomeOf = (raw: unknown): ToolOutcome => {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Record<
    string,
    unknown
  >
  const line = (key: string, limit: number) =>
    typeof value[key] === 'string'
      ? { [key]: (value[key] as string).slice(0, limit) }
      : {}
  return {
    ok: value.ok === true,
    ...line('did', 400),
    ...line('error', 400),
    ...line('details', 6000)
  }
}

const sockets = new WebSocketServer({ noServer: true, maxPayload: 512_000 })
const voicePath = /^\/api\/projects\/([a-zA-Z0-9_-]+)\/voice$/

/** Answers a socket upgrade when it is the voice socket's. True when it
 * was (taken or refused); false leaves it to the caller. */
export const voiceUpgrade = (
  request: IncomingMessage,
  socket: Duplex,
  head: Buffer,
  options: { readOnly?: boolean } = {}
) => {
  const route = new URL(request.url || '/', 'http://localhost').pathname.match(
    voicePath
  )
  if (!route) return false
  const refuse = (status: string) => {
    socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`)
  }
  if (options.readOnly || foreignSocket(request)) {
    refuse('403 Forbidden')
    return true
  }
  void loadProject(route[1])
    .then((found) => {
      if (!found) return refuse('404 Not Found')
      sockets.handleUpgrade(request, socket, head, (page) => {
        void new VoiceSession(page, route[1]).start()
      })
    })
    .catch(() => refuse('500 Internal Server Error'))
  return true
}

/** Ends every call, as the engine stops. */
export const stopVoiceSessions = () => {
  for (const session of [...sessions]) session.close('The studio is stopping')
}
