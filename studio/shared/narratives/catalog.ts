// The narrative catalog: sixty-one narratives in seven groups, and the six
// shared directions resolved for each. A narrative gives the story its
// beats; a direction says how one telling sounds and how long it runs.
import { ANNOUNCE } from './announce'
import { DECIDE } from './decide'
import { EXPLAIN } from './explain'
import { LOOK_BACK } from './look-back'
import {
  AUDIENCE_LABELS,
  DRAMA_LABELS,
  ELABORATION_LABELS,
  EVIDENCE_LABELS,
  ON_CAMERA_LABELS,
  STRUCTURE_LABELS,
  type Direction,
  type DirectionSettings,
  type EvidenceKind,
  type Narrative,
  type PresetId,
  type StoryGroup,
  type StoryGroupId
} from './model'
import { PRESETS } from './presets'
import { SHARE } from './share'
import { SHOW } from './show'
import { TEACH } from './teach'

export const STORY_GROUPS: StoryGroup[] = [
  {
    id: 'explain',
    name: 'Explain',
    line: 'How something works, and why it is built that way.'
  },
  { id: 'teach', name: 'Teach', line: 'Get someone from stuck to working.' },
  {
    id: 'decide',
    name: 'Decide',
    line: 'Choices, the options, and the evidence behind them.'
  },
  {
    id: 'look-back',
    name: 'Look back',
    line: 'What happened, what you learned, what changed.'
  },
  {
    id: 'show',
    name: 'Show',
    line: 'Launches, releases and work in progress.'
  },
  {
    id: 'announce',
    name: 'Announce',
    line: 'Changes people need to know about, and when.'
  },
  { id: 'share', name: 'Share', line: 'Customers, teams, community and talks.' }
]
export const NARRATIVES: Narrative[] = [
  ...EXPLAIN,
  ...TEACH,
  ...DECIDE,
  ...LOOK_BACK,
  ...SHOW,
  ...ANNOUNCE,
  ...SHARE
]

export const narrativeById = (id?: string | null) =>
  NARRATIVES.find((item) => item.id === id)
export const groupById = (id: string) =>
  STORY_GROUPS.find((group) => group.id === id)
export const groupNarratives = (id: StoryGroupId) =>
  NARRATIVES.filter((item) => item.group === id)
export const presetById = (id?: string | null) =>
  PRESETS.find((preset) => preset.id === id)

/** The directions a narrative offers: every preset but those it excludes. */
export const allowedPresets = (narrative: Narrative) =>
  PRESETS.filter((preset) => !narrative.excludes.includes(preset.id))

/** The preset a telling uses: the one asked for when allowed, else the default. */
export const presetFor = (narrative: Narrative, id?: string | null) =>
  allowedPresets(narrative).some((preset) => preset.id === id)
    ? (id as PresetId)
    : narrative.preset

const SETTING_KEYS = [
  'length',
  'elaboration',
  'drama',
  'onCamera',
  'leads',
  'structure',
  'audience'
] as const
const settingsIn = (from: Partial<DirectionSettings>) =>
  Object.fromEntries(
    SETTING_KEYS.flatMap((key) =>
      from[key] === undefined ? [] : [[key, from[key]]]
    )
  ) as Partial<DirectionSettings>

/**
 * A telling's full settings: the narrative's default, then the preset (which
 * for Faceless only takes you off camera), then what the creator changed.
 */
export const directionSettings = (
  narrative: Narrative,
  direction?: Partial<Direction> | null
): DirectionSettings =>
  ({
    ...settingsIn(presetById('briefing')!),
    ...settingsIn(presetById(narrative.preset)!),
    ...settingsIn(presetById(presetFor(narrative, direction?.preset))!),
    ...settingsIn(direction ?? {})
  }) as DirectionSettings

const between = (value: unknown, min: number, max: number) =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= min &&
  value <= max

/**
 * A direction as the creator sent it, checked against the narrative. Every
 * length is a range, the shorter end first, from 15 seconds to 90 minutes.
 */
export const validDirection = (
  narrative: Narrative,
  raw: unknown
): Direction => {
  const value = (raw ?? {}) as Record<string, unknown>
  if (!allowedPresets(narrative).some((preset) => preset.id === value.preset))
    throw new Error('Choose one of the narrative’s directions')
  const direction: Direction = { preset: value.preset as PresetId }
  if (value.length !== undefined) {
    const length = value.length as unknown[]
    if (
      !Array.isArray(length) ||
      length.length !== 2 ||
      !between(length[0], 15, 5400) ||
      !between(length[1], 15, 5400) ||
      (length[0] as number) >= (length[1] as number)
    )
      throw new Error('Give the length as a range, the shorter end first')
    direction.length = [
      Math.round(length[0] as number),
      Math.round(length[1] as number)
    ]
  }
  const choose = (
    key: 'elaboration' | 'drama' | 'onCamera' | 'structure' | 'audience',
    labels: Record<string, string>,
    problem: string
  ) => {
    if (value[key] === undefined) return
    if (typeof value[key] !== 'string' || !Object.hasOwn(labels, value[key]))
      throw new Error(problem)
    Object.assign(direction, { [key]: value[key] })
  }
  choose('elaboration', ELABORATION_LABELS, 'Choose how much to elaborate')
  choose('drama', DRAMA_LABELS, 'Choose how dramatic it is')
  choose('onCamera', ON_CAMERA_LABELS, 'Choose how much you are on camera')
  choose('structure', STRUCTURE_LABELS, 'Choose how it is ordered')
  choose('audience', AUDIENCE_LABELS, 'Choose who it is for')
  if (value.leads !== undefined) {
    const leads = value.leads as unknown[]
    if (
      !Array.isArray(leads) ||
      leads.some(
        (kind) =>
          typeof kind !== 'string' || !Object.hasOwn(EVIDENCE_LABELS, kind)
      )
    )
      throw new Error('Choose the material that leads')
    direction.leads = [...new Set(leads as EvidenceKind[])]
  }
  return direction
}
