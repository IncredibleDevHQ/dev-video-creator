import type { ActorBoundary } from './continuity'
import { expandBehavior, type BehaviorCall } from './object-behavior'
import { orderEvents, type EventTiming, type TimingDiagnostic, type EventMilestone } from './event-schedule'
// The scene program: what happens on a page, as a sequence of events.
//
// A window of dialogue says what a line is about; it cannot say that this
// request spent that token, or that the next one found the bucket empty.
// A program can. It names the cast with their starting state and quantity,
// then a few story beats — establish, explain, tension, consequence,
// resolve — each carrying the events that fire while its line is spoken.
//
// Nothing here draws: the page drew every object, including the actors that
// start hidden. The compiler turns events into the motion ops the driver
// already runs, so a program is a better author of the same plan, not a
// second renderer.
import {
  MOTION_DURATION_MS,
  MOTION_EASE_FOR,
  boxCarriedBy,
  type MotionAction,
  type MotionBeat,
  type MotionIntent,
  type MotionOp,
  type MotionPlanV2,
} from 'markdown-composition'
import { flattenUnits, leafUnits, type SlideUnit } from './slide-atoms'
import type { SceneWindow, WindowLayout } from './script-plan'

export const PROGRAM_ACTIONS = [
  'behavior', // a versioned recipe bound to accepted artwork
  'appear',    // the object comes on screen where it is
  'travel',    // the object moves to another object's place
  'spend',     // a quantity goes down on the actor
  'refill',    // a quantity goes up on the actor
  'pass',      // the actor reaches its target and the target acknowledges
  'reject',    // the actor is turned away at its target
  'become',    // the actor turns into its target
  'highlight', // the actor takes the eye without moving
  'leave',     // the object goes off screen
  'state',     // the actor's state changes (running, loaded, failing…)
  'perform',   // seek an authored object's local animation from the scene clock
] as const
export type ProgramAction = (typeof PROGRAM_ACTIONS)[number]
const MOMENTS = ['establish', 'explain', 'tension', 'consequence', 'resolve', 'aside'] as const
export type ProgramMoment = (typeof MOMENTS)[number]

export type ProgramActor = {
  id: string
  role?: string
  state?: string
  // What the thing holds, when it holds anything countable: tokens in a
  // bucket, slots in a pool. The compiler counts it up and down on screen.
  //
  // One quantity, shown every way the artwork can show it: a number counts, a
  // bar drains, and countable pieces leave one at a time. `shownOn` is the
  // number or the bar; `counted` names the pieces — "bucket.tokens" when the
  // drawing gave them a group, and each child of that group is one unit.
  quantity?: { of?: string; value: number; max?: number; shownOn?: string; counted?: string }
  // Which piece of its artwork answers which kind of event: the indicator
  // that lights while it works, the mark that turns when a call is refused.
  shows?: { spend?: string; refill?: string; pass?: string; reject?: string; arrive?: string }
}

export type ProgramEvent = {
  // A name of its own, so an author can nudge this event's timing and the
  // nudge survives the line being rewritten, split, merged or re-cut.
  id?: string
  behavior?: BehaviorCall
  guard?: { actor: string; notState: string }
  actor: string
  action: ProgramAction
  to?: string
  amount?: number
  state?: string
  cue?: string
  holdMs?: number
  // Later or earlier than where the words put it, in milliseconds.
  nudgeMs?: number
  clip?: { fromMs: number; toMs: number; durationMs: number }
  atMs?: number
  after?: string
  dependsOn?: Array<{ event: string; milestone: EventMilestone }>
  anchor?: EventMilestone
  durationMs?: number
}

