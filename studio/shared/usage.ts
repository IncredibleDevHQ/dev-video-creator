export type TokenUsage = {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  final: boolean
}
export type UsageTotal = {
  tokens: number
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  reportedRuns: number
  totalRuns: number
  partial: boolean
}
export type NotebookUsage = {
  total: UsageTotal
  scenes: Record<string, UsageTotal>
}
export const sumUsage = (
  runs: Array<{ sceneId?: string; usage?: TokenUsage }>
): NotebookUsage => {
  const sum = (items: typeof runs): UsageTotal =>
    items.reduce<UsageTotal>(
      (a, r) => {
        a.totalRuns++
        if (!r.usage) {
          a.partial = true
          return a
        }
        a.reportedRuns++
        a.partial ||= !r.usage.final
        for (const k of ['input', 'output', 'cacheRead', 'cacheWrite'] as const)
          a[k] += r.usage[k]
        a.tokens +=
          r.usage.input +
          r.usage.output +
          r.usage.cacheRead +
          r.usage.cacheWrite
        return a
      },
      {
        tokens: 0,
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        reportedRuns: 0,
        totalRuns: 0,
        partial: false
      }
    )
  return {
    total: sum(runs),
    scenes: Object.fromEntries(
      [...new Set(runs.flatMap((r) => (r.sceneId ? [r.sceneId] : [])))].map(
        (id) => [id, sum(runs.filter((r) => r.sceneId === id))]
      )
    )
  }
}
