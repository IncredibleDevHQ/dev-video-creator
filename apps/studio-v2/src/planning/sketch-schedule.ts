// A sketch's mechanism clock (R11 of the scene-review review). The live
// token-bucket sketch put its refills where the narration fell — 1.4
// seconds apart, then 7.2 — while the plan described a steady refill.
//
// Where a plan counts something, its sketch says when each counted change
// happens on the composition's clock and which layers show it; which rule
// makes the changes a steady rate makes (a refill every n seconds); and
// where the scene holds that clock to explain, with the layer that tells
// the viewer so. The product replays it:
// - the changes are the plan ledger's, in its order and moments, so the
//   counts are the plan's and a refusal comes only when too little is left;
// - a rule changes the count on every beat of its clock while there is room
//   (or supply), and at no other time;
// - a pause holds the clock: nothing counted happens in it, and the beat
//   resumes after it.
// Narration and camera may dwell on a change; they never move it off the
// beat. The runtime check then sees each change on screen when it happens.
import type { SceneTreatmentV1 } from './scene-treatment'

export type ScheduleEvent = {
  at: number
  moment: string
  change: 'add' | 'consume' | 'refuse'
  amount: number
  needs?: number
  after: number
  // The rule that makes it, if a steady one does.
  rule?: string
  // The layers that show it happen.
  layers: string[]
}
export type ScheduleRule = { id: string; change: 'add' | 'consume'; amount: number; every: number; from: number }
export type SchedulePause = { start: number; end: number; note: string; shown: string }
export type SketchSchedule = {
  quantity: string
  capacity: number | null
  initial: number
  rules: ScheduleRule[]
  pauses: SchedulePause[]
  events: ScheduleEvent[]
}

// How close a change must be to its beat, in seconds.
export const BEAT_TOLERANCE = 0.05
const MAX_BEATS = 2000

type Frame = { duration: number; moments: Array<{ id: string; start: number; end: number }>; layers: Array<{ id: string; kind: string; moments: string[] }> }

const seconds = (value: number) => `${Number(value.toFixed(2))}s`
const whole = (value: number) => Number.isInteger(value) && value >= 0
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const byStart = (pauses: SchedulePause[]) => [...pauses].sort((a, b) => a.start - b.start)

// The mechanism's clock at a composition time: the time less every pause
// before it. It stands still inside a pause.
export const mechanismTime = (at: number, pauses: SchedulePause[]) =>
  at - pauses.reduce((held, pause) => held + Math.max(0, Math.min(at, pause.end) - pause.start), 0)

// The composition time a mechanism time falls at, after the pauses before it.
export const compositionTime = (clock: number, pauses: SchedulePause[]) => {
  let at = clock
  for (const pause of byStart(pauses)) if (at > pause.start + 1e-9) at += pause.end - pause.start
  return at
}

// A rule's beats on the composition clock, before the composition ends.
export const beatsOf = (rule: ScheduleRule, pauses: SchedulePause[], duration: number) => {
  const beats: number[] = []
  const start = mechanismTime(rule.from, pauses)
  for (let k = 1; k <= MAX_BEATS; k += 1) {
    const at = compositionTime(start + k * rule.every, pauses)
    if (at >= duration - 1e-9) break
    beats.push(Number(at.toFixed(4)))
  }
  return beats
}

const describe = (event: { change: string; amount: number; after: number; moment: string }) => `${event.change} ${event.amount} → ${event.after} in ${event.moment}`

