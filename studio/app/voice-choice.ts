import type { Voice } from '../shared/model'
import type { StudioSettings } from '../shared/settings'
import { escape } from './ui'
export const voiceValue = (voice: Voice) =>
  voice.kind === 'record' ? 'record' : `${voice.kind}:${voice.id}`
export const parseVoice = (value: string): Voice => {
  if (value === 'record') return { kind: 'record' }
  const colon = value.indexOf(':')
  const kind = value.slice(0, colon)
  const id = value.slice(colon + 1)
  if (!['ai', 'clone'].includes(kind) || !id) throw new Error('Choose a voice')
  return { kind: kind as 'ai' | 'clone', id }
}
type VoiceItem = {
  value: string
  label: string
  selected: boolean
  /** The chosen voice is gone: it shows, but cannot be chosen again. */
  missing?: boolean
}
/** The voices to choose from, the chosen one marked. */
const voiceList = (settings: StudioSettings, selected: Voice): VoiceItem[] => {
  const item = (voice: Voice, label: string): VoiceItem => ({
    value: voiceValue(voice),
    label,
    selected: voiceValue(voice) === voiceValue(selected)
  })
  const legacy = selected.kind === 'ai' && selected.id === 'default'
  const available =
    selected.kind === 'record' ||
    legacy ||
    settings.voice.clones.some(
      (clone) =>
        clone.state === 'ready' &&
        selected.kind === 'clone' &&
        clone.id === selected.id
    ) ||
    settings.voice.choices.some(
      (choice) => selected.kind === 'ai' && choice.id === selected.id
    )
  return [
    ...(available
      ? []
      : [
          {
            value: voiceValue(selected),
            label: 'Voice unavailable · choose a replacement',
            selected: true,
            missing: true
          }
        ]),
    item({ kind: 'record' }, 'I record it'),
    ...(legacy ? [item(selected, 'System default voice')] : []),
    ...settings.voice.clones
      .filter((clone) => clone.state === 'ready')
      .map((clone) => item({ kind: 'clone', id: clone.id }, 'My voice clone')),
    ...settings.voice.choices.map((choice) =>
      item({ kind: 'ai', id: choice.id }, `${choice.name} · ${choice.language}`)
    )
  ]
}

export const voiceChoices = (settings: StudioSettings, selected: Voice) =>
  voiceList(settings, selected)
    .map((voice) =>
      voice.missing
        ? `<option selected disabled value="${escape(voice.value)}">${escape(voice.label)}</option>`
        : `<option value="${escape(voice.value)}" ${voice.selected ? 'selected' : ''}>${escape(voice.label)}</option>`
    )
    .join('')

/** The same voices as radio rows, the studio's own menu rather than a
 * browser select (review 6). */
export const voiceRows = (settings: StudioSettings, selected: Voice) =>
  voiceList(settings, selected)
    .map(
      (voice) =>
        `<label class="voice-row${voice.missing ? ' is-missing' : ''}"><input type="radio" name="voice" value="${escape(voice.value)}" ${voice.selected ? 'checked' : ''} ${voice.missing ? 'disabled' : ''}><span>${escape(voice.label)}</span></label>`
    )
    .join('')
