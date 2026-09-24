import type { ProgramEvent } from './scene-program'

export type EventMilestone = 'start' | 'arrival' | 'outcome' | 'settled'
export type EventTiming = { id: string; beat: number; start: number; arrival: number; outcome: number; settled: number }
export type TimingDiagnostic = { event: string; severity: 'error' | 'warning'; code: string; message: string }

/** Stable topological order. Timing is resolved by the compiler on the measured clock. */
export function orderEvents(events: ProgramEvent[], diagnostics: TimingDiagnostic[]): ProgramEvent[] {
  const byId = new Map<string, ProgramEvent>()
  for (const e of events) {
    if (!e.id) { diagnostics.push({ event: e.actor, severity: 'error', code: 'missing-id', message: 'Scheduled events require stable IDs' }); continue }
    if (byId.has(e.id)) diagnostics.push({ event: e.id, severity: 'error', code: 'duplicate-id', message: `Duplicate event ${e.id}` })
    byId.set(e.id, e)
  }
  const visited = new Set<ProgramEvent>(), pending = new Set<ProgramEvent>(), ordered: ProgramEvent[] = []
  const visit = (e: ProgramEvent) => {
    if (visited.has(e)) return
    if (pending.has(e)) { diagnostics.push({ event: e.id!, severity: 'error', code: 'cycle', message: `Cyclic dependency at ${e.id}` }); return }
    pending.add(e)
    for (const id of [...(e.after ? [e.after] : []), ...(e.dependsOn || []).map(d => d.event)]) {
      const parent = byId.get(id)
      if (!parent) diagnostics.push({ event: e.id!, severity: 'error', code: 'missing-dependency', message: `Unknown dependency ${id}` })
      else visit(parent)
    }
    pending.delete(e); visited.add(e); ordered.push(e)
  }
  events.forEach(visit)
  return ordered
}
