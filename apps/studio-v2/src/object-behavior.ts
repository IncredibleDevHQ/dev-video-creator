import type { ProgramEvent, ProgramActor } from './scene-program'

export const BEHAVIOR_NAMES = ['receive', 'consume', 'process', 'reject', 'refill', 'enqueue', 'release', 'recover'] as const
export type BehaviorName = typeof BEHAVIOR_NAMES[number]
export type AppearanceControl = {
  id: string; label: string; type: 'color' | 'number'; default: string | number
  min?: number; max?: number; parts: string[]
  property: 'accent' | 'scale' | 'emphasis' | 'durationMs'
  invalidates: 'geometry' | 'timing' | 'review'
}
export type ObjectBehavior = {
  version: 1; key: string; artworkKey: string; name: BehaviorName
  requiredParts: string[]; port?: string; clip?: string
  duration: { minMs: number; defaultMs: number; maxMs: number }
  controls?: AppearanceControl[]
}
export type BehaviorCall = { definition: ObjectBehavior; request?: string; destination?: string; amount?: number }

/** Recipes emit the existing scene operations. Quantity writes always belong
 * to the scene; an internal performance cannot assert acceptance or inventory. */
export function expandBehavior(event: ProgramEvent, actors: ProgramActor[], parts: Record<string, string>): ProgramEvent[] {
  const call = event.behavior
  if (!call) throw new Error(`${event.id}: missing behavior binding`)
  const def = call.definition
  validateBehavior(def, parts)
  const durationMs = event.durationMs || def.duration.defaultMs
  if (durationMs < def.duration.minMs || durationMs > def.duration.maxMs) throw new Error(`${event.id}: duration outside ${def.duration.minMs}–${def.duration.maxMs}ms`)
  const base = { ...event, behavior: undefined, durationMs }
  const request = call.request
  const destination = call.destination || (def.port ? `${event.actor}.${def.port}` : event.actor)
  const travel = (action: 'travel' | 'reject'): ProgramEvent => {
    if (!request) throw new Error(`${event.id}: ${def.name} requires a request actor`)
    return { ...base, actor: request, action, to: destination }
  }
  switch (def.name) {
    case 'receive': case 'release': return [travel('travel')]
    case 'reject': return [travel('reject')]
    case 'consume': case 'refill': {
      const actor = actors.find(a => a.id === event.actor)
      if (!actor?.quantity || (!actor.quantity.shownOn && !actor.quantity.counted)) throw new Error(`${event.id}: ${def.name} requires scene-owned visible quantity`)
      return [{ ...base, action: def.name === 'consume' ? 'spend' : 'refill', amount: call.amount || 1 }]
    }
    case 'enqueue': return [travel('travel'), { ...base, id: `${event.id}-queued`, actor: request!, action: 'state', state: 'queued', after: event.id, cue: undefined, anchor: undefined, atMs: 0 }]
    case 'process': case 'recover': {
      if (!def.clip) throw new Error(`${event.id}: ${def.name} requires a finite performance part`)
      return [{ ...base, ...(request ? { guard: { actor: request, notState: 'rejected' } } : {}), action: 'perform', actor: `${event.actor}.${def.clip}`, clip: { fromMs: 0, toMs: def.duration.defaultMs, durationMs } }]
    }
  }
}
export function validateBehavior(def: ObjectBehavior, parts: Record<string, string>) {
  if (def.version !== 1 || !def.artworkKey || !BEHAVIOR_NAMES.includes(def.name)) throw new Error('Unsupported behavior definition')
  const missing = [...new Set([...def.requiredParts, ...(def.port ? [def.port] : []), ...(def.clip ? [def.clip] : [])])].filter(p => !parts[p])
  if (missing.length) throw new Error(`${def.name}: repair rig ${def.artworkKey}; missing parts: ${missing.join(', ')}`)
  if (!(def.duration.minMs > 0 && def.duration.minMs <= def.duration.defaultMs && def.duration.defaultMs <= def.duration.maxMs && def.duration.maxMs <= 30000)) throw new Error('Invalid behavior duration bounds')
  for (const c of def.controls || []) {
    if (!/^[a-z][a-z0-9-]*$/.test(c.id)) throw new Error('Control IDs must be lowercase stable names')
    if (!['accent', 'scale', 'emphasis', 'durationMs'].includes(c.property)) throw new Error('Factual state cannot be an appearance control')
    if (c.parts.some(p => !parts[p])) throw new Error(`Control ${c.id} targets a missing part`)
    if (c.type === 'number' && !(Number.isFinite(c.min) && Number.isFinite(c.max) && Number(c.min) <= Number(c.default) && Number(c.default) <= Number(c.max))) throw new Error(`Invalid bounds for ${c.id}`)
  }
}
export function controlValue(control: AppearanceControl, value: unknown): string | number {
  if (control.type === 'color') {
    if (!/^#[0-9a-f]{6}$/i.test(String(value))) throw new Error(`${control.label}: use a six-digit color`)
    return String(value)
  }
  const number = Number(value)
  if (!Number.isFinite(number) || number < control.min! || number > control.max!) throw new Error(`${control.label}: value must be ${control.min}–${control.max}`)
  return number
}
