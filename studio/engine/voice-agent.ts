// Studio AI, the voice collaborator on the content map: the Realtime
// session it runs in, the tools it works the canvas with, what Jev is asked
// about each thing the creator says, and the rule that decides whether a
// tool may change the canvas. All of it is plain data and pure functions;
// voice-relay.ts carries the sockets.
import type { JevAnswer, JevQuestion } from './jev'
import {
  VOICE_INTENTS,
  VOICE_TOOLS,
  type VoiceIntent,
  type VoiceReading
} from '../shared/voice'

export const realtimeModel = () =>
  process.env.STUDIO_REALTIME_MODEL?.trim() || 'gpt-realtime-2.1'
export const realtimeUrl = () =>
  `${process.env.STUDIO_REALTIME_URL?.trim() || 'wss://api.openai.com/v1/realtime'}?model=${encodeURIComponent(realtimeModel())}`
export const REALTIME_VOICE = 'marin'
export const TRANSCRIBE_MODEL = 'gpt-4o-mini-transcribe'

const text = (description: string) => ({ type: 'string', description })
const ref = (what: string) =>
  text(`${what}, by its id in the canvas text (such as c3, e2, d1)`)

type ToolSpec = {
  description: string
  properties: Record<string, unknown>
  required: string[]
}
const SPECS: Record<keyof typeof VOICE_TOOLS, ToolSpec> = {
  look: {
    description:
      'Move your cursor to something and show it, to point at what you talk about. Returns what it holds. Changes nothing.',
    properties: {
      target: text(
        'An id from the canvas text (c3, e2, d1, g1, k1), or series, cards or socials'
      )
    },
    required: ['target']
  },
  add_direction: {
    description:
      'Add a direction note: an idea that guides the next plan. Optionally wire it to what it guides.',
    properties: {
      text: text('The direction, in the creator’s words, one or two lines'),
      guides: ref('What it guides: an episode, a card, or series')
    },
    required: ['text']
  },
  wire_direction: {
    description:
      'Wire an existing direction to what it guides: an episode, a card, or the whole series.',
    properties: {
      direction: ref('The direction'),
      guides: ref('An episode, a card, or series')
    },
    required: ['direction', 'guides']
  },
  remove_direction: {
    description: 'Remove a direction note.',
    properties: { direction: ref('The direction') },
    required: ['direction']
  },
  add_note: {
    description:
      'Add material to the map as a note: it becomes cards. With a gap, the new card fills that gap.',
    properties: {
      text: text('The material, in the creator’s own words'),
      gap: ref('The gap it fills, when it fills one')
    },
    required: ['text']
  },
  copy_card: {
    description:
      'Copy a card into an episode, at the end or after a card already in it. The map keeps the original.',
    properties: {
      card: ref('The card'),
      episode: ref('The episode'),
      after: ref('A card already in that episode to put it after')
    },
    required: ['card', 'episode']
  },
  move_episode: {
    description: 'Put an episode right after another one, or first.',
    properties: {
      episode: ref('The episode to move'),
      after: text('The episode it comes after (its id), or first')
    },
    required: ['episode', 'after']
  },
  new_episode: {
    description:
      'Start a new episode: with cards, or say what it is about and the studio picks its cards.',
    properties: {
      about: text('What it is about, when the studio should pick its cards'),
      title: text('Its title'),
      cards: { type: 'array', items: ref('A card'), description: 'Its cards' }
    },
    required: []
  },
  set_brief: {
    description:
      'Set what a viewer can do by the end of the series (outcome), or who it is for (audience).',
    properties: {
      outcome: text('What a viewer can do by the end'),
      audience: text('Who the series is for')
    },
    required: []
  },
  plan_series: {
    description:
      'Plan the series again from every card: episodes, order, gaps. Big: first say what will change and ask; call with confirmed true only after the creator says yes.',
    properties: {
      ideas: text('The creator’s ideas for the episodes, if they gave any'),
      confirmed: {
        type: 'boolean',
        description: 'The creator said yes to planning again'
      }
    },
    required: ['confirmed']
  },
  gap_action: {
    description:
      'Act on a gap: explain (the episode explains it in a line) or set_aside.',
    properties: {
      gap: ref('The gap'),
      action: { type: 'string', enum: ['explain', 'set_aside'] }
    },
    required: ['gap', 'action']
  },
  undo_organize: {
    description:
      'Take out the cards the last organising run placed. Big: ask first; call with confirmed true only after a yes.',
    properties: {
      confirmed: { type: 'boolean', description: 'The creator said yes' }
    },
    required: ['confirmed']
  },
  add_comment: {
    description: 'Leave a comment pinned to something on the canvas.',
    properties: {
      on: ref('What it is pinned to, or series'),
      text: text('The comment, in the creator’s own words, adding nothing')
    },
    required: ['on', 'text']
  },
  reply_comment: {
    description: 'Reply to a comment.',
    properties: { comment: ref('The comment'), text: text('The reply') },
    required: ['comment', 'text']
  },
  resolve_comment: {
    description: 'Resolve a comment once it has been dealt with.',
    properties: { comment: ref('The comment') },
    required: ['comment']
  }
}

