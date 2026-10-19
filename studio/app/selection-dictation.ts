import { CommentRecording } from './comment-recording'
import { requestJson } from './http'

export class SelectionDictation {
  private recording: CommentRecording | null = null
  private version = 0
  private timer?: ReturnType<typeof setTimeout>
  private busy = false
  cancel() {
    ++this.version
    clearTimeout(this.timer)
    this.recording?.cancel()
    this.recording = null
    this.busy = false
  }
  async toggle(panel: HTMLElement) {
    if (this.busy) return
    const field = panel.querySelector<HTMLTextAreaElement>('textarea')!
    const status = panel.querySelector<HTMLElement>('[role="status"]')!
    const mic = panel.querySelector<HTMLButtonElement>(
      '[data-research-action="dictate-selection"]'
    )!
    const version = this.version
    this.busy = true
    try {
      if (!this.recording) {
        status.textContent = 'Opening microphone…'
        const recording = await CommentRecording.start()
        if (version !== this.version || !panel.isConnected || panel.hidden) {
          recording.cancel()
          return
        }
        this.recording = recording
        mic.setAttribute('aria-label', 'Stop dictation')
        mic.setAttribute('aria-pressed', 'true')
        status.textContent =
          'Listening… click the microphone to finish (up to 60 seconds).'
        this.timer = setTimeout(() => void this.toggle(panel), 60_000)
      } else {
        clearTimeout(this.timer)
        const recording = this.recording
        this.recording = null
        const { blob } = await recording.stop()
        if (version !== this.version || !panel.isConnected || panel.hidden)
          return
        status.textContent = 'Transcribing…'
        mic.disabled = true
        const result = await requestJson<{ text: string }>(
          '/api/research-dictation',
          {
            method: 'PUT',
            body: blob,
            headers: { 'Content-Type': blob.type }
          }
        )
        if (version !== this.version || !panel.isConnected || panel.hidden)
          return
        field.value = [field.value.trim(), result.text]
          .filter(Boolean)
          .join(' ')
          .slice(0, 2000)
        field.dispatchEvent(new Event('input', { bubbles: true }))
        status.textContent = result.text
          ? 'Review the transcript before asking or saving.'
          : 'No speech detected. Try again or type your comment.'
        field.focus({ preventScroll: true })
      }
    } catch {
      if (version === this.version)
        status.textContent =
          'Could not transcribe. Check microphone permission and the OpenAI key in Settings, or type here.'
    } finally {
      if (version === this.version) {
        this.busy = false
        mic.disabled = false
        if (!this.recording) {
          mic.setAttribute('aria-label', 'Dictate question or comment')
          mic.setAttribute('aria-pressed', 'false')
        }
      }
    }
  }
}
