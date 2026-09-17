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
  type MotionAction,
  type MotionBeat,
  type MotionIntent,
  type MotionOp,
  type MotionPlanV2,
} from 'markdown-composition'
import { flattenUnits, leafUnits, type SlideUnit } from './slide-atoms'
import type { SceneWindow, WindowLayout } from './script-plan'

export const PROGRAM_ACTIONS = [
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
  quantity?: { of?: string; value: number; max?: number; shownOn?: string }
}

export type ProgramEvent = {
  actor: string
  action: ProgramAction
  to?: string
  amount?: number
  state?: string
  cue?: string
  holdMs?: number
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
  say: string
  events?: ProgramEvent[]
  camera?: string[] | 'page'
  speaker?: WindowLayout
  restage?: ProgramStaging[]
}

export type SceneProgram = { version: 1; page?: string; cast: ProgramActor[]; beats: ProgramBeat[] }

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
  const value = raw as Record<string, unknown>
  const cast = (Array.isArray(value.cast) ? value.cast : [])
    .map(entry => {
      const actor = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>
      const id = asString(actor.id, 120)
      if (!id || !known.has(id)) return null
      const quantity = actor.quantity && typeof actor.quantity === 'object' ? (actor.quantity as Record<string, unknown>) : null
      const shownOn = quantity ? asString(quantity.shownOn, 120) : ''
      return {
        id,
        role: asString(actor.role, 24) || undefined,
        state: asString(actor.state, 24) || undefined,
        ...(quantity && Number.isFinite(Number(quantity.value))
          ? {
              quantity: {
                of: asString(quantity.of, 24) || 'items',
                value: Math.max(0, Math.round(Number(quantity.value))),
                ...(Number.isFinite(Number(quantity.max)) ? { max: Math.max(1, Math.round(Number(quantity.max))) } : {}),
                ...(shownOn && known.has(shownOn) ? { shownOn } : {}),
              },
            }
          : {}),
      } as ProgramActor
    })
    .filter((actor): actor is ProgramActor => Boolean(actor))
    .slice(0, 24)
  const beats = (Array.isArray(value.beats) ? value.beats : [])
    .map(entry => {
      const beat = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>
      const say = asString(beat.say, 600)
      if (!say) return null
      const events = (Array.isArray(beat.events) ? beat.events : [])
        .map(item => {
          const event = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
          const actor = asString(event.actor, 120)
          const act = PROGRAM_ACTIONS.includes(event.action as ProgramAction) ? (event.action as ProgramAction) : null
          // The cast is where a thing's state lives, not a guest list: an
          // event may name anything the page drew.
          if (!act || !known.has(actor)) return null
          const to = asString(event.to, 120)
          return {
            actor,
            action: act,
            ...(to && known.has(to) ? { to } : {}),
            ...(Number.isFinite(Number(event.amount)) ? { amount: Math.max(1, Math.round(Number(event.amount))) } : {}),
            ...(asString(event.state, 24) ? { state: asString(event.state, 24) } : {}),
            ...(asString(event.cue, 40) ? { cue: asString(event.cue, 40) } : {}),
            ...(Number.isFinite(Number(event.holdMs)) ? { holdMs: Math.max(0, Math.min(3_000, Number(event.holdMs))) } : {}),
          } as ProgramEvent
        })
        .filter((event): event is ProgramEvent => Boolean(event))
        .slice(0, 12)
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
      return {
        id: asString(beat.id, 40) || undefined,
        moment: MOMENTS.includes(beat.moment as ProgramMoment) ? (beat.moment as ProgramMoment) : undefined,
        say,
        events,
        ...(camera === 'page' ? { camera: 'page' as const } : camera.length ? { camera } : {}),
        ...(restage.length ? { restage } : {}),
        ...(beat.speaker === 'me' || beat.speaker === 'beside' || beat.speaker === 'page' ? { speaker: beat.speaker as WindowLayout } : {}),
      } as ProgramBeat
    })
    .filter((beat): beat is ProgramBeat => Boolean(beat))
    .slice(0, 16)
  if (!cast.length || !beats.length) return null
  return { version: 1, page: asString(value.page, 120) || undefined, cast, beats }
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

type Held = { of?: string; value: number; max?: number; shownOn?: string }

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

