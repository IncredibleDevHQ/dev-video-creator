// A comment said on the map: the microphone, recorded until it is posted
// or cancelled, and its level for the meter. It always lets go of the
// microphone, also when the recorder fails or stops by itself.
/** A recording from the microphone, with its level for the meter. */
export class CommentRecording {
  private chunks: Blob[] = []
  private began = Date.now()
  private analyser: AnalyserNode
  private context: AudioContext
  private constructor(
    private readonly stream: MediaStream,
    private readonly recorder: MediaRecorder
  ) {
    this.context = new AudioContext()
    this.analyser = this.context.createAnalyser()
    this.context.createMediaStreamSource(stream).connect(this.analyser)
    recorder.ondataavailable = (event) => {
      if (event.data.size) this.chunks.push(event.data)
    }
    recorder.start(250)
  }
  static async start() {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true }
    })
    const type = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg'
    ].find((candidate) => MediaRecorder.isTypeSupported?.(candidate))
    // A recorder that can't start lets go of the microphone (review 7).
    try {
      return new CommentRecording(
        stream,
        new MediaRecorder(stream, type ? { mimeType: type } : {})
      )
    } catch (error) {
      for (const track of stream.getTracks()) track.stop()
      throw error
    }
  }
  get seconds() {
    return (Date.now() - this.began) / 1000
  }
  level() {
    const data = new Uint8Array(this.analyser.fftSize)
    this.analyser.getByteTimeDomainData(data)
    let sum = 0
    for (const value of data) sum += ((value - 128) / 128) ** 2
    return Math.min(1, Math.sqrt(sum / data.length) * 4)
  }
  private release() {
    for (const track of this.stream.getTracks()) track.stop()
    void this.context.close()
  }
  // A recorder that stopped by itself fires no stop: it lets go at once.
  stop(): Promise<{ blob: Blob; seconds: number }> {
    const seconds = this.seconds
    return new Promise((resolve) => {
      const done = () => {
        this.release()
        resolve({
          blob: new Blob(this.chunks, {
            type: this.recorder.mimeType || 'audio/webm'
          }),
          seconds
        })
      }
      if (this.recorder.state === 'inactive') return done()
      this.recorder.onstop = done
      this.recorder.stop()
    })
  }
  cancel() {
    if (this.recorder.state === 'inactive') return this.release()
    this.recorder.onstop = () => this.release()
    this.recorder.stop()
  }
}
