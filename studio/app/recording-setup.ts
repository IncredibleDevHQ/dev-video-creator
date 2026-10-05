import { html } from './ui'
import { escape, button } from './ui'
export const recordingRecovery = (reason: unknown) =>
  html`<p class="eyebrow">RECORDING</p>
    <h2>Let’s get you ready</h2>
    <p role="alert">
      ${escape(
        reason instanceof Error
          ? reason.message
          : 'Recording could not start. Check your device and try again.'
      )}
    </p>
    <p class="recording-help">
      Your saved takes are unchanged. Retry returns to recording setup; it does
      not enable your devices automatically.
    </p>
    <div class="moment-action-list">
      ${button('Try recording again', 'recording-retry', true)}${button(
        'Practice instead',
        'practice'
      )}
    </div>`
