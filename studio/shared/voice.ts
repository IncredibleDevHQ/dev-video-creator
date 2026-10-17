// Talking with Studio AI on the content map: what the page and the engine
// say to each other over the voice socket, the tools the AI works the
// canvas with, and the comments a creator leaves by voice or by typing.

/** What the creator wants, as Jev reads one thing they said. */
export const VOICE_INTENTS = {
  plan: 'Plan or re-plan the series, or undo how new cards were organised',
  direction:
    'Give, change, wire or remove a direction: an idea about how the series or an episode should go',
  material: 'Add material (an idea, a fact, a link) that becomes cards',
  episode:
    'Change the episodes: start one, put a card into one, or change their order',
  brief: 'Say what a viewer can do by the end, or who the series is for',
  gap: 'Fill, explain or set aside something the series is missing',
  comment: 'Leave, answer or resolve a comment',
  question: 'Ask about the map, the series or what Studio AI thinks',
  chat: 'Greet, thank, think aloud, or anything else'
} as const
export type VoiceIntent = keyof typeof VOICE_INTENTS

/** Jev's reading of one thing the creator said. */
export type VoiceReading = {
  intent: VoiceIntent
  probabilities: Partial<Record<VoiceIntent, number>>
  /** The creator asked for a change now, rather than asking or musing. */
  act: number
  /** The creator said yes to a change Studio AI proposed. */
  yes: number
}

/** The canvas tools: which requests each belongs to, and whether it is big
 * enough that Studio AI asks first. */
export const VOICE_TOOLS = {
  look: { families: [], big: false, changes: false },
  add_direction: { families: ['direction'], big: false, changes: true },
  wire_direction: { families: ['direction'], big: false, changes: true },
  remove_direction: { families: ['direction'], big: false, changes: true },
  add_note: { families: ['material', 'gap'], big: false, changes: true },
  copy_card: { families: ['episode'], big: false, changes: true },
  move_episode: { families: ['episode'], big: false, changes: true },
  new_episode: { families: ['episode'], big: false, changes: true },
  set_brief: { families: ['brief'], big: false, changes: true },
  plan_series: { families: ['plan'], big: true, changes: true },
  gap_action: { families: ['gap', 'material'], big: false, changes: true },
  undo_organize: { families: ['plan'], big: true, changes: true },
  add_comment: { families: ['comment'], big: false, changes: true },
  reply_comment: { families: ['comment'], big: false, changes: true },
  resolve_comment: { families: ['comment'], big: false, changes: true }
} as const satisfies Record<
  string,
  { families: readonly VoiceIntent[]; big: boolean; changes: boolean }
>
export type VoiceToolName = keyof typeof VOICE_TOOLS

/** What a tool did, as the page tells it back. */
export type ToolOutcome = {
  ok: boolean
  /** What happened, in a line Studio AI can say. */
  did?: string
  error?: string
  /** What the AI looked at. */
  details?: string
}

/** From the page. The microphone goes as binary frames: PCM16, 24 kHz. */
export type VoiceClientMessage =
  | { type: 'context'; text: string }
  | { type: 'say'; text: string }
  | { type: 'tool_result'; call: string; output: ToolOutcome }
  | { type: 'played'; item: string; ms: number }
  | { type: 'stop' }

/** From the engine. */
export type VoiceServerMessage =
  | { type: 'ready'; voice: string; jev: boolean }
  | { type: 'speech'; state: 'started' | 'stopped' }
  | { type: 'you'; item: string; text: string; final: boolean }
  | { type: 'reading'; item: string; reading: VoiceReading | null }
  | { type: 'ai'; item: string; text: string; final: boolean }
  | { type: 'audio'; item: string; data: string }
  | {
      type: 'tool'
      call: string
      name: VoiceToolName
      args: Record<string, unknown>
    }
  | { type: 'held'; call: string; name: string; why: string }
  | { type: 'busy'; state: 'thinking' | 'idle' }
  | { type: 'error'; message: string; code?: 'no-key' }
  | { type: 'closed'; reason: string }

/** What a comment is pinned to. */
export type CommentTarget =
  | { kind: 'page' | 'copy' | 'lane' | 'direction' | 'gap'; id: string }
  | { kind: 'series' }
  | { kind: 'spot'; x: number; y: number }

/** What a comment is, as Jev reads it: each offers one next step. */
export const COMMENT_KINDS = {
  direction:
    'An idea about how the series or an episode should go: what to cover, in what order, for whom',
  material:
    'New content to use: a fact, an example, a link, a story that could become a card',
  question: 'A question or a request for Studio AI to answer or do',
  remark: 'A reaction, a reminder or a note to self'
} as const
export type CommentKind = keyof typeof COMMENT_KINDS

export type CommentEntry = {
  id: string
  at: string
  by: 'creator' | 'ai'
  text: string
  /** The recording, when it was said rather than typed. */
  audio?: { objectKey: string; seconds: number }
  /** The recording could not be written down; it can still be played. */
  unheard?: boolean
}

export type MapComment = CommentEntry & {
  target: CommentTarget
  state: 'open' | 'resolved'
  kind?: CommentKind
  /** How sure Jev was of its kind. */
  sure?: number
  /** What resolving it did, in a few words. */
  outcome?: string
  replies: CommentEntry[]
}

/** The longest comment recording, in seconds. */
export const COMMENT_SECONDS = 60
