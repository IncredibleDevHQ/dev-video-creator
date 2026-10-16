// The voice call's sound: the microphone as 16-bit PCM at 24 kHz, in small
// chunks, and Studio AI's voice played as it streams in. When the creator
// talks over it, the voice stops at once and says how much was heard.

// Runs in the audio thread: averages the device's samples down to 24 kHz
// (a box filter, enough for speech) and posts 40 ms chunks with their level.
const TAP = `class MicTap extends AudioWorkletProcessor {
  constructor() {
    super()
    this.step = sampleRate / 24000
    this.out = new Int16Array(960)
    this.fill = 0
    this.acc = 0
    this.n = 0
    this.pos = 0
    this.energy = 0
  }
  process(inputs) {
    const input = inputs[0] && inputs[0][0]
    if (!input) return true
    for (let i = 0; i < input.length; i++) {
      this.acc += input[i]
      this.n++
      this.pos++
      if (this.pos < this.step) continue
      this.pos -= this.step
      const s = Math.max(-1, Math.min(1, this.acc / this.n))
      this.acc = 0
      this.n = 0
      this.energy += s * s
      this.out[this.fill++] = s < 0 ? s * 32768 : s * 32767
      if (this.fill === this.out.length) {
        const level = Math.sqrt(this.energy / this.fill)
        this.port.postMessage({ pcm: this.out.buffer, level }, [this.out.buffer])
        this.out = new Int16Array(960)
        this.fill = 0
        this.energy = 0
      }
    }
    return true
  }
}
registerProcessor('mic-tap', MicTap)`

export type Mic = { stop: () => void; muted: boolean }

/** Opens the microphone; each chunk is PCM16 at 24 kHz, with its level. */
export const openMic = async (
  chunk: (pcm: ArrayBuffer, level: number) => void
): Promise<Mic> => {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  })
  const context = new AudioContext()
  const url = URL.createObjectURL(
    new Blob([TAP], { type: 'application/javascript' })
  )
  try {
    await context.audioWorklet.addModule(url)
  } finally {
    URL.revokeObjectURL(url)
  }
  const source = context.createMediaStreamSource(stream)
  const tap = new AudioWorkletNode(context, 'mic-tap')
  const mic: Mic = {
    muted: false,
    stop: () => {
      tap.port.onmessage = null
      source.disconnect()
      tap.disconnect()
      for (const track of stream.getTracks()) track.stop()
      void context.close()
    }
  }
  tap.port.onmessage = (
    event: MessageEvent<{ pcm: ArrayBuffer; level: number }>
  ) => {
    if (!mic.muted) chunk(event.data.pcm, event.data.level)
  }
  source.connect(tap)
  // A worklet runs only while it leads somewhere: into a silent gain.
  const silent = context.createGain()
  silent.gain.value = 0
  tap.connect(silent).connect(context.destination)
  if (context.state === 'suspended') await context.resume()
  return mic
}

const pcmOf = (base64: string) => {
  const raw = atob(base64)
  const samples = new Float32Array(raw.length >> 1)
  for (let i = 0; i < samples.length; i++) {
    let value = raw.charCodeAt(i * 2) | (raw.charCodeAt(i * 2 + 1) << 8)
    if (value >= 0x8000) value -= 0x10000
    samples[i] = value / 32768
  }
  return samples
}

/** Studio AI's voice: chunks played back to back, as they arrive. */
export class VoicePlayer {
  private context = new AudioContext()
  private meter = this.context.createAnalyser()
  private next = 0
  private playing: AudioBufferSourceNode[] = []
  /** Each reply's first sound and how much of it is queued, in seconds. */
  private items = new Map<string, { start: number; length: number }>()
  private current = ''
  constructor() {
    this.meter.fftSize = 512
    this.meter.connect(this.context.destination)
  }
  async resume() {
    if (this.context.state === 'suspended') await this.context.resume()
  }
  push(item: string, base64: string) {
    const samples = pcmOf(base64)
    if (!samples.length) return
    const buffer = this.context.createBuffer(1, samples.length, 24000)
    buffer.copyToChannel(samples, 0)
    const source = this.context.createBufferSource()
    source.buffer = buffer
    source.connect(this.meter)
    const at = Math.max(this.next, this.context.currentTime + 0.03)
    source.start(at)
    this.next = at + buffer.duration
    this.playing.push(source)
    source.onended = () => {
      this.playing = this.playing.filter((node) => node !== source)
    }
    const known = this.items.get(item)
    if (known) known.length += buffer.duration
    else this.items.set(item, { start: at, length: buffer.duration })
    this.current = item
  }
  /** Sound still to come. */
  get speaking() {
    return this.next > this.context.currentTime
  }
  /** How loud it is now, 0 to 1. */
  level() {
    const data = new Uint8Array(this.meter.fftSize)
    this.meter.getByteTimeDomainData(data)
    let sum = 0
    for (const value of data) sum += ((value - 128) / 128) ** 2
    return Math.min(1, Math.sqrt(sum / data.length) * 3)
  }
  /** Stops now; says which reply was playing and how much was heard. */
  stop(): { item: string; ms: number } | null {
    const heard = this.items.get(this.current)
    const was = this.speaking && heard
    for (const node of this.playing) {
      try {
        node.stop()
      } catch {
        // Not started yet.
      }
    }
    this.playing = []
    this.next = 0
    if (!was) return null
    const ms = Math.min(
      heard.length,
      Math.max(0, this.context.currentTime - heard.start)
    )
    return { item: this.current, ms: Math.round(ms * 1000) }
  }
  close() {
    this.stop()
    void this.context.close()
  }
}
