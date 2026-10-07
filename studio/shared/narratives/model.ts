// What a narrative is made of. A narrative is the shape one kind of story
// must have: its beats, its rules, what its source must hold. It never says
// how many scenes there are or how a scene looks; the AI decides that at
// runtime, from the material and the direction. A direction is how one
// telling sounds and how long it runs, and every length is a range.

export type EvidenceKind =
  | 'numbers'
  | 'timeline'
  | 'code'
  | 'diff'
  | 'diagram'
  | 'demo'
  | 'terminal'
  | 'quote'
  | 'creator'
export type BeatFunction =
  | 'hook'
  | 'context'
  | 'problem'
  | 'explain'
  | 'evidence'
  | 'turn'
  | 'resolution'
  | 'payoff'
  | 'action'
export type Beat = {
  id: string
  name: string
  function: BeatFunction
  /** A core beat is always told; an optional one only when there is time. */
  core: boolean
  /** What the viewer must know after this beat. */
  know: string
  /** The kinds of evidence the beat can draw on, never how they are shown. */
  evidence: EvidenceKind[]
  /** A sketch of one way the beat could look, for the gallery only. */
  example: string
  /** How the beat grows in a long telling. */
  expansions: string[]
}

export type StoryGroupId =
  | 'explain'
  | 'teach'
  | 'decide'
  | 'look-back'
  | 'show'
  | 'announce'
  | 'share'
export type StoryGroup = { id: StoryGroupId; name: string; line: string }

export type PresetId =
  | 'short-dramatic'
  | 'briefing'
  | 'explainer'
  | 'deep-dive'
  | 'demo-led'
  | 'faceless'
export type Narrative = {
  id: string
  group: StoryGroupId
  name: string
  /** One line: what the story is. */
  line: string
  audience: string
  /** What the genre insists on. */
  rules: string[]
  /** What the source must hold for the story to work. */
  needs: string[]
  beats: Beat[]
  /** The direction a new video starts from, and those that do not suit. */
  preset: PresetId
  excludes: PresetId[]
}

/** A length in seconds, always a range: planning gets the range itself. */
export type LengthRange = [number, number]
export type Elaboration = 'brief' | 'standard' | 'thorough'
export type Drama = 'calm' | 'lively' | 'dramatic'
export type OnCamera = 'none' | 'ends' | 'guide' | 'leads'
export type Audience = 'team' | 'developers' | 'leaders' | 'customers'
export type Structure =
  | 'chronological'
  | 'cold-open'
  | 'result-first'
  | 'question-led'
export type DirectionSettings = {
  length: LengthRange
  elaboration: Elaboration
  drama: Drama
  onCamera: OnCamera
  /** The material that leads, when one should. */
  leads: EvidenceKind[]
  structure: Structure
  /** Who it is for, when the creator narrows it; else the narrative's own. */
  audience?: Audience
}
/** A shared preset. Faceless sets only who is on camera; the rest comes
 * from the narrative's own default. */
export type DirectionPreset = Partial<DirectionSettings> & {
  id: PresetId
  name: string
  line: string
}
/** A video's direction: a preset, and whatever the creator changed. */
export type Direction = { preset: PresetId } & Partial<DirectionSettings>

export const FUNCTION_LABELS: Record<BeatFunction, string> = {
  hook: 'Hook',
  context: 'Context',
  problem: 'Problem',
  explain: 'Explanation',
  evidence: 'Evidence',
  turn: 'Turn',
  resolution: 'Resolution',
  payoff: 'Payoff',
  action: 'Call to action'
}
export const EVIDENCE_LABELS: Record<EvidenceKind, string> = {
  numbers: 'Numbers',
  timeline: 'Timeline',
  code: 'Code',
  diff: 'Diff',
  diagram: 'Diagram',
  demo: 'Product demo',
  terminal: 'Terminal',
  quote: 'Quote',
  creator: 'You on camera'
}
export const ELABORATION_LABELS: Record<Elaboration, string> = {
  brief: 'Brief',
  standard: 'Standard',
  thorough: 'Thorough'
}
export const DRAMA_LABELS: Record<Drama, string> = {
  calm: 'Calm',
  lively: 'Lively',
  dramatic: 'Dramatic'
}
export const ON_CAMERA_LABELS: Record<OnCamera, string> = {
  none: 'Not on camera',
  ends: 'On camera at the start and end',
  guide: 'On camera as a guide',
  leads: 'On camera, leading it'
}
export const AUDIENCE_LABELS: Record<Audience, string> = {
  team: 'Your team',
  developers: 'Developers outside',
  leaders: 'Leaders',
  customers: 'Customers'
}
export const STRUCTURE_LABELS: Record<Structure, string> = {
  chronological: 'Chronological',
  'cold-open': 'Cold open',
  'result-first': 'Result first',
  'question-led': 'Question-led'
}

/** Where the speaker is in a scene; the AI frames each scene at runtime. */
export type SpeakerPlace = 'off' | 'corner' | 'beside' | 'full' | 'over'
export const SPEAKER_LABELS: Record<SpeakerPlace, string> = {
  off: 'Speaker off',
  corner: 'Speaker in the corner',
  beside: 'Speaker beside',
  full: 'Speaker full frame',
  over: 'Speaker full frame, words over them'
}

/** A length range in words: "45–90 s", "6–10 min". */
export const lengthLabel = ([min, max]: LengthRange) =>
  max < 120
    ? `${min}–${max} s`
    : `${Math.round(min / 6) / 10}–${Math.round(max / 6) / 10} min`

/**
 * Beats written as a table, one per line, the cells split by "|":
 * id | name | function | core or optional | what the viewer knows |
 * evidence kinds | example sketch | expansions, split by ";".
 */
export const beatTable = (rows: string): Beat[] =>
  rows
    .trim()
    .split('\n')
    .map((row) => {
      const [id, name, fn, core, know, evidence, example, expansions] = row
        .split('|')
        .map((cell) => cell.trim())
      return {
        id,
        name,
        function: fn as BeatFunction,
        core: core === 'core',
        know,
        evidence: evidence.split(/\s+/).filter(Boolean) as EvidenceKind[],
        example,
        expansions: (expansions || '')
          .split(';')
          .map((item) => item.trim())
          .filter(Boolean)
      }
    })

/** A narrative from its words and its table of beats. */
export const narrative = (
  head: Omit<Narrative, 'beats' | 'excludes'> & { excludes?: PresetId[] },
  rows: string
): Narrative => ({ excludes: [], ...head, beats: beatTable(rows) })
