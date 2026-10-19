/** Values are offered only when the selected local model advertises them. */
export const reasoningEfforts = [
  'none',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
  'ultra'
] as const
export type ReasoningEffort = (typeof reasoningEfforts)[number]
export const isReasoningEffort = (value: unknown): value is ReasoningEffort =>
  typeof value === 'string' &&
  (reasoningEfforts as readonly string[]).includes(value)
export const effortLabels: Record<ReasoningEffort, string> = {
  none: 'None',
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra high',
  max: 'Maximum',
  ultra: 'Ultra'
}
export const effortDescriptions: Record<ReasoningEffort, string> = {
  none: 'No reasoning · fastest responses',
  minimal: 'Very light reasoning for simple questions',
  low: 'Faster answers for straightforward questions',
  medium: 'Balance response time and depth',
  high: 'Deeper reasoning for complex questions',
  xhigh: 'More time to work through difficult problems',
  max: 'Deepest model reasoning · more time and usage',
  ultra: 'Most intensive reasoning · more time and usage'
}
export type EffortCatalog = {
  default: string | null
  options: Array<{
    id: string
    efforts?: ReasoningEffort[]
    unavailable?: string
  }>
}
export const modelEfforts = (
  catalog: EffortCatalog | undefined,
  model?: string
): ReasoningEffort[] =>
  catalog?.options.find(
    (item) => item.id === (model || catalog.default) && !item.unavailable
  )?.efforts || []