/** The tools, as the Realtime session takes them. */
export const toolDefinitions = () =>
  Object.entries(SPECS).map(([name, spec]) => ({
    type: 'function',
    name,
    description: spec.description,
    parameters: {
      type: 'object',
      properties: spec.properties,
      required: spec.required,
      additionalProperties: false
    }
  }))

export const instructionsFor = (canvas: string) =>
  `You are Studio AI, the creator's collaborator on the content map of Incredible Studio. The creator's notes become cards; cards are planned into a series of episodes, each building on the last; episodes become videos; socials are cut from made videos. You and the creator work on the same canvas: you have a cursor of your own, and the tools move it and do the work.

Speak briefly: one or two short sentences, warm and plain. The creator sees captions of what you both say.
When the creator asks for a change, do it with the tools at once, saying in a few words what you are doing. Notes, directions and comments keep the creator's own words. Planning the series again and undoing organising are big: say what will change, ask, and call the tool with confirmed true only after they say yes.
Call things by what the creator sees: Ep 2, a card's title, a direction's words. Use ids such as c3 or e2 only in tool calls; never say them aloud. Never invent an id: if something is not on the canvas, say so.
A tool may come back held: the creator's words did not read as asking for that change now. Do not mention the hold; ask in a few words whether they want it done.
Answer questions from the canvas below; use look to point at what you talk about. Open comments are the creator's notes to you and to themself.
Reply in the language the creator speaks.

The canvas now:
${canvas || '(loading)'}`

/** The whole session, sent once it is created. */
export const sessionUpdate = (canvas: string) => ({
  type: 'session.update',
  session: {
    type: 'realtime',
    model: realtimeModel(),
    output_modalities: ['audio'],
    audio: {
      input: {
        format: { type: 'audio/pcm', rate: 24000 },
        transcription: { model: TRANSCRIBE_MODEL },
        turn_detection: {
          type: 'semantic_vad',
          create_response: true,
          interrupt_response: true
        }
      },
      output: {
        format: { type: 'audio/pcm', rate: 24000 },
        voice: REALTIME_VOICE
      }
    },
    instructions: instructionsFor(canvas),
    tools: toolDefinitions(),
    tool_choice: 'auto'
  }
})

/** The canvas changed: only the instructions are sent again. */
export const instructionsUpdate = (canvas: string) => ({
  type: 'session.update',
  session: { type: 'realtime', instructions: instructionsFor(canvas) }
})

/** What Jev is asked about each thing the creator says, in one call. */
export const readingQuestions = (): Record<string, JevQuestion> => ({
  intent: {
    type: 'choice',
    instructions:
      'What does the creator want with their latest words, read in the light of the conversation? A short reply such as "yes" or "the second one" carries the intent of what it answers.',
    criteria: { ...VOICE_INTENTS }
  },
  act: {
    type: 'noul',
    instructions:
      "Do the creator's latest words ask Studio AI to change the canvas now (an instruction, a request, or a yes to a change it proposed), rather than ask, muse, chat or say no?",
    criteria: {
      true: 'They want something on the canvas changed now',
      false: 'They ask, think aloud, chat, hesitate or say no'
    }
  },
  yes: {
    type: 'noul',
    instructions:
      "Are the creator's latest words a yes to a change Studio AI just proposed or asked them to confirm?",
    criteria: {
      true: 'A clear yes to the change Studio AI proposed',
      false: 'A no, a doubt, something else, or nothing was proposed'
    }
  }
})

