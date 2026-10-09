// A microphone level meter: how loud the creator is, live, so they know
// they are heard before and while they record.
let listening: MediaStream | null = null,
  context: AudioContext | null = null,
  source: MediaStreamAudioSourceNode | null = null,
  frame = 0

/** Show the level of a stream's microphone in every meter under root. */
export function meterStream(root: ParentNode, stream: MediaStream | null) {
  if (stream === listening) return
  stopMeter()
  if (!stream?.getAudioTracks().length || typeof AudioContext === 'undefined')
    return
  listening = stream
  try {
    context = new AudioContext()
    const analyser = context.createAnalyser()
    analyser.fftSize = 512
    source = context.createMediaStreamSource(stream)
    source.connect(analyser)
    const samples = new Uint8Array(analyser.fftSize)
    const paint = () => {
      analyser.getByteTimeDomainData(samples)
      let peak = 0
      for (const sample of samples)
        peak = Math.max(peak, Math.abs(sample - 128))
      const level = Math.min(1, peak / 48)
      root
        .querySelectorAll<HTMLElement>('[data-mic-meter] > i')
        .forEach((bar) => (bar.style.transform = `scaleX(${level})`))
      frame = requestAnimationFrame(paint)
    }
    frame = requestAnimationFrame(paint)
  } catch {
    // Without Web Audio there is no meter; recording works the same.
    stopMeter()
  }
}

export function stopMeter() {
  cancelAnimationFrame(frame)
  source?.disconnect()
  void context?.close().catch(() => {})
  listening = null
  context = null
  source = null
}
