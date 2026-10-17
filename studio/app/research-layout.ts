import type { GraphScope } from './research-graph-model'

export type ResearchLayout = {
  graphWidth: number
  notesWidth: number
  notesOpen: boolean
  expanded: boolean
  scope: GraphScope
  depth: number
}
export const defaultResearchLayout = (): ResearchLayout => ({
  graphWidth: 310,
  notesWidth: 280,
  notesOpen: true,
  expanded: false,
  scope: 'all',
  depth: 2
})
export const normalizeResearchLayout = (
  raw: Partial<ResearchLayout> = {}
): ResearchLayout => {
  const base = defaultResearchLayout()
  const number = (
    value: unknown,
    fallback: number,
    min: number,
    max: number
  ) =>
    typeof value === 'number' && Number.isFinite(value)
      ? Math.max(min, Math.min(max, value))
      : fallback
  return {
    graphWidth: number(raw.graphWidth, base.graphWidth, 230, 620),
    notesWidth: number(raw.notesWidth, base.notesWidth, 230, 440),
    notesOpen: typeof raw.notesOpen === 'boolean' ? raw.notesOpen : true,
    expanded: typeof raw.expanded === 'boolean' ? raw.expanded : false,
    scope: raw.scope === 'local' ? 'local' : 'all',
    depth: Math.round(number(raw.depth, base.depth, 1, 3))
  }
}
/** Draft identity belongs to a pane's resource, never to a temporary DOM id. */
export const researchDraftKey = (
  field: string,
  notebook: string,
  node: string | null
) =>
  field === 'research-note-input'
    ? `${field}:${notebook}`
    : field === 'research-question'
      ? `${field}:${node || 'new'}`
      : field
