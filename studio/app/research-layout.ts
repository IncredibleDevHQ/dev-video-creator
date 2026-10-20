import type { GraphScope } from './research-graph-model'

export type ResearchLayout = {
  graphWidth: number
  notesWidth: number
  graphMode?: 'pip' | 'drawer' | 'full'
  graphOpen: boolean
  notesOpen: boolean
  expanded: boolean
  scope: GraphScope
  depth: number
}
export const defaultResearchLayout = (): ResearchLayout => ({
  graphWidth: 310,
  notesWidth: 380,
  graphMode: 'pip',
  graphOpen: false,
  notesOpen: false,
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
    graphMode:
      raw.graphMode === 'full'
        ? 'full'
        : raw.graphMode === 'drawer' || raw.expanded
          ? 'drawer'
          : 'pip',
    graphOpen: raw.graphOpen === true,
    notesOpen: raw.notesOpen === true,
    expanded: raw.graphOpen === true && raw.expanded === true,
    scope: raw.scope === 'local' ? 'local' : 'all',
    depth: Math.round(number(raw.depth, base.depth, 1, 3))
  }
}
/** Draft identity belongs to a pane's resource, never to a temporary DOM id. */
export const researchDraftKey = (
  field: string,
  notebook: string,
  node: string | null,
  chat: string | null = null
) =>
  field === 'research-note-input'
    ? `${field}:${notebook}`
    : field === 'research-question'
      ? `${field}:${chat || node || 'new'}`
      : field === 'research-repo-path'
        ? `${field}:${chat || 'new'}`
        : field
