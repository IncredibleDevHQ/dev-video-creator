import { button } from './ui'
export function practiceControls(
  phase: 'ready' | 'countdown' | 'running' | 'finished',
  next?: string,
  /** How many moments the practice plays: more than one is the whole scene. */
  moments = 1
) {
  if (phase === 'ready')
    return `${button('<span aria-hidden="true">▶</span> Start practice', 'practice-start', true)}<span class="practice-action-hint">${
      moments > 1 ? `All ${moments} moments · ` : ''
    }3-second countdown</span>`
  if (phase === 'countdown')
    return button('Cancel countdown', 'practice-finish')
  if (phase === 'running')
    return `${next ? button(next, 'practice-next', true) : button('<span aria-hidden="true">■</span> Finish practice', 'practice-finish', true)}<span class="practice-action-hint">${next ? 'Moves on by itself · Enter to skip ahead · ' : ''}Esc to stop</span>`
  return `${button('Practice again', 'practice-replay', true)}`
}

export const recordControl = () =>
  '<button type="button" class="record-entry" data-action="record-moment" aria-label="Record this moment" title="Open recording setup"><span class="record-entry-dot" aria-hidden="true"></span><span>Record</span></button>'
