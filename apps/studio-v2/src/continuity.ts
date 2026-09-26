export type ActorBoundary = {
  id: string; dx: number; dy: number; scale: number; visible: boolean
  quantity?: number; state?: string; clips?: Record<string, number>
  bounds: { x: number; y: number; width: number; height: number }
}
export type BoundaryTransition = {
  kind: 'carry' | 'settled-cut'; reason: string; outgoingSubject: string; incomingSubject: string
  readableMs: number; actors: ActorBoundary[]
}
export function validateBoundary(outgoing: BoundaryTransition, incoming: ActorBoundary[]): string[] {
  const errors: string[] = []
  if (!outgoing.reason.trim() || outgoing.readableMs < 200) errors.push('A boundary needs a reason and a readable settled interval of at least 200ms')
  if (outgoing.kind !== 'carry') return errors
  for (const actor of outgoing.actors) {
    const next = incoming.find(a => a.id === actor.id)
    if (!next) { errors.push(`Carry actor ${actor.id} is absent in the incoming scene`); continue }
    for (const property of ['dx', 'dy', 'scale', 'visible', 'quantity', 'state'] as const) if (actor[property] !== next[property]) errors.push(`${actor.id}: boundary ${property} differs`)
    for (const part of new Set([...Object.keys(actor.clips || {}), ...Object.keys(next.clips || {})])) if ((actor.clips?.[part] || 0) !== (next.clips?.[part] || 0)) errors.push(`${actor.id}: boundary clip ${part} differs`)
    for (const property of ['x', 'y', 'width', 'height'] as const) if (Math.abs(actor.bounds[property] - next.bounds[property]) > 1) errors.push(`${actor.id}: boundary geometry differs; use a settled cut or matching geography`)
  }
  return errors
}
