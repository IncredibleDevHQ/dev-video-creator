import { listRows, readRow } from '../persistence'
import { generationStops } from '../generation-errors'
import type { TokenUsage } from '../../shared/usage'
import type { Snapshot } from '../../shared/api'

type Row = {
  id: string
  projectId: string
  operation?: string
  usage?: TokenUsage
}
const scope = (operation?: string) =>
  operation === 'chat' || operation === 'research' ? 'research' : 'production'
const rows = new Map<string, Row>()
let loaded: Promise<void> | undefined
const source = new Map<string, string>()
const cap = (name: string, fallback: number) => {
  const n = Number(process.env[`MINIMAL_STUDIO_${name}_TOKENS`])
  return Number.isFinite(n) && n > 0 ? n : fallback
}
const fresh = (u?: TokenUsage) => (u ? u.input + u.output + u.cacheWrite : 0)
const cached = (u?: TokenUsage) => u?.cacheRead || 0

/** Token ceilings, not money: cache traffic has its own separate ceiling.
 * Research and production have independent notebook/series ledgers so making
 * videos cannot lock the creator out of research. All agents share each ledger;
 * switching agents does not bypass a Studio budget. Cumulative rows are replaced,
 * never added twice. Saved usage survives restart.
 */
export const tokenBudget = async (
  projectId: string,
  id: string,
  operation: string
) => {
  loaded ||= (async () => {
    for (const key of await listRows('engine-runs')) {
      const row = await readRow<Row>('engine-runs', key)
      if (row) rows.set(key, row)
    }
  })().catch((error) => {
    loaded = undefined
    throw error
  })
  await loaded
  // Refresh project ownership so a notebook later added to a series is counted.
  for (const pid of new Set([
    projectId,
    ...[...rows.values()].map((r) => r.projectId)
  ])) {
    if (pid !== projectId && source.has(pid)) continue
    const snapshot = await readRow<Snapshot>('projects', pid)
    source.set(pid, snapshot?.project.copyOfMap || pid)
  }
  rows.set(id, { id, projectId, operation })
  const group = source.get(projectId)
  const visual = operation === 'pose' || operation === 'frame'
  return (usage?: TokenUsage) => {
    if (usage) rows.set(id, { id, projectId, operation, usage })
    const current = rows.get(id)?.usage
    const scoped = [...rows.values()].filter(
      (r) => scope(r.operation) === scope(operation)
    )
    const own = scoped.filter((r) => r.projectId === projectId)
    const series = scoped.filter((r) => source.get(r.projectId) === group)
    const over = (
      items: Row[],
      prefix: string,
      newLimit: number,
      cacheLimit: number
    ) =>
      items.reduce((n, r) => n + fresh(r.usage), 0) >=
        cap(`${prefix}_NEW`, newLimit) ||
      items.reduce((n, r) => n + cached(r.usage), 0) >=
        cap(`${prefix}_CACHED`, cacheLimit)
    if (
      fresh(current) >= cap('RUN_NEW', visual ? 100_000 : 250_000) ||
      cached(current) >= cap('RUN_CACHED', visual ? 2_000_000 : 4_000_000)
    )
      return generationStops.tokens
    if (over(own, 'PROJECT', 6_000_000, 100_000_000))
      return generationStops.projectTokens
    if (over(series, 'SERIES', 12_000_000, 200_000_000))
      return generationStops.seriesTokens
    return null
  }
}