// A cue is a spoken word; "retry#2" pins the second occurrence when the word
// repeats in the same line — a stable occurrence identity, not a fresh
// first-match search (D5). The bare word always means its first occurrence.
export const splitCue = (cue: string): { word: string; occurrence: number } => {
  const match = /^(.*?)(?:#(\d+))?$/.exec(cue.trim())
  return { word: (match?.[1] || cue).trim(), occurrence: Math.max(1, Number(match?.[2]) || 1) }
}

// Recomposing the page on purpose: a thing is made bigger, sent to one side,
// or cleared away because the story has moved on. It keeps its identity — the
// same element, still nameable by every later beat.
export const STAGE_PLACES = ['left', 'right', 'centre', 'up', 'down'] as const
export type StagePlace = (typeof STAGE_PLACES)[number]
export type ProgramStaging = { id: string; grow?: number; to?: StagePlace; clear?: boolean }

export type ProgramBeat = {
  id?: string
  moment?: ProgramMoment
  heading?: string
  say: string
  events?: ProgramEvent[]
  camera?: string[] | 'page'
  speaker?: WindowLayout
  restage?: ProgramStaging[]
  // Moments that ended up sharing this one's line — when two beats are merged
  // into one paragraph, the second keeps its own events, staging and shot, and
  // plays after the first inside the same line.
  then?: ProgramBeat[]
  durationMs?: number
  words?: Array<{ word: string; startMs: number; endMs: number }>
}

export type SceneProgram = {
  version: 1
  initialState?: ActorBoundary[]
  scheduling?: 2
  page?: string
  // 'take': the beats were aligned to a recorded take (explainer_align_take),
  // so their durations and word anchors are measured spans of the take's own
  // clock — the compiler adds no holds of its own between them.
  clock?: 'take'
  cast: ProgramActor[]
  beats: ProgramBeat[]
}

const MOMENT_INTENT: Record<string, MotionIntent> = {
  establish: 'introduce',
  explain: 'flow',
  tension: 'emphasize',
  consequence: 'transform',
  resolve: 'recap',
  aside: 'transition',
}
// A consequence needs a moment of silence to land; an establish does not.
const MOMENT_HOLD: Record<string, number> = { establish: 200, explain: 260, tension: 420, consequence: 900, resolve: 500, aside: 200 }

const asString = (value: unknown, limit = 80) => String(value ?? '').trim().slice(0, limit)

export const sanitizeSceneProgram = (raw: unknown, units: SlideUnit[]): SceneProgram | null => {
  if (!raw || typeof raw !== 'object') return null
  const known = new Set(flattenUnits(units).flatMap(unit => [unit.id, ...unit.ids]))
  // A thing may also be named through the artwork it wears: "bucket.tokens".
  flattenUnits(units).forEach(unit => {
    Object.keys(unit.appearance?.parts || {}).forEach(part => known.add(`${unit.id}.${part}`))
  })
  // A thing that asked for a drawn object may name its pieces before the
  // drawing arrives: the page said what it wants, and a wireframe stage is
  // not the moment to throw that away. The compiler resolves the piece when
  // there is one and passes over it when there is not.
  const asksFor = new Set(flattenUnits(units).filter(unit => unit.objectName).flatMap(unit => [unit.id, ...unit.ids]))
  const namesSomething = (name: string) =>
    known.has(name) || (name.includes('.') && asksFor.has(name.slice(0, name.indexOf('.'))))
  const value = raw as Record<string, unknown>
  const cast = (Array.isArray(value.cast) ? value.cast : [])
    .map(entry => {
      const actor = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>
      const id = asString(actor.id, 120)
      if (!id || !known.has(id)) return null
      const quantity = actor.quantity && typeof actor.quantity === 'object' ? (actor.quantity as Record<string, unknown>) : null
      const shownOn = quantity ? asString(quantity.shownOn, 120) : ''
      const counted = quantity ? asString(quantity.counted, 120) : ''
      const shows = (actor.shows && typeof actor.shows === 'object' ? actor.shows : {}) as Record<string, unknown>
      const reactions = Object.fromEntries(
        (['spend', 'refill', 'pass', 'reject', 'arrive'] as const)
          .map(kind => [kind, asString(shows[kind], 120)])
          .filter(([, piece]) => piece && namesSomething(piece as string)),
      )
      return {
        id,
        role: asString(actor.role, 24) || undefined,
        state: asString(actor.state, 24) || undefined,
        ...(Object.keys(reactions).length ? { shows: reactions } : {}),
        ...(quantity && Number.isFinite(Number(quantity.value))
          ? {
              quantity: {
                of: asString(quantity.of, 24) || 'items',
                value: Math.max(0, Math.round(Number(quantity.value))),
                ...(Number.isFinite(Number(quantity.max)) ? { max: Math.max(1, Math.round(Number(quantity.max))) } : {}),
                ...(shownOn && namesSomething(shownOn) ? { shownOn } : {}),
                ...(counted && namesSomething(counted) ? { counted } : {}),
              },
            }
          : {}),
      } as ProgramActor
    })
    .filter((actor): actor is ProgramActor => Boolean(actor))
    .slice(0, 24)
  const cleanBeat = (entry: unknown, nested: boolean): ProgramBeat | null => {
      const beat = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>
      const say = asString(beat.say, 600)
      if (!say) return null
      const events = (Array.isArray(beat.events) ? beat.events : [])
        .map((item, index) => {
          const event = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
          const actor = asString(event.actor, 120)
          const act = PROGRAM_ACTIONS.includes(event.action as ProgramAction) ? (event.action as ProgramAction) : null
          // The cast is where a thing's state lives, not a guest list: an
          // event may name anything the page drew.
          if (!act || !namesSomething(actor)) return null
          const to = asString(event.to, 120)
          const nudge = Number(event.nudgeMs)
          return {
            id: asString(event.id, 40) || `${act}-${actor}-${index}`,
            actor,
            action: act,
            ...(act === 'behavior' && event.behavior ? { behavior: event.behavior as BehaviorCall } : {}),
            ...(Array.isArray(event.dependsOn) ? { dependsOn: event.dependsOn.filter(d => d && typeof d.event === 'string' && ['start', 'arrival', 'outcome', 'settled'].includes(d.milestone)).map(d => ({ event: asString(d.event, 40), milestone: d.milestone })) } : {}),
            ...(['start', 'arrival', 'outcome', 'settled'].includes(String(event.anchor)) ? { anchor: event.anchor as EventMilestone } : {}),
            ...(Number.isFinite(event.durationMs) && Number(event.durationMs) > 0 ? { durationMs: Math.min(30_000, Number(event.durationMs)) } : {}),
            ...(typeof event.after === 'string' ? { after: asString(event.after, 40) } : {}),
            ...(Number.isFinite(event.atMs) ? { atMs: Math.max(0, Math.min(120_000, Number(event.atMs))) } : {}),
            ...(event.clip && typeof event.clip === 'object' ? { clip: {
              fromMs: Math.max(0, Number((event.clip as ProgramEvent['clip'])?.fromMs) || 0),
              toMs: Math.max(0, Number((event.clip as ProgramEvent['clip'])?.toMs) || 0),
              durationMs: Math.max(100, Math.min(30_000, Number((event.clip as ProgramEvent['clip'])?.durationMs) || 1000)),
            } } : {}),
            ...(Number.isFinite(nudge) && nudge !== 0 ? { nudgeMs: Math.max(-4_000, Math.min(4_000, Math.round(nudge))) } : {}),
            ...(to && namesSomething(to) ? { to } : {}),
            ...(Number.isFinite(Number(event.amount)) ? { amount: Math.max(1, Math.round(Number(event.amount))) } : {}),
            ...(asString(event.state, 24) ? { state: asString(event.state, 24) } : {}),
            ...(asString(event.cue, 40) ? { cue: asString(event.cue, 40) } : {}),
            ...(Number.isFinite(Number(event.holdMs)) ? { holdMs: Math.max(0, Math.min(3_000, Number(event.holdMs))) } : {}),
          } as ProgramEvent
        })
        .filter((event): event is ProgramEvent => Boolean(event))
        .slice(0, 64)
      const restage = (Array.isArray(beat.restage) ? beat.restage : [])
        .map(item => {
          const entry = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
          const id = asString(entry.id, 120)
          if (!id || !known.has(id)) return null
          const grow = Number(entry.grow)
          const to = asString(entry.to, 12) as StagePlace
          return {
            id,
            ...(Number.isFinite(grow) && grow > 0 ? { grow: Math.max(0.2, Math.min(3, grow)) } : {}),
            ...(STAGE_PLACES.includes(to) ? { to } : {}),
            ...(entry.clear === true ? { clear: true } : {}),
          } as ProgramStaging
        })
        .filter((entry): entry is ProgramStaging => Boolean(entry) && Boolean(entry!.grow || entry!.to || entry!.clear))
        .slice(0, 8)
      const rawCamera = beat.camera
      const camera =
        rawCamera === 'page'
          ? ('page' as const)
          : (Array.isArray(rawCamera) ? rawCamera : []).map(id => asString(id, 120)).filter(id => known.has(id))
      // Moments merged into this one's line keep everything but their own
      // line; they are never nested further than one deep.
      const then = nested
        ? []
        : (Array.isArray(beat.then) ? beat.then : [])
            .map(item => cleanBeat(item, true))
            .filter((item): item is ProgramBeat => Boolean(item))
            .slice(0, 6)
      return {
        id: asString(beat.id, 40) || undefined,
        heading: asString(beat.heading, 120) || undefined,
        moment: MOMENTS.includes(beat.moment as ProgramMoment) ? (beat.moment as ProgramMoment) : undefined,
        say,
        events,
        ...(Number.isFinite(beat.durationMs) && Number(beat.durationMs) > 0 ? { durationMs: Number(beat.durationMs) } : {}),
        ...(Array.isArray(beat.words) ? { words: beat.words.filter(w => w && typeof w.word === 'string' && Number.isFinite(w.startMs) && Number.isFinite(w.endMs) && w.startMs >= 0 && w.endMs >= w.startMs).slice(0, 300) } : {}),
        ...(camera === 'page' ? { camera: 'page' as const } : camera.length ? { camera } : {}),
        ...(restage.length ? { restage } : {}),
        ...(beat.speaker === 'me' || beat.speaker === 'beside' || beat.speaker === 'page' ? { speaker: beat.speaker as WindowLayout } : {}),
        ...(then.length ? { then } : {}),
      } as ProgramBeat
  }
  const beats = (Array.isArray(value.beats) ? value.beats : [])
    .map(entry => cleanBeat(entry, false))
    .filter((beat): beat is ProgramBeat => Boolean(beat))
    .slice(0, 16)
  if (!cast.length || !beats.length) return null
  return { version: 1, ...(Array.isArray(value.initialState) ? { initialState: value.initialState.filter(a => a && known.has(a.id) && [a.dx, a.dy, a.scale, a.bounds?.x, a.bounds?.y, a.bounds?.width, a.bounds?.height].every(Number.isFinite) && a.scale > 0) } : {}), ...(value.scheduling === 2 ? { scheduling: 2 as const } : {}), page: asString(value.page, 120) || undefined, ...(value.clock === 'take' ? { clock: 'take' as const } : {}), cast, beats }
}

const act = (op: MotionOp, targets: string[], startMs: number, extra: Partial<MotionAction> = {}): MotionAction => ({
  op,
  targets,
  startMs,
  durationMs: MOTION_DURATION_MS[op],
  ease: MOTION_EASE_FOR[op],
  persistence: 'state',
  ...extra,
})

const speechMs = (text: string, wpm: number) => Math.max(900, Math.round((text.split(/\s+/).filter(Boolean).length / wpm) * 60_000))

/**
 * A program becomes the plan the driver already runs: events become ops in
 * the order they happen, quantities become counts and levels, and a
 * consequence gets its silence. The windows it returns are the dialogue, so
 * captions, the director and the timeline are unchanged.
 */
type Box = { x: number; y: number; width: number; height: number }

type Held = { of?: string; value: number; max?: number; shownOn?: string; counted?: string }

// Where a recomposed thing goes: the page's own thirds, so two outcomes end
// up on opposite sides and a subject ends up in the middle of the frame.
const placeOn = (place: StagePlace, box: Box, viewBox: { width: number; height: number }) => {
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  const margin = Math.max(box.width, box.height) / 2 + viewBox.width * 0.04
  const target = {
    left: { x: Math.max(margin, viewBox.width * 0.25), y: centre.y },
    right: { x: Math.min(viewBox.width - margin, viewBox.width * 0.75), y: centre.y },
    centre: { x: viewBox.width / 2, y: viewBox.height / 2 },
    up: { x: centre.x, y: Math.max(margin, viewBox.height * 0.28) },
    down: { x: centre.x, y: Math.min(viewBox.height - margin, viewBox.height * 0.72) },
  }[place]
  return { dx: Math.round(target.x - centre.x), dy: Math.round(target.y - centre.y) }
}

// Where a travelling thing stops: at the edge of what it is going to, not on
// top of it. Landing on the centre buries the target's own label.
const travelTo = (from: Box, to: Box) => {
  const vx = to.x + to.width / 2 - (from.x + from.width / 2)
  const vy = to.y + to.height / 2 - (from.y + from.height / 2)
  const holdW = to.width / 2 + from.width / 2 - 10
  const holdH = to.height / 2 + from.height / 2 - 10
  const share = Math.min(
    1,
    Math.abs(vx) > 1 ? holdW / Math.abs(vx) : Number.POSITIVE_INFINITY,
    Math.abs(vy) > 1 ? holdH / Math.abs(vy) : Number.POSITIVE_INFINITY,
  )
  return { dx: Math.round(vx * (1 - share)), dy: Math.round(vy * (1 - share)) }
}

// An edit changes what is said, not what happens. The words, the presenter's
// place and the camera come back from the cards; the events stay the author's
// and follow their own words — so a line can be split, merged or rewritten
// without the story falling out of it.
const saidWords = (text: string) => text.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean)
// Word pairs, not words: every line in a scene talks about the same things, so
// single words match everywhere and would put a beat's events in the wrong
// line. A pair of adjacent words belongs to the line that was written.
const wordPairs = (text: string) => {
  const words = saidWords(text)
  if (words.length < 2) return words
  return words.slice(0, -1).map((word, index) => `${word} ${words[index + 1]}`)
}
// How much of a beat's line still lives in a window's text.
const carriedOver = (beatSay: string, windowSay: string) => {
  const said = saidWords(beatSay).join(' ')
  const now = saidWords(windowSay).join(' ')
  if (said && now.includes(said)) return 1
  const pairs = wordPairs(beatSay)
  if (!pairs.length) return 0
  const present = new Set(wordPairs(windowSay))
  return pairs.filter(pair => present.has(pair)).length / pairs.length
}
export const programWithEdits = (program: SceneProgram, windows: SceneWindow[]): SceneProgram => {
  // Every moment in the scene, including those already sharing a line: each
  // one is lined up on its own, so splitting a merged paragraph gives them
  // back their own beats.
  const beats = program.beats.flatMap(beat => [{ ...beat, then: undefined }, ...(beat.then || [])])
  if (!beats.length || !windows.length) return program
  // Lining the beats up with the lines on screen: an alignment, not a lookup.
  // Beats keep their order, two beats may land in one merged line, and a line
  // written from scratch still holds the beat that was in its place — so the
  // events never cross each other or jump to the end of the scene.
  const span = Math.max(beats.length, windows.length)
  const carries = beats.map(beat => windows.map(window => carriedOver(beat.say, window.say)))
  const fit = (at: number, index: number) => carries[at][index] + 0.2 * (1 - Math.abs(at - index) / span)
  const best: number[][] = Array.from({ length: beats.length + 1 }, () => new Array(windows.length + 1).fill(-Infinity))
  best[0][0] = 0
  for (let j = 1; j <= windows.length; j += 1) best[0][j] = 0
  for (let i = 1; i <= beats.length; i += 1) {
    for (let j = 1; j <= windows.length; j += 1) {
      const paired = best[i - 1][j - 1] + fit(i - 1, j - 1)
      // Two beats in one line only when there is no line of their own left.
      const merged = best[i - 1][j] + fit(i - 1, j - 1) - 0.05
      const spare = best[i][j - 1]
      best[i][j] = Math.max(paired, merged, spare)
    }
  }
  const home = new Map<number, number>()
  let i = beats.length
  let j = windows.length
  while (i > 0 && j > 0) {
    const paired = best[i - 1][j - 1] + fit(i - 1, j - 1)
    const merged = best[i - 1][j] + fit(i - 1, j - 1) - 0.05
    const spare = best[i][j - 1]
    if (best[i][j] === paired) {
      home.set(i - 1, j - 1)
      i -= 1
      j -= 1
    } else if (best[i][j] === merged) {
      home.set(i - 1, j - 1)
      i -= 1
    } else {
      void spare
      j -= 1
    }
  }
  while (i > 0) {
    home.set(i - 1, 0)
    i -= 1
  }
  // A line cut in two: an event whose cue word went to the other half goes
  // with it. Only halves of the same line are considered, so a word that
  // happens to appear elsewhere in the scene moves nothing.
  const lands = new Map<number, ProgramEvent[]>()
  const give = (index: number, event: ProgramEvent) => lands.set(index, [...(lands.get(index) || []), event])
  // Windows no beat was aligned to: these are the other halves of a line that
  // was cut in two, and the only places an event may follow its cue word to.
  const claimed = new Set(home.values())
  // Provenance: this window's own words are a piece of that beat's line, or
  // most of the line is here. A reworded line matches neither.
  const cutFrom = (at: number, index: number) => {
    const line = saidWords(beats[at].say).join(' ')
    const part = saidWords(windows[index].say).join(' ')
    return (part.length > 8 && line.includes(part)) || carries[at][index] >= 0.4
  }
  // Any fragment of the same line, not only the one next to it: a paragraph
  // cut into three sends each event to the sentence that names its cue.
  const otherHalf = (at: number, where: number, cue: string) =>
    windows.findIndex(
      (window, index) =>
        index !== where &&
        !claimed.has(index) &&
        cutFrom(at, index) &&
        window.say.toLowerCase().includes(cue),
    )
  beats.forEach((beat, at) => {
    const where = home.get(at)
    if (where === undefined) return
    ;(beat.events || []).forEach(event => {
      const cue = event.cue ? splitCue(event.cue).word.toLowerCase() : ''
      // Rewording a line is not a split: its events stay in its beat, whatever
      // other lines in the scene happen to say.
      if (!cue || windows[where].say.toLowerCase().includes(cue)) return give(where, event)
      const half = otherHalf(at, where, cue)
      give(half >= 0 ? half : where, event)
    })
  })
  return {
    ...program,
    beats: windows.map((window, index) => {
      const mine = beats.map((beat, at) => ({ beat, at })).filter(entry => home.get(entry.at) === index)
      const first = mine[0]?.beat
      const speaker = window.layoutByAuthor && (window.layout === 'me' || window.layout === 'beside' || window.layout === 'page') ? window.layout : first?.speaker
      // Three states, not two: no camera line at all (the shot carries on),
      // back to the page, or a named close-up.
      const camera = window.camera === undefined ? first?.camera : window.camera.length ? window.camera : ('page' as const)
      // The events this line now carries, split back among the moments that
      // own them, so a moment merged into the line keeps its own staging and
      // its own place in the sequence rather than being folded into the first.
      const carried = lands.get(index) || []
      const mineEvents = new Map<number, ProgramEvent[]>()
      carried.forEach(event => {
        const owner = mine.find(entry => (entry.beat.events || []).includes(event))?.at ?? mine[0]?.at ?? -1
        mineEvents.set(owner, [...(mineEvents.get(owner) || []), event])
      })
      const later = mine.slice(1).map(entry => ({
        id: entry.beat.id,
        moment: entry.beat.moment,
        say: entry.beat.say,
        events: mineEvents.get(entry.at) || [],
        ...(entry.beat.restage?.length ? { restage: entry.beat.restage } : {}),
        ...(entry.beat.camera ? { camera: entry.beat.camera } : {}),
      }))
      const restage = first?.restage || []
      return {
        id: first?.id || `b${index + 1}`,
        moment: first?.moment || ('explain' as const),
        say: window.say,
        ...(mine.length === 1 && first?.say === window.say ? { durationMs: first.durationMs, words: first.words } : {}),
        events: mineEvents.get(mine[0]?.at ?? -1) || carried.filter(event => !later.some(part => part.events.includes(event))),
        ...(restage.length ? { restage } : {}),
        ...(camera ? { camera } : {}),
        ...(speaker ? { speaker } : {}),
        ...(later.length ? { then: later } : {}),
      }
    }),
  }
}