export const compileSceneProgram = (
  program: SceneProgram,
  units: SlideUnit[],
  options: { viewBox: { width: number; height: number }; wpm?: number },
): { windows: SceneWindow[]; plan: MotionPlanV2 } | null => {
  const wpm = options.wpm || 150
  const leaves = leafUnits(units)
  const unitFor = (id: string) => leaves.find(unit => unit.id === id || unit.ids.includes(id)) || flattenUnits(units).find(unit => unit.id === id)
  const idsOf = (id: string) => unitFor(id)?.ids || [id]
  const boxOf = (id: string) => unitFor(id)?.bbox
  const held = new Map(program.cast.filter(actor => actor.quantity).map(actor => [actor.id, { ...actor.quantity! }]))
  // How much a thing holds, shown the way the page drew it: a number counts,
  // anything else is a bar and moves by how full it is.
  const showQuantity = (store: Held, before: number, after: number, at: number): MotionAction[] => {
    if (!store.shownOn) return []
    // The element the page named, not the thing it sits inside: a bar drawn
    // within a node belongs to that node's unit, and scaling the unit would
    // shrink the node itself.
    const itself = flattenUnits(units).find(unit => unit.id === store.shownOn)
    const ceiling = store.max || Math.max(1, before, after)
    if (itself?.kind === 'label') {
      return [act('count', [store.shownOn], at, { durationMs: 520, value: { from: before, to: after } })]
    }
    return [act('level', [store.shownOn], at, { value: { from: before / ceiling, to: after / ceiling } })]
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
  const moved = new Map<string, { dx: number; dy: number }>()
  const standingAt = (id: string) => {
    const box = boxOf(id)
    if (!box) return undefined
    const shift = moved.get(id)
    return shift ? { ...box, x: box.x + shift.dx, y: box.y + shift.dy } : box
  }
  const seen = new Set<string>()
  const windows: SceneWindow[] = []
  const steps: MotionBeat[] = program.beats.map((beat, index) => {
    const actions: MotionAction[] = []
    const parts = new Set<string>()
    const spokenMs = speechMs(beat.say, wpm)
    const events = beat.events || []
    // When each event should land inside the spoken line. A cue word puts
    // it where that word falls; otherwise the events are spread across the
    // sentence rather than fired at its first syllable and then waited out.
    // A line is spoken word by word, not character by character: a cue lands
    // when the words before it have been said.
    const spokenWords = beat.say.split(/\s+/).filter(Boolean)
    const landsAt = (index: number) => {
      const event = events[index]
      const cue = event?.cue ? beat.say.toLowerCase().indexOf(event.cue.toLowerCase()) : -1
      if (cue >= 0) {
        const before = beat.say.slice(0, cue).split(/\s+/).filter(Boolean).length
        return Math.round(spokenMs * (before / Math.max(1, spokenWords.length)))
      }
      const share = (index + 0.35) / Math.max(1, events.length)
      return Math.round(spokenMs * share * 0.82)
    }
    let cursor = 0
    if (!index) {
      // What each thing holds when the scene opens, visible in the first frame.
      held.forEach(store => {
        if (!store.shownOn) return
        actions.push(...showQuantity(store, store.value, store.value, 0).map(action => ({ ...action, durationMs: 1 })))
      })
    }
    // Leaving is two things: going off screen, and going home. The renderer
    // keeps whatever transform it was given, so an actor that is not put back
    // starts its next trip from wherever the last one ended.
    const leave = (id: string) => {
      const out = [act('exit', idsOf(id), cursor)]
      const standing = moved.get(id)
      if (standing && (standing.dx || standing.dy)) {
        out.push(act('move', idsOf(id), cursor + MOTION_DURATION_MS.exit, { durationMs: 1, value: { dx: -standing.dx, dy: -standing.dy } }))
        moved.delete(id)
      }
      seen.delete(id)
      return out
    }
    const arrive = (id: string) => {
      if (seen.has(id)) return
      seen.add(id)
      actions.push(act('reveal', idsOf(id), cursor))
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
    // Recomposition happens as the beat opens, so the events that follow play
    // out on the new arrangement.
    ;(beat.restage || []).forEach(entry => {
      const unit = unitFor(entry.id)
      if (!unit) return
      parts.add(unit.id)
      if (entry.clear) {
        actions.push(...leave(entry.id))
        return
      }
      seen.add(entry.id)
      if (entry.grow) actions.push(act('resize', idsOf(entry.id).slice(0, 1), cursor, { value: { to: entry.grow } }))
      if (entry.to) {
        const box = standingAt(entry.id)
        if (box) {
          const anchor = placeOn(entry.to, box, options.viewBox)
          const standing = moved.get(entry.id) || { dx: 0, dy: 0 }
          moved.set(entry.id, { dx: standing.dx + anchor.dx, dy: standing.dy + anchor.dy })
          actions.push(act('move', idsOf(entry.id), cursor, { durationMs: MOTION_DURATION_MS.move + 200, value: { dx: anchor.dx, dy: anchor.dy } }))
        }
      }
    })
    if (beat.restage?.length) cursor += MOTION_DURATION_MS.move + 120
    events.forEach((event, eventIndex) => {
      // Never before the line has reached it, never before the previous
      // event has finished.
      cursor = Math.max(cursor, landsAt(eventIndex))
      const actorUnit = unitFor(event.actor)
      if (actorUnit) parts.add(actorUnit.id)
      const targetUnit = event.to ? unitFor(event.to) : undefined
      if (targetUnit) parts.add(targetUnit.id)
      switch (event.action) {
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
            // Already standing there: no journey to make, but everything that
            // happens on arrival still happens.
            if (dx || dy) {
              const standing = moved.get(event.actor) || { dx: 0, dy: 0 }
              moved.set(event.actor, { dx: standing.dx + dx, dy: standing.dy + dy })
              actions.push(act('move', idsOf(event.actor), cursor, { durationMs: MOTION_DURATION_MS.move + 260, value: { dx, dy } }))
              cursor += MOTION_DURATION_MS.move + 200
            }
          }
          if (event.action === 'pass' && event.to) {
            actions.push(act('emphasize', idsOf(event.to), cursor, { persistence: 'flourish' }))
            cursor += 240
          }
          if (event.action === 'reject') {
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
            const before = store.value
            const ceiling = store.max ?? Number.MAX_SAFE_INTEGER
            store.value = Math.max(0, Math.min(ceiling, before + (event.action === 'spend' ? -amount : amount)))
            actions.push(...showQuantity(store, before, store.value, cursor))
            // A thing that has just run dry says so; a thing that is simply
            // less full does not need a state of its own.
            if (store.value === 0 || before === 0) {
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
          actions.push(act('phase', idsOf(event.actor).slice(0, 1), cursor, { value: { program: 'entity', phase: event.state || 'running' } }))
          cursor += 300
          break
        case 'become': {
          if (!event.to) break
          arrive(event.actor)
          const from = movable(event.actor) ? boxOf(event.actor) : undefined
          const to = boxOf(event.to)
          if (from && to) {
            actions.push(act('move', idsOf(event.actor), cursor, { value: { dx: Math.round(to.x - from.x), dy: Math.round(to.y - from.y) } }))
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
      if (event.holdMs) cursor += event.holdMs
    })
    if (beat.camera && beat.camera !== 'page' && beat.camera.length) {
      const boxes = beat.camera.map(boxOf).filter(Boolean) as Array<{ x: number; y: number; width: number; height: number }>
      if (boxes.length) {
        const x = Math.min(...boxes.map(box => box.x))
        const y = Math.min(...boxes.map(box => box.y))
        const right = Math.max(...boxes.map(box => box.x + box.width))
        const bottom = Math.max(...boxes.map(box => box.y + box.height))
        actions.push(act('camera', [], 0, { value: { x, y, width: right - x, height: bottom - y, move: 'in' } }))
      }
    } else if (beat.camera === 'page') {
      actions.push(act('camera', [], 0, { implicit: true }))
    }
    const motionWindowMs = Math.max(400, actions.reduce((max, item) => Math.max(max, item.startMs + item.durationMs), 0))
    const spoken = spokenMs
    const hold = MOMENT_HOLD[beat.moment || 'explain'] ?? 260
    const partIds = [...parts]
    windows.push({
      say: beat.say,
      title: beat.id || beat.moment || `Beat ${index + 1}`,
      parts: partIds,
      hero: partIds[0] || '',
      ...(beat.speaker ? { layout: beat.speaker, layoutByAuthor: true } : {}),
      intent: MOMENT_INTENT[beat.moment || 'explain'],
    })
    return {
      id: `B${String(index + 1).padStart(2, '0')}`,
      title: beat.id || beat.moment || `Beat ${index + 1}`,
      explanation: beat.say,
      intent: MOMENT_INTENT[beat.moment || 'explain'],
      ...(partIds.length ? { hero: idsOf(partIds[0]) } : {}),
      actions,
      motionWindowMs,
      // The line runs as long as it is spoken; a consequence then holds.
      holdMs: Math.max(hold, spoken - motionWindowMs + hold),
    }
  })
  if (!steps.length) return null
  return { windows, plan: { version: 2, steps } }
}
