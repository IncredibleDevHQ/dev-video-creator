// What a video template is made of. A story (an incident walkthrough, a
// launch) is told by several templates, its variants: the same beats with a
// different mix of the speaker, words over them, diagrams, code, capture and
// charts. A template is an ordered list of slots; each slot is a role in the
// story with a length, a kind of shot, the speaker's place, one signature
// move and the seam into the next. The idea is HyperFrames' blueprint (a
// template for one shot) taken up one level, to the whole video.

export type SlotType =
  | 'motion'
  | 'explainer'
  | 'capture'
  | 'code'
  | 'data'
  | 'speaker'
  | 'captions'
/**
 * Where the speaker is: off camera, in the corner of the content, beside
 * it, full frame, or full frame with words set over them.
 */
export type SpeakerPlace = 'off' | 'corner' | 'beside' | 'full' | 'over'
export type Seam = 'cut' | 'match' | 'hold' | 'push' | 'cover' | 'zoom' | 'end'
export type TemplateSlot = {
  id: string
  role: string
  /** Seconds into the template, a guide the creator's words fill. */
  from: number
  to: number
  type: SlotType
  speaker: SpeakerPlace
  /** The sketch that plays the slot's signature move. */
  sketch: string
  move: string
  /** HyperFrames names the slot is built from: blueprints, rules, blocks. */
  builds: string[]
  seam: Seam
}
/** The stories, grouped by what the video does for its viewer. */
export type StoryGroupId =
  | 'explain'
  | 'teach'
  | 'decide'
  | 'look-back'
  | 'show'
  | 'announce'
  | 'share'
export type StoryGroup = { id: StoryGroupId; name: string; line: string }
export type TemplateStory = {
  id: string
  group: StoryGroupId
  name: string
  /** One line: what the story is and whom it is for. */
  line: string
  audience: string
}
export type VideoTemplate = {
  id: string
  story: string
  /** The variant's own name, said after the story's. */
  name: string
  /** One short line, for the gallery's cards. */
  tagline: string
  purpose: string
  tone: string
  pacing: string
  /** The slot a card opens on: the one that shows the variant best. */
  cover?: string
  seconds: number
  slots: TemplateSlot[]
}

export const SLOT_TYPES: Record<SlotType, { label: string; workflow: string }> =
  {
    motion: { label: 'Motion graphic', workflow: 'motion-graphics' },
    explainer: { label: 'Explainer', workflow: 'general-video' },
    capture: { label: 'Product capture', workflow: 'product-launch-video' },
    code: { label: 'Code', workflow: 'pr-to-video' },
    data: { label: 'Chart', workflow: 'motion-graphics' },
    speaker: { label: 'Speaker', workflow: 'talking-head-recut' },
    captions: { label: 'Captioned speaker', workflow: 'embedded-captions' }
  }

export const SPEAKER_LABELS: Record<SpeakerPlace, string> = {
  off: 'Speaker off',
  corner: 'Speaker in the corner',
  beside: 'Speaker beside',
  full: 'Speaker full frame',
  over: 'Speaker full frame, words over them'
}

export const SEAM_LABELS: Record<Seam, string> = {
  cut: 'Cut',
  match: 'Match',
  hold: 'Hold',
  push: 'Push',
  cover: 'Cover',
  zoom: 'Zoom',
  end: 'End'
}

/**
 * Slots written as a storyboard table, one per line, the cells split by
 * "|": id | role | seconds | type | speaker | sketch | seam | move | builds.
 * Seconds are each slot's own length; the slots follow one another from
 * zero. Builds are HyperFrames names, split by spaces.
 */
export const slotTable = (rows: string): TemplateSlot[] => {
  let at = 0
  return rows
    .trim()
    .split('\n')
    .map((row) => {
      const [id, role, seconds, type, speaker, sketch, seam, move, builds] = row
        .split('|')
        .map((cell) => cell.trim())
      const from = at
      at += Number(seconds)
      return {
        id,
        role,
        from,
        to: at,
        type: type as SlotType,
        speaker: speaker as SpeakerPlace,
        sketch,
        seam: seam as Seam,
        move,
        builds: builds ? builds.split(/\s+/) : []
      }
    })
}

/** A template from its story, its words and its storyboard table. */
export const variant = (
  head: Omit<VideoTemplate, 'seconds' | 'slots'>,
  rows: string
): VideoTemplate => {
  const slots = slotTable(rows)
  return { ...head, seconds: slots.at(-1)?.to ?? 0, slots }
}
