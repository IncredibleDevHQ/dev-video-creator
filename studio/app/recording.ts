import type { Moment } from '../shared/model'
import type { RecordedPart } from '../shared/api'
export class Recording {
  phase: 'idle' | 'preparing' | 'recording' | 'reviewing' | 'uploading' = 'idle'
  stream: MediaStream | null = null
  blob: Blob | null = null
  url: string | null = null
  parts: RecordedPart[] = []
  moments: Moment[] = []
  current = 0
  private generation=0
  private recorder: MediaRecorder | null = null
  private started = 0
  private tick: ReturnType<typeof setInterval> | null = null
  constructor(private change: () => void, private clock: (seconds: number) => void) {}
  get elapsed() { return Math.max(0, (performance.now()-this.started)/1000) }
  async start(moments: Moment[]) {
    if (this.phase !== 'idle') throw new Error('Finish this recording first')
    const generation=++this.generation
    this.moments = structuredClone(moments)
    this.phase = 'preparing'; this.change()
    try {
      if(!navigator.mediaDevices?.getUserMedia) throw new Error('Recording requires a secure browser page with microphone and camera support.')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true }, video: moments.some(moment => moment.camera !== 'none') ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false })
      if(generation!==this.generation) {stream.getTracks().forEach(track => track.stop());return}
      this.stream=stream
      this.current = 0; this.parts = []
      const preferred = this.stream.getVideoTracks().length ? ['video/webm;codecs=vp8,opus','video/webm','video/mp4'] : ['audio/webm;codecs=opus','audio/webm','audio/mp4']
      const mimeType = preferred.find(type => MediaRecorder.isTypeSupported(type))
      this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined)
      const chunks: Blob[] = []
      this.recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
      this.recorder.onstop = () => {
        this.blob = new Blob(chunks, { type: this.recorder!.mimeType }); this.url = URL.createObjectURL(this.blob)
        this.stopTracks(); this.phase = 'reviewing'; this.change()
      }
      this.recorder.start(250); this.started = performance.now(); this.phase = 'recording'
      this.tick = setInterval(() => this.clock(this.elapsed-(this.parts.at(-1)?.to || 0)), 100)
      this.change()
    } catch (error) { if(generation!==this.generation) return; this.stopTracks(); this.phase = 'idle'; this.change();
      if(error instanceof Error && error.name==='NotAllowedError') throw new Error('Camera or microphone access was denied. Allow access in your browser’s site settings, then select Record again. You can still practice with the presenter stand-in.')
      if(error instanceof Error && error.name==='NotFoundError') throw new Error('No matching camera or microphone was found. Connect the required device, then select Record again.')
      throw error }
  }
  next() {
    if (this.phase !== 'recording') return
    const moment = this.moments[this.current]
    const from = this.parts.at(-1)?.to || 0; const to = this.elapsed
    if (to-from < 0.4) throw new Error('Record the moment before moving on')
    this.parts.push({ momentId: moment.id, recordingKey: moment.recordingKey, from, to })
    if (++this.current >= this.moments.length) { this.recorder!.stop(); if (this.tick) clearInterval(this.tick); this.tick = null }
    else this.change()
  }
  dispose() {
    this.generation++
    if (this.recorder && this.recorder.state !== 'inactive') { this.recorder.onstop = null; this.recorder.ondataavailable = null; this.recorder.stop() }
    this.recorder = null
    this.stopTracks(); if (this.url) URL.revokeObjectURL(this.url)
    this.url = null; this.blob = null; this.parts = []; this.moments = []; this.current = 0; this.phase = 'idle'; this.change()
  }
  private stopTracks() {
    if (this.tick) clearInterval(this.tick); this.tick = null
    this.stream?.getTracks().forEach(track => track.stop()); this.stream = null
  }
}
