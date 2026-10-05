import type { Moment } from '../shared/model'
import type { RecordedPart } from '../shared/api'
export class Recording {
  phase:
    | 'idle'
    | 'preparing'
    | 'ready'
    | 'countdown'
    | 'recording'
    | 'reviewing'
    | 'uploading' = 'idle'
  stream: MediaStream | null = null
  blob: Blob | null = null
  url: string | null = null
  parts: RecordedPart[] = []
  moments: Moment[] = []
  current = 0
  countdown = 3
  stopAfter: number | null = null
  private cancelPermission: (() => void) | null = null
  private finishing = false
  private generation = 0
  private recorder: MediaRecorder | null = null
  private started = 0
  private tick: ReturnType<typeof setInterval> | null = null
  constructor(
    private change: () => void,
    private clock: (seconds: number) => void,
    private failed: (error: Error) => void = () => {}
  ) {}
  get elapsed() {
    return Math.max(0, (performance.now() - this.started) / 1000)
  }
  /** Ask for the devices, then count down and record straight away. */
  async start(moments: Moment[], options: { stopAfter?: number | null } = {}) {
    await this.prepare(moments, options)
    if (this.phase === 'ready') this.begin()
  }
  /**
   * Ask for the devices and hold, camera and microphone live, so the creator
   * sees their framing and hears their level before begin() counts down.
   */
  async prepare(
    moments: Moment[],
    options: { stopAfter?: number | null } = {}
  ) {
    if (this.phase !== 'idle') throw new Error('Finish this recording first')
    if (!moments.length) throw new Error('Choose a moment to record')
    if (
      options.stopAfter != null &&
      (!Number.isFinite(options.stopAfter) ||
        options.stopAfter < 1 ||
        options.stopAfter > 600)
    )
      throw new Error('Choose a stop time between 1 and 600 seconds')
    this.stopAfter = options.stopAfter ?? null
    this.finishing = false
    this.countdown = 3
    const generation = ++this.generation
    this.moments = structuredClone(moments)
    this.phase = 'preparing'
    this.change()
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          'Recording requires a secure browser page with microphone and camera support.'
        )
      const stream = await this.requestStream({
        audio: { echoCancellation: true },
        video: moments.some((moment) => moment.camera !== 'none')
          ? { width: { ideal: 1280 }, height: { ideal: 720 } }
          : false
      })
      if (generation !== this.generation) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      this.stream = stream
      this.current = 0
      this.parts = []
      const preferred = this.stream.getVideoTracks().length
        ? ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
        : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
      const mimeType = preferred.find((type) =>
        MediaRecorder.isTypeSupported(type)
      )
      this.recorder = new MediaRecorder(
        this.stream,
        mimeType ? { mimeType } : undefined
      )
      const chunks: Blob[] = []
      this.recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data)
      }
      this.recorder.onerror = () => {
        if (generation === this.generation) this.fail()
      }
      this.recorder.onstop = () => {
        if (generation !== this.generation) return
        this.blob = new Blob(chunks, { type: this.recorder!.mimeType })
        this.url = URL.createObjectURL(this.blob)
        this.stopTracks()
        this.phase = 'reviewing'
        this.change()
      }
      this.phase = 'ready'
      this.change()
    } catch (error) {
      if (generation !== this.generation) return
      this.stopTracks()
      this.phase = 'idle'
      this.change()
      const devices = moments.some((moment) => moment.camera !== 'none')
        ? 'Camera or microphone'
        : 'Microphone'
      if (error instanceof Error && error.name === 'NotAllowedError')
        throw new Error(
          `${devices} access was denied. Allow access in your browser’s site settings, then select Record again. You can still practice with the presenter stand-in.`
        )
      if (error instanceof Error && error.name === 'NotFoundError')
        throw new Error(
          `No matching ${devices.toLowerCase()} was found. Connect the required device, then select Record again.`
        )
      if (error instanceof Error && error.name === 'NotReadableError')
        throw new Error(
          `${devices} could not start. Close other apps using your device, check system permissions, then try recording again.`
        )
      throw error
    }
  }
  /** Count down from three, then record. */
  begin() {
    if (this.phase !== 'ready') return
    const generation = this.generation
    this.countdown = 3
    this.phase = 'countdown'
    this.change()
    this.tick = setInterval(() => {
      if (generation !== this.generation) return
      if (--this.countdown > 0) {
        this.change()
        return
      }
      if (this.tick) clearInterval(this.tick)
      try {
        this.recorder!.start(250)
      } catch {
        this.fail()
        return
      }
      this.started = performance.now()
      this.phase = 'recording'
      this.tick = setInterval(() => {
        this.clock(this.elapsed - (this.parts.at(-1)?.to || 0))
        if (this.stopAfter !== null && this.elapsed >= this.stopAfter) {
          const from = this.parts.at(-1)?.to || 0
          if (this.parts.length && this.elapsed - from < 0.4) this.finish()
          else this.stop()
        }
      }, 100)
      this.change()
    }, 1000)
  }
  next() {
    if (this.phase !== 'recording' || this.finishing) return
    const moment = this.moments[this.current]
    const from = this.parts.at(-1)?.to || 0
    const to = this.elapsed
    if (to - from < 0.4) throw new Error('Record the moment before moving on')
    this.parts.push({
      momentId: moment.id,
      recordingKey: moment.recordingKey,
      from,
      to
    })
    if (++this.current >= this.moments.length) {
      this.finish()
    } else this.change()
  }
  stop() {
    if (this.phase !== 'recording' || this.finishing) return
    const from = this.parts.at(-1)?.to || 0,
      to = this.elapsed
    if (to - from < 0.4) {
      if (this.parts.length) this.finish()
      else this.dispose()
      return
    }
    const moment = this.moments[this.current]
    this.parts.push({
      momentId: moment.id,
      recordingKey: moment.recordingKey,
      from,
      to
    })
    this.finish()
  }
  private finish() {
    this.finishing = true
    if (this.tick) clearInterval(this.tick)
    this.tick = null
    try {
      this.recorder!.stop()
    } catch {
      this.fail()
    }
  }
  private fail() {
    this.dispose()
    this.failed(
      new Error(
        'Recording stopped unexpectedly. Your saved take is unchanged. Please record again.'
      )
    )
  }
  dispose() {
    this.generation++
    this.cancelPermission?.()
    this.cancelPermission = null
    if (this.recorder) {
      this.recorder.onstop = null
      this.recorder.ondataavailable = null
      this.recorder.onerror = null
      if (this.recorder.state !== 'inactive') {
        try {
          this.recorder.stop()
        } catch {
          /* Tracks are released below even if the recorder failed. */
        }
      }
    }
    this.recorder = null
    this.stopTracks()
    if (this.url) URL.revokeObjectURL(this.url)
    this.url = null
    this.blob = null
    this.parts = []
    this.moments = []
    this.current = 0
    this.phase = 'idle'
    this.change()
  }
  private requestStream(
    constraints: MediaStreamConstraints
  ): Promise<MediaStream> {
    return new Promise((resolve, reject) => {
      let settled = false
      const finish = (error: unknown, stream?: MediaStream) => {
        if (settled) {
          stream?.getTracks().forEach((track) => track.stop())
          return
        }
        settled = true
        clearTimeout(timer)
        if (this.cancelPermission === cancel) this.cancelPermission = null
        if (error) reject(error)
        else resolve(stream!)
      }
      const cancel = () => finish(new Error('Recording setup was cancelled.'))
      const timer = setTimeout(
        () =>
          finish(
            new Error(
              'Camera or microphone access was not granted within a minute. Dismiss any pending permission prompt, then select Record again. Your saved takes are unchanged.'
            )
          ),
        60000
      )
      this.cancelPermission = cancel
      try {
        navigator.mediaDevices.getUserMedia(constraints).then(
          (stream) => finish(null, stream),
          (error) => finish(error)
        )
      } catch (error) {
        finish(error)
      }
    })
  }
  private stopTracks() {
    if (this.tick) clearInterval(this.tick)
    this.tick = null
    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null
  }
}