export type Turn = { who: 'creator' | 'ai'; said: string }

/** What Jev reads: the setting, the canvas in brief, the talk so far. */
export const readingState = (latest: string, talk: Turn[], canvas: string) => ({
  setting:
    'A creator talks with Studio AI, a voice collaborator on their content map: cards, a series of episodes planned from them, videos and socials.',
  canvas: canvas.slice(0, 1800),
  conversation: talk.slice(-8),
  latest
})

const unit = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : null

/** Jev's answers as a reading, or null when they are not all there. */
export const readingFrom = (
  answers: Record<string, JevAnswer>
): VoiceReading | null => {
  const { intent, act, yes } = answers
  if (intent?.type !== 'choice' || act?.type !== 'noul' || yes?.type !== 'noul')
    return null
  if (!(intent.choice in VOICE_INTENTS)) return null
  const probabilities: Partial<Record<VoiceIntent, number>> = {}
  for (const [key, value] of Object.entries(intent.probabilities || {})) {
    const p = unit(value)
    if (key in VOICE_INTENTS && p !== null)
      probabilities[key as VoiceIntent] = p
  }
  const actP = unit(act.noul)
  const yesP = unit(yes.noul)
  if (actP === null || yesP === null) return null
  return {
    intent: intent.choice as VoiceIntent,
    probabilities,
    act: actP,
    yes: yesP
  }
}

/** The intent in a few words, for a held tool's reason. */
export const INTENT_WORDS: Record<VoiceIntent, string> = {
  plan: 'talk about planning',
  direction: 'talk about a direction',
  material: 'talk about new material',
  episode: 'talk about the episodes',
  brief: 'talk about the outcome or audience',
  gap: 'talk about a gap',
  comment: 'talk about a comment',
  question: 'a question',
  chat: 'conversation'
}

export type Heard = { text: string; reading: VoiceReading | null } | null
export type GateDecision = { run: true } | { run: false; why: string }

/**
 * Whether a tool may run. Looking always may. A change runs when the
 * creator's latest words read as a request for it, now; a big change also
 * needs their yes. Without a reading (Jev is not set up, or did not answer)
 * a change runs, and a big one still needs the AI to have asked.
 */
export const gate = (
  name: string,
  args: Record<string, unknown>,
  heard: Heard
): GateDecision => {
  const tool = VOICE_TOOLS[name as keyof typeof VOICE_TOOLS]
  if (!tool) return { run: false, why: `There is no tool called ${name}` }
  if (!tool.changes) return { run: true }
  if (tool.big && args.confirmed !== true)
    return {
      run: false,
      why: 'This is a big change: say what it will do, ask, and call again with confirmed true after a yes'
    }
  if (!heard)
    return { run: false, why: 'The creator has not asked for anything yet' }
  const reading = heard.reading
  if (!reading) return { run: true }
  const said = `“${heard.text.slice(0, 120)}”`
  if (reading.act < 0.5)
    return {
      run: false,
      why: `Jev read ${said} as ${INTENT_WORDS[reading.intent]}, not a request to change the canvas. Answer it, or ask whether they want this done`
    }
  const families: readonly VoiceIntent[] = tool.families
  const fits = families.some(
    (family) =>
      reading.intent === family || (reading.probabilities[family] ?? 0) >= 0.15
  )
  if (!fits)
    return {
      run: false,
      why: `Jev read ${said} as ${INTENT_WORDS[reading.intent]}, which ${name} does not do. Check what the creator wants first`
    }
  if (tool.big && reading.yes < 0.5)
    return {
      run: false,
      why: 'The creator has not said yes to this yet: say what will change and ask'
    }
  return { run: true }
}
