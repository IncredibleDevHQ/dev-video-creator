// Video templates: the shape of an engineering explainer. A story (an
// incident walkthrough, a launch) is told by several templates, its
// variants; each is an ordered list of slots (templates/model.ts). The
// video's scenes (its locked wireframe pages) take the slots in order, and
// the planner shapes each scene's moments on its slot.
import type { Moment, Presence } from './model'
import { DECIDE_STORIES, DECIDE_TEMPLATES } from './templates/decide'
import { EXPLAIN_STORIES, EXPLAIN_TEMPLATES } from './templates/explain'
import { LOOK_BACK_STORIES, LOOK_BACK_TEMPLATES } from './templates/look-back'
import { SHOW_STORIES, SHOW_TEMPLATES } from './templates/show'
import {
  SEAM_LABELS,
  SLOT_TYPES,
  SPEAKER_LABELS,
  type Seam,
  type SpeakerPlace,
  type StoryGroup,
  type TemplateSlot,
  type TemplateStory,
  type VideoTemplate
} from './templates/model'

export * from './templates/model'

export const STORY_GROUPS: StoryGroup[] = [
  { id: 'explain', name: 'Explain' },
  { id: 'decide', name: 'Decide' },
  { id: 'look-back', name: 'Look back' },
  { id: 'show', name: 'Show' }
]
export const TEMPLATE_STORIES: TemplateStory[] = [
  ...EXPLAIN_STORIES,
  ...DECIDE_STORIES,
  ...LOOK_BACK_STORIES,
  ...SHOW_STORIES
]
export const VIDEO_TEMPLATES: VideoTemplate[] = [
  ...EXPLAIN_TEMPLATES,
  ...DECIDE_TEMPLATES,
  ...LOOK_BACK_TEMPLATES,
  ...SHOW_TEMPLATES
]

export const templateById = (id?: string | null) =>
  VIDEO_TEMPLATES.find((template) => template.id === id)
export const storyById = (id: string) =>
  TEMPLATE_STORIES.find((story) => story.id === id)!
/** A story's templates, in the catalog's order. */
export const storyTemplates = (storyId: string) =>
  VIDEO_TEMPLATES.filter((template) => template.story === storyId)
/** A template's full name: its story, then its own. */
export const templateTitle = (template: VideoTemplate) =>
  `${storyById(template.story).name}: ${template.name}`
/** The slot a card opens on: the template's cover, else its first. */
export const coverIndex = (template: VideoTemplate) =>
  Math.max(
    0,
    template.slots.findIndex((slot) => slot.id === template.cover)
  )
/** The share of a template's time the speaker is on camera, 0 to 1. */
export const cameraShare = (template: VideoTemplate) =>
  template.slots.reduce(
    (sum, slot) => sum + (slot.speaker === 'off' ? 0 : slot.to - slot.from),
    0
  ) / template.seconds

/** How a slot hands over: into the next scene, or it ends the video. */
export const seamLine = (seam: Seam) =>
  seam === 'end' ? 'Ends the video' : `${SEAM_LABELS[seam]} into the next`

/**
 * How the speaker is framed in a slot. Presence still decides when they
 * appear (Low: each scene's close; High: its open and close); the slot says
 * how: full frame, with words over them, beside the content or in the
 * corner. Off keeps them out.
 */
export const speakerPlace = (
  slot: TemplateSlot,
  presence: Presence
): SpeakerPlace => (presence === 'off' ? 'off' : slot.speaker)

/** The presenter layout a speaker place uses, or none when they are off. */
export const presenterLayoutFor = (
  place: SpeakerPlace
): Moment['layout'] | null =>
  place === 'full' || place === 'over'
    ? 'full-screen'
    : place === 'beside'
      ? 'beside-slide'
      : place === 'corner'
        ? 'corner'
        : null

/**
 * Which slot each scene takes, in order: the first scene opens, the last one
 * closes, and the scenes between spread over the middle slots by their time.
 * A creator's choice for a scene wins over this.
 */
export const assignSlots = (
  template: VideoTemplate,
  sceneCount: number
): TemplateSlot[] => {
  const slots = template.slots
  if (sceneCount <= 0) return []
  if (sceneCount === 1)
    return [
      slots.reduce((longest, item) =>
        item.to - item.from > longest.to - longest.from ? item : longest
      )
    ]
  const middle = slots.slice(1, -1)
  const assigned: TemplateSlot[] = [slots[0]]
  const start = middle[0]?.from ?? 0
  const end = middle.at(-1)?.to ?? 0
  for (let index = 1; index < sceneCount - 1; index++) {
    const at = start + ((index - 0.5) / (sceneCount - 2)) * (end - start)
    assigned.push(
      middle.find((item) => at >= item.from && at < item.to) ??
        middle.at(-1) ??
        slots[0]
    )
  }
  assigned.push(slots.at(-1)!)
  return assigned
}

/** The slot a scene plays: the creator's choice, or its place in order. */
export const sceneSlot = (
  template: VideoTemplate,
  scenes: Array<{ id: string; slot?: string | null }>,
  sceneId: string
): TemplateSlot | undefined => {
  const index = scenes.findIndex((scene) => scene.id === sceneId)
  if (index < 0) return undefined
  const chosen = template.slots.find((item) => item.id === scenes[index].slot)
  return chosen ?? assignSlots(template, scenes.length)[index]
}

/** The video's template and the slot this scene plays, when there is one. */
export const sceneTemplateSlot = (
  video:
    | {
        settings: { template?: string }
        scenes: Array<{ id: string; slot?: string | null }>
      }
    | null
    | undefined,
  sceneId: string
) => {
  const template = templateById(video?.settings.template)
  const slot = template && sceneSlot(template, video!.scenes, sceneId)
  return template && slot ? { template, slot } : null
}

/** What the planner is told about the slot a scene plays. */
export type SlotBrief = {
  story: string
  template: string
  audience: string
  slot: string
  role: string
  position: string
  type: string
  move: string
  speaker: string
  seconds: number
  seam: string
  builds: string[]
}
export const slotBrief = (
  template: VideoTemplate,
  slot: TemplateSlot,
  presence: Presence
): SlotBrief => {
  const story = storyById(template.story)
  return {
    story: story.name,
    template: template.name,
    audience: story.audience,
    slot: slot.id,
    role: slot.role,
    position: `${template.slots.indexOf(slot) + 1} of ${template.slots.length}`,
    type: SLOT_TYPES[slot.type].label,
    move: slot.move,
    speaker: SPEAKER_LABELS[speakerPlace(slot, presence)],
    seconds: slot.to - slot.from,
    seam: SEAM_LABELS[slot.seam],
    builds: slot.builds
  }
}