export const compileSceneProgram = (
  program: SceneProgram,
  units: SlideUnit[],
  options: { viewBox: { width: number; height: number }; wpm?: number; fps?: number },
): { windows: SceneWindow[]; plan: MotionPlanV2; schedule: EventTiming[]; diagnostics: TimingDiagnostic[]; boundaryState: ActorBoundary[]; arrivals: Array<{ event: string; beat: number; actor: string; x: number; y: number }> } | null => {
  const diagnostics: TimingDiagnostic[] = []
  const schedule: EventTiming[] = []
  const arrivals: Array<{ event: string; beat: number; actor: string; x: number; y: number }> = []
  const modern = program.scheduling === 2
  const wpm = options.wpm || 150
  // A take-aligned program runs on the take's own clock: each beat's measured
  // span already reaches the next beat's first word, so no moment hold is
  // added — inserting one would stretch the scene off the recorded delivery.
  const takeClock = program.clock === 'take' || (modern && program.beats.every(b => b.durationMs && b.words?.length))
  const leaves = leafUnits(units)
  const unitFor = (id: string) => leaves.find(unit => unit.id === id || unit.ids.includes(id)) || flattenUnits(units).find(unit => unit.id === id)
  // A thing, or one named piece of the artwork it wears: "bucket.tokens" is
  // the tokens inside the bucket, whatever element id the drawing gave them
  // and whatever the composition later prefixes it with.
  const partOf = (id: string) => {
    const dot = id.lastIndexOf('.')
    if (dot < 1) return ''
    const owner = unitFor(id.slice(0, dot))
    return owner?.appearance?.parts[id.slice(dot + 1)] || ''
  }
  const idsOf = (id: string) => {
    const part = partOf(id)
    if (part) return [part]
    return unitFor(id)?.ids || [id]
  }
  const boxOf = (id: string) => unitFor(partOf(id) || id)?.bbox
  const clipStates = new Map<string, Record<string, number>>()
  const actorStates = new Map(program.cast.map(actor => [actor.id, actor.state]))
  const held = new Map(program.cast.filter(actor => actor.quantity).map(actor => [actor.id, { ...actor.quantity! }]))
  // Which piece of an actor's artwork answers which kind of event.
  const reacting = new Map(program.cast.filter(actor => actor.shows).map(actor => [actor.id, actor.shows!]))
  const reactionFor = (actorId: string, action: ProgramAction) => {
    const piece = reacting.get(actorId)?.[action === 'travel' ? 'arrive' : (action as 'spend' | 'refill' | 'pass' | 'reject')]
    return piece ? partOf(piece) || piece : ''
  }
  // How much a thing holds, shown the way the page drew it: a number counts,
  // anything else is a bar and moves by how full it is.
  // The countable pieces of a thing, in the order they were drawn: the
  // children of the group the quantity names, one element per unit held.
  const piecesOf = (name: string | undefined) => {
    if (!name) return []
    const group = partOf(name) || name
    const owner = unitFor(name.split('.')[0])
    const parts = owner?.appearance?.parts || {}
    const prefix = `${name.split('.').slice(1).join('.')}-`
    const numbered = Object.keys(parts)
      .filter(part => part.startsWith(prefix) && /\d+$/.test(part))
      .sort((a, b) => Number(a.match(/\d+$/)![0]) - Number(b.match(/\d+$/)![0]))
      .map(part => parts[part])
    if (numbered.length) return numbered
    // No numbered siblings: the group itself is the only piece there is.
    return group ? [group] : []
  }
  const showQuantity = (store: Held, before: number, after: number, at: number): MotionAction[] => {
    const out: MotionAction[] = []
    const ceiling = store.max || Math.max(1, before, after)
    // The number, and the bar. The element the page named — or the piece of
    // the artwork it named, because scaling the whole node would shrink the
    // thing rather than what it holds.
    if (store.shownOn) {
      const shown = partOf(store.shownOn) || store.shownOn
      const itself = flattenUnits(units).find(unit => unit.id === shown)
      const [ownerName, ...pieceName] = store.shownOn.split('.')
      const textPart = unitFor(ownerName)?.appearance?.kinds?.[pieceName.join('.')] === 'text'
      out.push(
        itself?.kind === 'label' || textPart
          ? act('count', [shown], at, { durationMs: 520, value: { from: before, to: after } })
          : act('level', [shown], at, { value: { from: before / ceiling, to: after / ceiling } }),
      )
    }
    // And the pieces themselves: one leaves for each unit spent, one returns
    // for each refilled, in the order they were drawn. The same quantity — so
    // the number, the bar and the tokens can never disagree.
    const pieces = piecesOf(store.counted)
    if (pieces.length) {
      const kept = Math.max(0, Math.min(pieces.length, after))
      const was = Math.max(0, Math.min(pieces.length, before))
      if (after < before) {
        pieces.slice(kept, was).reverse().forEach((piece, index) => {
          out.push(act('exit', [piece], at + index * 160, { durationMs: 260 }))
        })
      } else if (after > before) {
        pieces.slice(was, kept).forEach((piece, index) => {
          out.push(act('reveal', [piece], at + index * 160, { durationMs: 320 }))
        })
      }
    }
    return out
  }
  // A page's labelled node stays where it was drawn: sliding it across the
  // page breaks the arrangement the reader learned. Only a thing the page
  // drew as an actor travels; anything else lands as attention instead.
  const movable = (id: string) => Boolean(unitFor(id)?.actorRole)
  // The driver folds every move onto the last one, so a second hop is
  // measured from where the first left the actor, not from where it was drawn.
  const links = flattenUnits(units).filter(unit => unit.kind === 'connector' && unit.declared?.from && unit.declared?.to)
  // The word on a relation belongs to it: a floating "sends to" with no arrow
  // under it is noise, so it comes and goes with its connector.
  const loose = flattenUnits(units).filter(unit => unit.kind === 'label' && !unit.chrome && unit.bbox.width < 260)
  const wordsOn = new Map<string, string[]>(
    links.map(link => {
      const midX = (link.from && link.to ? (link.from.x + link.to.x) / 2 : link.bbox.x + link.bbox.width / 2)
      const midY = (link.from && link.to ? (link.from.y + link.to.y) / 2 : link.bbox.y + link.bbox.height / 2)
      return [
        link.id,
        loose
          .filter(word => Math.abs(word.bbox.x + word.bbox.width / 2 - midX) < 90 && Math.abs(word.bbox.y + word.bbox.height / 2 - midY) < 60)
          .map(word => word.id),
      ]
    }),
  )
  // Where each thing stands as the program plays: the same record the
  // placements and the camera read back from the finished plan. Moves fold
  // onto each other; a size is always a factor of how the page drew it.
  const stage = new Map<string, { dx: number; dy: number; scale: number }>()
  // One element carries the transform; everything drawn inside it comes along.
  const owning = (id: string) => unitFor(id)?.id || id
  const standing = (id: string) => stage.get(owning(id)) || { dx: 0, dy: 0, scale: 1 }
  const parentOf = new Map<string, SlideUnit>()
  const index = (list: SlideUnit[], parent?: SlideUnit) =>
    list.forEach(unit => {
      if (parent) parentOf.set(unit.id, parent)
      index(unit.children, unit)
    })
  index(units)
  // A thing moves within its parent, and the parent moves too: the same
  // composition the renderer does, so both agree on where anything is.
  const standingAt = (id: string) => {
    const dot = id.lastIndexOf('.')
    const owner = dot > 0 ? unitFor(id.slice(0, dot)) : undefined
    const partBox = owner?.appearance?.bounds?.[id.slice(dot + 1)]
    if (dot > 0 && !partBox) return undefined
    const unit = owner || unitFor(id)
    if (!unit) return undefined
    let box = partBox || unit.bbox
    for (let link: SlideUnit | undefined = unit; link; link = parentOf.get(link.id)) {
      const at = stage.get(link.id)
      if (at) box = boxCarriedBy(box, { ...at, visible: true, level: null }, link.bbox)
    }
    return box
  }
  const seen = new Set<string>()
  for (const initial of program.initialState || []) {
    const unit = unitFor(initial.id)
    if (!unit) { diagnostics.push({ event: initial.id, severity: 'error', code: 'missing-carry', message: 'Carried actor is missing' }); continue }
    if (['x', 'y', 'width', 'height'].some(key => Math.abs(unit.bbox[key as keyof typeof unit.bbox] - initial.bounds[key as keyof typeof initial.bounds]) > 1)) diagnostics.push({ event: initial.id, severity: 'error', code: 'carry-geometry', message: 'Incoming geography differs; choose an explicit settled cut' })
    stage.set(owning(initial.id), { dx: initial.dx, dy: initial.dy, scale: initial.scale })
    if (initial.visible) seen.add(initial.id)
    if (initial.state) actorStates.set(initial.id, initial.state)
    if (initial.clips) clipStates.set(initial.id, { ...initial.clips })
    const quantity = held.get(initial.id)
    if (quantity && initial.quantity !== undefined) quantity.value = initial.quantity
  }
  const windows: SceneWindow[] = []
  const steps: MotionBeat[] = program.beats.map((beat, index) => {
    const actions: MotionAction[] = []
    const writes: Array<{ event: string; target: string; channel: string; start: number; end: number }> = []
    const parts = new Set<string>()
    const spokenMs = beat.durationMs || speechMs(beat.say, wpm)
    // A line is spoken word by word, not character by character: a cue lands
    // when the words before it have been said. Moments that share one line
    // (a merged window) read their cues from that same line.
    const spokenWords = beat.say.split(/\s+/).filter(Boolean)
    const cueAt = (cue: string | undefined, index: number, count: number) => {
      if (cue) {
        const { word, occurrence } = splitCue(cue)
        const normalizeWord = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
        const measured = (beat.words || []).filter(w => normalizeWord(w.word) === normalizeWord(word))
        // A measured occurrence wins; a repeated word's nth occurrence is a
        // stable identity, not a loose first-match search.
        if (measured.length >= occurrence) return measured[occurrence - 1].startMs
        const lower = beat.say.toLowerCase()
        let found = -1
        for (let n = 0; n < occurrence; n += 1) {
          found = lower.indexOf(word.toLowerCase(), found + 1)
          if (found < 0) break
        }
        if (found >= 0) {
          const before = beat.say.slice(0, found).split(/\s+/).filter(Boolean).length
          return Math.round(spokenMs * (before / Math.max(1, spokenWords.length)))
        }
      }
      const share = (index + 0.35) / Math.max(1, count)
      return Math.round(spokenMs * share * 0.82)
    }
    let cursor = 0
    if (!index) {
      for (const initial of program.initialState || []) {
        for (const [part, atMs] of Object.entries(initial.clips || {})) {
          const targets = idsOf(`${initial.id}.${part}`)
          if (!partOf(`${initial.id}.${part}`) || !Number.isFinite(atMs) || atMs < 0) diagnostics.push({ event: initial.id, severity: 'error', code: 'missing-carry-clip', message: `Cannot carry finite clip ${part}` })
          else actions.push(act('clip', targets.slice(0, 1), 0, { durationMs: 1, value: { from: atMs, to: atMs, instant: 1 } }))
        }
        actions.push(act('move', [owning(initial.id)], 0, { durationMs: 1, value: { dx: initial.dx, dy: initial.dy, instant: 1 } }))
        actions.push(act('resize', [owning(initial.id)], 0, { durationMs: 1, value: { from: initial.scale, to: initial.scale, instant: 1 } }))
        actions.unshift(act(initial.visible ? 'reveal' : 'exit', [owning(initial.id)], 0, { durationMs: 1, value: { instant: 1 } }))
      }
      // What each thing holds when the scene opens, visible in the first frame.
      held.forEach(store => {
        if (!store.shownOn && !store.counted) return
        actions.push(...showQuantity(store, store.value, store.value, 0).map(action => ({ ...action, durationMs: 1 })))
        // A later refill schedules reveals, which the driver hides at rest.
        // State the initial inventory explicitly so those future reveals do
        // not make a full container look empty at the beginning.
        piecesOf(store.counted).forEach((piece, at) => {
          actions.push(act(at < store.value ? 'reveal' : 'exit', [piece], 0, { durationMs: 1 }))
        })
      })
    }
    // Leaving is two things: going off screen, and going home. The renderer
    // keeps whatever transform it was given, so an actor that is not put back
    // starts its next trip from wherever the last one ended.
    const leave = (id: string) => {
      const out = [act('exit', idsOf(id), cursor)]
      const where = standing(id)
      if (where.dx || where.dy) {
        out.push(act('move', [owning(id)], cursor + MOTION_DURATION_MS.exit, { durationMs: 1, value: { dx: -where.dx, dy: -where.dy } }))
        stage.set(owning(id), { ...where, dx: 0, dy: 0 })
      }
      seen.delete(id)
      return out
    }
    const arrive = (id: string) => {
      if (seen.has(id)) return
      seen.add(id)
      const node = unitFor(id)
      actions.push(act('reveal', node?.role === 'node' && node.id === id ? [node.id] : idsOf(id), cursor))
      cursor += 220
      // A relation arrives with the second of the two things it joins: an
      // arrow with nothing at its end is a line to nowhere.
      links.forEach(link => {
        if (seen.has(link.id)) return
        const ends = link.declared!
        if (!seen.has(ends.from!) || !seen.has(ends.to!)) return
        seen.add(link.id)
        actions.push(act('trace', idsOf(link.id), cursor - 120, { value: { staggerMs: 90 } }))
        const words = (wordsOn.get(link.id) || []).filter(id => !seen.has(id))
        words.forEach(id => seen.add(id))
        if (words.length) actions.push(act('reveal', words.flatMap(id => idsOf(id)), cursor - 60))
      })
    }
    // Every moment on this line, in order: the first is the beat itself, and
    // anything after it is a moment that was merged into the same line and
    // keeps its own staging, its own events and its own place in time.
    const playPart = (part: ProgramBeat) => {
    const startedAt = cursor
    const expanded = (part.events || []).flatMap(event => {
      if (event.action !== 'behavior') return [event]
      try {
        const appearance = unitFor(event.actor)?.appearance
        if (appearance?.key && appearance.key !== event.behavior?.definition.artworkKey) throw new Error('Behavior version belongs to a different artwork version')
        return expandBehavior(event, program.cast, appearance?.parts || {})
      }
      catch (error) { diagnostics.push({ event: event.id || event.actor, severity: 'error', code: 'invalid-behavior', message: String(error) }); return [] }
    })
    const events = modern ? orderEvents(expanded, diagnostics) : expanded
    const eventEnds = new Map<string, number>()
    const landsAt = (index: number) =>
      Math.max(startedAt, (events[index]?.atMs ?? (modern && (events[index]?.after || events[index]?.dependsOn?.length) && !events[index]?.cue ? startedAt : cueAt(events[index]?.cue, index, events.length))) + (Number(events[index]?.nudgeMs) || 0))
    // Recomposition happens as the moment opens, so the events that follow
    // play out on the new arrangement.
    ;(part.restage || []).forEach(entry => {
      const unit = unitFor(entry.id)
      if (!unit) return
      parts.add(unit.id)
      if (entry.clear) {
        actions.push(...leave(entry.id))
        return
      }
      seen.add(entry.id)
      if (entry.grow) {
        const was = standing(entry.id)
        actions.push(act('resize', [owning(entry.id)], cursor, { value: { from: was.scale, to: entry.grow } }))
        stage.set(owning(entry.id), { ...was, scale: entry.grow })
      }
      if (entry.to) {
        const box = standingAt(entry.id)
        if (box) {
          const anchor = placeOn(entry.to, box, options.viewBox)
          const was = standing(entry.id)
          stage.set(owning(entry.id), { ...was, dx: was.dx + anchor.dx, dy: was.dy + anchor.dy })
          actions.push(act('move', [owning(entry.id)], cursor, { durationMs: MOTION_DURATION_MS.move + 200, value: { dx: anchor.dx, dy: anchor.dy } }))
        }
      }
    })
    if (part.restage?.length) cursor += MOTION_DURATION_MS.move + 120
    let furthestEnd = cursor
    events.forEach((event, eventIndex) => {
      const actionIndex = actions.length
      if (event.guard && actorStates.get(event.guard.actor) === event.guard.notState) {
        diagnostics.push({ event: event.id || event.actor, severity: 'error', code: 'state-precondition', message: `${event.guard.actor} is ${event.guard.notState} and cannot enter processing` })
        return
      }
      // Never before the line has reached it, never before the previous
      // event has finished.
      // Explicit timing can overlap independent performances. Dependencies
      // name the event that must finish; the legacy implicit order is kept.
      cursor = modern || event.atMs !== undefined || event.after
        ? Math.max(landsAt(eventIndex), event.after ? eventEnds.get(event.after) || startedAt : startedAt)
        : Math.max(cursor, landsAt(eventIndex))
      const dependencyTime = Math.max(startedAt, ...(event.dependsOn || []).map(d => schedule.find(t => t.beat === index && t.id === d.event)?.[d.milestone] || 0))
      if (modern) cursor = Math.max(cursor, dependencyTime)
      if (modern && event.cue && beat.words?.length) {
        const { word, occurrence } = splitCue(event.cue)
        const normalize = (v: string) => v.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
        if (beat.words.filter(w => normalize(w.word) === normalize(word)).length < occurrence) diagnostics.push({ event: event.id || event.actor, severity: 'error', code: 'missing-cue', message: `Measured narration lacks cue ${event.cue}` })
      }
      const eventStart = cursor
      const actorUnit = unitFor(event.actor)
      if (actorUnit) parts.add(actorUnit.id)
      // The piece of its artwork that answers this kind of event: an
      // indicator that lights while it works, a mark that turns when a call
      // is refused. One flourish, at the moment the event lands.
      const reacts = reactionFor(event.actor, event.action)
      if (reacts) {
        // Artwork that animates itself is seeked through its own behaviour
        // from this clock; the driver falls back to a flourish for artwork
        // that has no timeline of its own.
        actions.push(act('clip', [reacts], cursor, { durationMs: MOTION_DURATION_MS.clip, value: { from: 0, to: MOTION_DURATION_MS.clip } }))
      }
      const targetUnit = event.to ? unitFor(event.to) || unitFor(event.to.split('.')[0]) : undefined
      if (['travel', 'pass', 'reject', 'become'].includes(event.action) && (!event.to || !standingAt(event.to))) diagnostics.push({ event: event.id || event.actor, severity: 'error', code: 'unresolved-target', message: `Destination ${event.to || '(missing)'} has no resolved geometry` })
      if (modern && ['travel', 'pass', 'reject'].includes(event.action) && !movable(event.actor)) diagnostics.push({ event: event.id || event.actor, severity: 'error', code: 'immovable-actor', message: `${event.actor} must declare data-actor for a journey` })
      if (targetUnit) parts.add(targetUnit.id)
      switch (event.action) {
        case 'perform':
          if (event.clip) {
            actions.push(act('clip', idsOf(event.actor).slice(0, 1), cursor, { durationMs: event.clip.durationMs, value: { from: event.clip.fromMs, to: event.clip.toMs }, ease: 'draw' }))
            const split = event.actor.lastIndexOf('.')
            if (split > 0) { const owner = event.actor.slice(0, split); clipStates.set(owner, { ...clipStates.get(owner), [event.actor.slice(split + 1)]: event.clip.toMs }) }
            cursor += event.clip.durationMs
          }
          break
        case 'appear':
          arrive(event.actor)
          break
        case 'travel':
        case 'pass':
        case 'reject': {
          arrive(event.actor)
          if (event.to) arrive(event.to)
          const from = standingAt(event.actor)
          const to = event.to ? standingAt(event.to) : undefined
          if (!movable(event.actor)) {
            // The meaning without the movement: the source takes the eye,
            // then the target does.
            actions.push(act('emphasize', idsOf(event.actor), cursor, { persistence: 'flourish' }))
            cursor += 280
            if (event.to) {
              actions.push(act(event.action === 'reject' ? 'pulse' : 'emphasize', idsOf(event.to), cursor, { persistence: 'flourish' }))
              cursor += 320
            }
            break
          }
          if (from && to) {
            const { dx, dy } = travelTo(from, to)
            arrivals.push({ event: event.id || `${event.action}-${event.actor}-${eventIndex}`, beat: index, actor: event.actor, x: from.x + from.width / 2 + dx, y: from.y + from.height / 2 + dy })
            // Already standing there: no journey to make, but everything that
            // happens on arrival still happens.
            if (dx || dy) {
              const where = standing(event.actor)
              stage.set(owning(event.actor), { ...where, dx: where.dx + dx, dy: where.dy + dy })
              actions.push(act('move', [owning(event.actor)], cursor, { durationMs: MOTION_DURATION_MS.move + 260, value: { dx, dy } }))
              cursor += MOTION_DURATION_MS.move + 200
            }
          }
          if (event.action === 'pass' && event.to) {
            actions.push(act('emphasize', idsOf(event.to), cursor, { persistence: 'flourish' }))
            cursor += 240
          }
          if (event.action === 'reject') {
            actorStates.set(event.actor, 'rejected')
            if (event.to) actions.push(act('emphasize', idsOf(event.to), cursor, { persistence: 'flourish' }))
            actions.push(act('pulse', idsOf(event.actor), cursor, { persistence: 'flourish' }))
            cursor += 360
            actions.push(...leave(event.actor))
            cursor += 260
          }
          break
        }
        case 'spend':
        case 'refill': {
          const store = held.get(event.actor)
          const amount = event.amount || 1
          if (store) {
            if (modern && event.action === 'spend' && store.value < amount) diagnostics.push({ event: event.id || event.actor, severity: 'error', code: 'quantity-precondition', message: `Cannot consume ${amount} from ${store.value}` })
            const before = store.value
            const ceiling = store.max ?? Number.MAX_SAFE_INTEGER
            store.value = Math.max(0, Math.min(ceiling, before + (event.action === 'spend' ? -amount : amount)))
            actions.push(...showQuantity(store, before, store.value, cursor))
            // A thing that has just run dry says so; a thing that is simply
            // less full does not need a state of its own.
            if ((store.value === 0 || before === 0) && !store.shownOn && !store.counted) {
              actions.push(
                act('phase', idsOf(event.actor).slice(0, 1), cursor, {
                  value: { program: 'entity', phase: store.value === 0 ? 'empty' : 'running' },
                }),
              )
            }
            cursor += 420
          } else {
            // Nothing declared how much this thing holds: the beat still lands
            // on it rather than passing in silence.
            actions.push(act('emphasize', idsOf(event.actor), cursor, { persistence: 'flourish' }))
            cursor += 300
          }
          break
        }
        case 'state':
          actorStates.set(event.actor, event.state || 'running')
          actions.push(act('phase', idsOf(event.actor).slice(0, 1), cursor, { value: { program: 'entity', phase: event.state || 'running' } }))
          cursor += 300
          break
        case 'become': {
          if (!event.to) break
          arrive(event.actor)
          const from = movable(event.actor) ? standingAt(event.actor) : undefined
          const to = standingAt(event.to)
          if (from && to) {
            // It takes the other thing's place, from wherever it now stands.
            const dx = Math.round(to.x + to.width / 2 - (from.x + from.width / 2))
            const dy = Math.round(to.y + to.height / 2 - (from.y + from.height / 2))
            if (dx || dy) {
              const where = standing(event.actor)
              stage.set(owning(event.actor), { ...where, dx: where.dx + dx, dy: where.dy + dy })
              actions.push(act('move', [owning(event.actor)], cursor, { value: { dx, dy } }))
            }
          }
          actions.push(act('morph', [...idsOf(event.actor), ...idsOf(event.to)], cursor + 200, { value: { fromCount: idsOf(event.actor).length } }))
          seen.add(event.to)
          cursor += MOTION_DURATION_MS.move + 200
          break
        }
        case 'highlight':
          arrive(event.actor)
          actions.push(act('emphasize', idsOf(event.actor), cursor, { persistence: 'flourish' }))
          cursor += 300
          break
        case 'leave':
          actions.push(...leave(event.actor))
          cursor += 280
          break
        default:
          break
      }
      const emitted = actions.slice(actionIndex)
      let end = Math.max(cursor, ...emitted.map(a => a.startMs + a.durationMs))
      if (modern && event.durationMs && end > eventStart) {
        const scale = event.durationMs / (end - eventStart)
        emitted.forEach(a => { a.startMs = eventStart + (a.startMs - eventStart) * scale; a.durationMs *= scale })
        end = eventStart + event.durationMs
      }
      const arrival = Math.max(eventStart, ...emitted.filter(a => a.op === 'move').map(a => a.startMs + a.durationMs))
      const outcome = Math.max(arrival, ...emitted.filter(a => ['count', 'level', 'phase', 'morph'].includes(a.op)).map(a => a.startMs + a.durationMs))
      const timing = { id: event.id || `${event.action}-${event.actor}-${eventIndex}`, beat: index, start: eventStart, arrival, outcome, settled: end + (event.holdMs || 0) }
      if (modern && event.anchor && event.anchor !== 'start') {
        const shift = landsAt(eventIndex) - timing[event.anchor]
        if (timing.start + shift < dependencyTime) diagnostics.push({ event: timing.id, severity: 'error', code: 'anchor-conflict', message: `Cue anchor requires preparation before the beat or dependency completes` })
        else {
          emitted.forEach(a => { a.startMs += shift })
          for (const milestone of ['start', 'arrival', 'outcome', 'settled'] as const) timing[milestone] += shift
        }
      }
      if (modern) for (const action of emitted) {
        const channel = ['move', 'resize'].includes(action.op) ? 'transform' : ['count', 'level'].includes(action.op) ? 'quantity' : action.op === 'clip' ? 'performance' : ''
        if (!channel) continue
        for (const target of action.targets) {
          if (writes.some(w => w.event !== timing.id && w.target === target && w.channel === channel && w.start < action.startMs + action.durationMs && action.startMs < w.end)) diagnostics.push({ event: timing.id, severity: 'error', code: 'concurrent-write', message: `Overlapping ${channel} ownership on ${target}` })
          writes.push({ event: timing.id, target, channel, start: action.startMs, end: action.startMs + action.durationMs })
        }
      }
      schedule.push(timing)
      cursor = modern ? timing.settled : cursor + (event.holdMs || 0)
      if (event.id) eventEnds.set(event.id, cursor)
      furthestEnd = Math.max(furthestEnd, cursor)
    })
    cursor = furthestEnd
    if (part.camera && part.camera !== 'page' && part.camera.length) {
      const boxes = part.camera.map(standingAt).filter(Boolean) as Array<{ x: number; y: number; width: number; height: number }>
      if (boxes.length) {
        const x = Math.min(...boxes.map(box => box.x))
        const y = Math.min(...boxes.map(box => box.y))
        const right = Math.max(...boxes.map(box => box.x + box.width))
        const bottom = Math.max(...boxes.map(box => box.y + box.height))
        actions.push(act('camera', [], startedAt, { value: { x, y, width: right - x, height: bottom - y, move: 'in' } }))
      }
    } else if (part.camera === 'page') {
      actions.push(act('camera', [], startedAt, { implicit: true }))
    }
    }
    playPart(beat)
    ;(beat.then || []).forEach(playPart)
    // Recorded speech is the clock. Compress late actions into the remaining
    // beat time instead of moving the next spoken cue.
    if (takeClock) for (const action of actions) {
      if (action.startMs + action.durationMs > spokenMs) diagnostics.push({ event: action.targets.join(','), severity: modern ? 'error' : 'warning', code: 'truncated-action', message: `Action ${action.op} ends at ${Math.round(action.startMs + action.durationMs)}ms beyond measured speech ${spokenMs}ms` })
      action.startMs = Math.min(action.startMs, Math.max(0, spokenMs - 1))
      action.durationMs = Math.min(action.durationMs, Math.max(1, spokenMs - action.startMs))
    }
    const motionWindowMs = Math.min(takeClock ? spokenMs : Infinity, Math.max(400, actions.reduce((max, item) => Math.max(max, item.startMs + item.durationMs), 0)))
    const spoken = spokenMs
    const hold = MOMENT_HOLD[beat.moment || 'explain'] ?? 260
    const partIds = [...parts]
    windows.push({
      say: beat.say,
      title: beat.heading || '',
      parts: partIds,
      hero: partIds[0] || '',
      // What the program asks of the camera, so the card shows the program's
      // own choice and an edit to it comes back as one. A beat that says
      // nothing about the camera carries no camera line at all.
      ...(beat.camera ? { camera: beat.camera === 'page' ? [] : [...beat.camera] } : {}),
      ...(beat.speaker ? { layout: beat.speaker, layoutByAuthor: true } : {}),
      intent: MOMENT_INTENT[beat.moment || 'explain'],
    })
    return {
      id: `B${String(index + 1).padStart(2, '0')}`,
      title: beat.heading || '',
      explanation: beat.say,
      intent: MOMENT_INTENT[beat.moment || 'explain'],
      ...(partIds.length ? { hero: idsOf(partIds[0]) } : {}),
      actions,
      motionWindowMs,
      // The line runs as long as it is spoken; a consequence then holds. On
      // the take's clock the pause after the line belongs to the next beat's
      // measured start — the beat ends where the measured words end.
      holdMs: takeClock ? Math.max(0, spoken - motionWindowMs) : Math.max(hold, spoken - motionWindowMs + hold),
    }
  })
  if (!steps.length) return null
  return { windows, plan: { version: 2, steps }, schedule, diagnostics, arrivals, boundaryState: program.cast.flatMap(actor => { const unit = unitFor(actor.id); return unit ? [{ id: actor.id, ...standing(actor.id), visible: seen.has(actor.id), bounds: unit.bbox, ...(held.has(actor.id) ? { quantity: held.get(actor.id)!.value } : {}), state: actorStates.get(actor.id), ...(clipStates.has(actor.id) ? { clips: clipStates.get(actor.id) } : {}) }] : [] }) }
}