// What is wrong with a sketch's schedule, against its plan's ledger.
export const scheduleProblems = (schedule: SketchSchedule | null | undefined, plan: SceneTreatmentV1, frame: Frame): string[] => {
  const ledger = plan.ledger
  if (!schedule) {
    return ledger
      ? [`the plan counts ${ledger.quantity}: add manifest.schedule — when each of its ${ledger.events.length} changes happens on the composition's clock, the layers that show it, the rule behind any steady rate, and any pause (see the sketch contract)`]
      : []
  }
  const problems: string[] = []
  const events = Array.isArray(schedule.events) ? schedule.events : []
  const rules = Array.isArray(schedule.rules) ? schedule.rules : []
  const pauses = Array.isArray(schedule.pauses) ? schedule.pauses : []
  const layerOf = new Map(frame.layers.map(layer => [layer.id, layer]))
  const momentOf = new Map(frame.moments.map(moment => [moment.id, moment]))

  // The count it replays is the plan's.
  if (ledger) {
    if (schedule.quantity !== ledger.quantity) problems.push(`manifest.schedule.quantity must be the plan's "${ledger.quantity}"`)
    if ((schedule.capacity ?? null) !== ledger.capacity) problems.push(`manifest.schedule.capacity must be the plan's ${ledger.capacity}`)
    if (schedule.initial !== ledger.initial) problems.push(`manifest.schedule.initial must be the plan's ${ledger.initial}`)
  } else if (!whole(schedule.initial)) problems.push('manifest.schedule.initial must be a whole number')

  // Pauses: inside the composition, apart, explained and shown.
  const held = byStart(pauses)
  // The beat can be replayed only on well-formed pauses and changes.
  let replayable = true
  held.forEach((pause, index) => {
    const where = `the pause from ${seconds(pause.start)} to ${seconds(pause.end)}`
    if (!isNumber(pause.start) || !isNumber(pause.end) || pause.start < 0 || pause.end <= pause.start || pause.end > frame.duration + 1e-9) {
      problems.push(`${where} must start before it ends, inside the composition`)
      replayable = false
    }
    if (index > 0 && pause.start < held[index - 1].end - 1e-9) {
      problems.push(`${where} overlaps the one before it`)
      replayable = false
    }
    if (!String(pause.note || '').trim()) problems.push(`${where} needs a note: what the scene explains while the clock is held`)
    const layer = layerOf.get(pause.shown)
    if (!layer || layer.kind === 'camera') problems.push(`${where} must name the layer that tells the viewer the clock is held (shown), one of manifest.layers`)
    else {
      const overlapped = frame.moments.filter(moment => moment.start < pause.end && moment.end > pause.start).map(moment => moment.id)
      const missing = overlapped.filter(id => !layer.moments.includes(id))
      if (missing.length) problems.push(`${where} is shown by layer "${layer.id}", which does not take part in ${missing.join(', ')}`)
    }
  })

  // Events: timed inside their moments, never while the clock is held, and
  // shown by named layers.
  const before = problems.length
  events.forEach((event, index) => {
    const where = `manifest.schedule event ${index + 1} (${event.change} at ${isNumber(event.at) ? seconds(event.at) : '?'})`
    const moment = momentOf.get(event.moment)
    if (!isNumber(event.at) || event.at < 0 || event.at >= frame.duration) problems.push(`${where} must happen inside the composition`)
    else if (!moment) problems.push(`${where} names moment "${event.moment}", which the sketch does not have`)
    else if (event.at < moment.start - 1e-9 || event.at >= moment.end) problems.push(`${where} is outside its moment ${moment.id} (${seconds(moment.start)}–${seconds(moment.end)})`)
    if (index > 0 && isNumber(event.at) && event.at < events[index - 1].at) problems.push(`${where} is listed after a later one — list the changes in the order they happen`)
    const pause = held.find(entry => event.at > entry.start + 1e-9 && event.at < entry.end - 1e-9)
    if (pause) problems.push(`${where} happens while the clock is held (${seconds(pause.start)}–${seconds(pause.end)}): nothing counted happens in a pause`)
    const layers = Array.isArray(event.layers) ? event.layers : []
    if (!layers.length) problems.push(`${where} must name the layers that show it`)
    for (const id of layers) if (!layerOf.has(id) || layerOf.get(id)!.kind === 'camera') problems.push(`${where} is shown by "${id}", which is not a drawn layer of manifest.layers`)
    if (event.rule && !rules.some(rule => rule.id === event.rule)) problems.push(`${where} is made by rule "${event.rule}", which manifest.schedule.rules does not declare`)
  })

  // The changes are the ledger's, one for one.
  if (ledger) {
    if (events.length !== ledger.events.length) problems.push(`the plan's ledger has ${ledger.events.length} changes; manifest.schedule.events has ${events.length} — one for each, in order`)
    const rated = (ledger.rates || []).length > 0
    ledger.events.forEach((planned, index) => {
      const event = events[index]
      if (!event) return
      const same =
        event.change === planned.change &&
        event.amount === planned.amount &&
        event.after === planned.after &&
        event.moment === planned.moment &&
        (planned.change !== 'refuse' || (event.needs ?? 1) === (planned.needs ?? 1))
      if (!same) problems.push(`manifest.schedule event ${index + 1} (${describe(event)}) is not the plan's change ${index + 1} (${describe(planned)}: "${planned.what}")`)
      else if (rated && (event.rule || null) !== (planned.rate || null)) {
        problems.push(planned.rate ? `manifest.schedule event ${index + 1} ("${planned.what}") is made by the plan's rate ${planned.rate}: tag it with rule "${planned.rate}"` : `manifest.schedule event ${index + 1} ("${planned.what}") is not made by a rate in the plan: it takes no rule`)
      }
    })
    for (const rate of ledger.rates || []) {
      const rule = rules.find(entry => entry.id === rate.id)
      if (!rule) problems.push(`the plan's rate ${rate.id} (${rate.what || `${rate.change} ${rate.amount}`}) needs a rule in manifest.schedule.rules with that id, its period (every) and when it starts (from)`)
      else if (rule.change !== rate.change || rule.amount !== rate.amount) problems.push(`rule ${rule.id} must ${rate.change} ${rate.amount} each beat, as the plan's rate does`)
    }
  }

  if (problems.length > before) replayable = false

  // Rules: a steady clock. Every beat changes the count while there is room
  // (or supply); no change of the rule falls off its beat.
  const ruleIds = rules.map(rule => rule.id)
  for (const id of ruleIds.filter((value, index) => ruleIds.indexOf(value) !== index)) problems.push(`rule "${id}" is declared twice`)
  const usable = rules.filter(rule => {
    const where = `rule ${rule.id || '?'}`
    const ok = Boolean(rule.id) && (rule.change === 'add' || rule.change === 'consume') && whole(rule.amount) && rule.amount > 0 && isNumber(rule.every) && rule.every > 0 && isNumber(rule.from) && rule.from >= 0 && rule.from < frame.duration
    if (!ok) problems.push(`${where} needs an id, a change (add or consume), a whole amount, a period (every, in seconds) and a start (from) inside the composition`)
    return ok
  })
  if (replayable && usable.length === rules.length && usable.length) {
    const ordered = events.map((event, index) => ({ event, index }))
    const beats = usable.flatMap(rule => beatsOf(rule, held, frame.duration).map(at => ({ at, rule }))).sort((a, b) => a.at - b.at)
    const claimed = new Set<number>()
    const capacity = schedule.capacity ?? null
    let count = schedule.initial
    let next = 0
    const apply = (event: ScheduleEvent) => {
      if (event.change === 'add') count = capacity === null ? count + event.amount : Math.min(capacity, count + event.amount)
      else if (event.change === 'consume') count = Math.max(0, count - event.amount)
    }
    // A steady rate runs whenever it can act: its clock starts by the time
    // there is first room (an add) or supply (a consume).
    for (const rule of usable) {
      let level = schedule.initial
      const able = (value: number) => (rule.change === 'add' ? capacity === null || value + rule.amount <= capacity : value >= rule.amount)
      let from = able(level) ? 0 : null
      for (const { event } of ordered) {
        if (from !== null) break
        if (event.change === 'add') level = capacity === null ? level + event.amount : Math.min(capacity, level + event.amount)
        else if (event.change === 'consume') level = Math.max(0, level - event.amount)
        if (able(level)) from = event.at
      }
      if (from !== null && rule.from > from + BEAT_TOLERANCE) problems.push(`rule ${rule.id} starts at ${seconds(rule.from)}, but it could ${rule.change === 'add' ? 'add' : 'take'} from ${seconds(from)}: a steady rate runs whenever there is ${rule.change === 'add' ? 'room' : 'supply'} — start it by then`)
    }
    for (const beat of beats) {
      while (next < ordered.length && ordered[next].event.at < beat.at - BEAT_TOLERANCE) apply(ordered[next++].event)
      const { rule } = beat
      const due = rule.change === 'add' ? capacity === null || count + rule.amount <= capacity : count >= rule.amount
      const match = ordered.find(({ event, index }) => !claimed.has(index) && event.rule === rule.id && Math.abs(event.at - beat.at) <= BEAT_TOLERANCE)
      if (match) claimed.add(match.index)
      if (due && !match) {
        problems.push(`rule ${rule.id} (${rule.change === 'add' ? 'adds' : 'takes'} ${rule.amount} every ${seconds(rule.every)} from ${seconds(rule.from)}) is due at ${seconds(beat.at)}, with ${count}${capacity !== null ? ` of ${capacity}` : ''}, but nothing ${rule.change === 'add' ? 'lands' : 'is taken'} then. Keep the beat, or hold the clock with a shown pause`)
      } else if (!due && match) {
        problems.push(`rule ${rule.id} ${rule.change === 'add' ? `adds at ${seconds(beat.at)} to a full ${count} of ${capacity}` : `takes at ${seconds(beat.at)} from ${count}`}: on a beat with no ${rule.change === 'add' ? 'room' : 'supply'}, nothing changes`)
      }
    }
    for (const { event, index } of ordered) {
      if (!event.rule || claimed.has(index)) continue
      const rule = usable.find(entry => entry.id === event.rule)
      // The beats either side of it.
      const beats = rule ? beatsOf(rule, held, frame.duration) : []
      const around = [beats.filter(at => at <= event.at).pop(), beats.find(at => at > event.at)].filter((at): at is number => at !== undefined)
      problems.push(`manifest.schedule event ${index + 1} (${event.change} at ${seconds(event.at)}) is made by rule ${event.rule} but falls off its beat${around.length ? ` (due at ${around.map(seconds).join(', ')})` : ''}`)
    }
  }
  return [...new Set(problems)]
}

// The schedule in brief, for the review.
export const scheduleSummary = (schedule: SketchSchedule | null | undefined) =>
  schedule
    ? {
        rules: (schedule.rules || []).map(({ id, change, amount, every, from }) => ({ id, change, amount, every, from })),
        pauses: (schedule.pauses || []).map(({ start, end, note }) => ({ start, end, note })),
        events: (schedule.events || []).length,
      }
    : null
