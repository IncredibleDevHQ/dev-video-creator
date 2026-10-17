// Where the make dialog starts: a made video as it is set, and a new one as
// its series is presented, when its notebook is an episode (review 8: a
// series told from notes opened on camera, with "I record it").
import type { Presence, VideoSettings, Voice } from '../shared/model'
import { narrativeById } from '../shared/narratives'
import type { SeriesLed } from '../shared/series'
import type { StudioSettings } from '../shared/settings'
import type { TemplateChoice } from './template-picker'

/** What a new video starts from: the template its wireframes were planned
 * from, the length its series asks, and who presents the series. */
export type MakePlan = Pick<
  VideoSettings,
  'narrative' | 'direction' | 'length'
> & { led?: SeriesLed }

/** The voice chosen in Settings, when it can speak now. */
const usable = ({ voice }: StudioSettings) => {
  const chosen = voice.selected
  return (chosen.kind === 'ai' &&
    (chosen.id === 'default' ||
      voice.choices.some((item) => item.id === chosen.id))) ||
    (chosen.kind === 'clone' &&
      voice.clones.some(
        (clone) => clone.state === 'ready' && clone.id === chosen.id
      ))
    ? chosen
    : undefined
}

/** The camera and the voice: off camera in a generated voice for a series
 * told from notes, on camera in the creator's own voice for one they
 * present, else as Make always started. With no voice to generate here,
 * the creator's own, and the dialog says what that asks of them. */
export const makeStart = (
  settings: StudioSettings,
  current?: Pick<VideoSettings, 'presence' | 'voice'>,
  led?: SeriesLed
): { presence: Presence; voice: Voice } => {
  const chosen = settings.voice.selected
  if (current)
    return {
      presence: current.presence || 'high',
      voice: current.voice || chosen
    }
  const first = settings.voice.choices[0]
  if (led === 'notes')
    return {
      presence: 'off',
      voice: usable(settings) ?? (first ? { kind: 'ai', id: first.id } : chosen)
    }
  if (led === 'presenter') {
    const clone = usable(settings)
    return {
      presence: 'high',
      voice: clone?.kind === 'clone' ? clone : { kind: 'record' }
    }
  }
  return { presence: 'high', voice: chosen }
}

/** The template a new video starts with, the one its wireframes were
 * planned from: off camera for a series told from notes, unless its
 * direction says how much the creator is on. */
export const plannedStory = (plan?: MakePlan): TemplateChoice | undefined => {
  if (!plan?.narrative) return undefined
  const narrative = narrativeById(plan.narrative)
  if (plan.led !== 'notes' || plan.direction?.onCamera || !narrative)
    return plan
  return {
    narrative: narrative.id,
    direction: {
      ...(plan.direction ?? { preset: narrative.preset }),
      onCamera: 'none'
    }
  }
}
