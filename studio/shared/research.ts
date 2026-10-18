import type { HarnessSelection } from './model'
import type { RepoLink } from './repos'
import type { Snapshot } from './api'

/** A project is a collection of notebooks, not the historical engine Project
 * (which remains one notebook to keep existing production APIs compatible). */
export type ResearchOrigin = {
  nodeId: string
  question: string
  response: string
  start: number
  end: number
  repos: ResearchRepo[]
}
export type ResearchRepo = RepoLink & { commit: string }
export type NoteBlock = {
  id: string
  text: string
  at: string
  origin?: ResearchOrigin
}
export type ProjectNotebook = {
  id: string
  title: string
  blocks: NoteBlock[]
}
export type ResearchAnchor = {
  kind: 'response' | 'note'
  id: string
  notebookId?: string
  text: string
  start: number
  end: number
}
export type ResearchChat = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  repos: RepoLink[]
  /** The default destination for excerpts captured in this chat. */
  notebookId?: string
  harness?: HarnessSelection
  lastNodeId?: string
}
export type ResearchNode = {
  /** Optional only for records written before named chats. */
  chatId?: string
  id: string
  parentId: string | null
  question: string
  anchor?: ResearchAnchor
  harness: HarnessSelection
  repos: ResearchRepo[]
  at: string
  state: 'working' | 'done' | 'failed' | 'stopped'
  answer: string
  answerText: string
  /** false means an ordinary chat reply; artifacts alone become graph nodes. */
  artifact?: false | { title: string; parentId: string | null }
  contextDocumentId?: string
  sessionMode?: 'new' | 'continued' | 'branched'
  activity?: string
  error?: string
}
export type ResearchProject = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  notebooks: ProjectNotebook[]
  nodes: ResearchNode[]
  chats?: ResearchChat[]
  repos: RepoLink[]
  /** The local checkout that owns this project; chat branches remain independent. */
  repository?: RepoLink
  harness?: HarnessSelection
  /** One aggregate notebook drives the existing content-map / series engine. */
  canvasId?: string
  syncError?: string
}
export type ResearchProjectView = ResearchProject & {
  snapshots: Snapshot[]
  canvas: Snapshot | null
}
export type ResearchProjectSummary = Pick<
  ResearchProject,
  'id' | 'title' | 'updatedAt' | 'repository'
> & {
  notebooks: number
  questions: number
}

export const researchPath = (
  nodes: ResearchNode[],
  id: string | null
): ResearchNode[] => {
  const path: ResearchNode[] = []
  const seen = new Set<string>()
  while (id && !seen.has(id)) {
    seen.add(id)
    const node = nodes.find((item) => item.id === id)
    if (!node) break
    path.unshift(node)
    id = node.parentId
  }
  return path
}

/** Selection offsets are against stored plain text, not rendered Markdown. */
export const validExcerpt = (text: string, start: unknown, end: unknown) =>
  typeof start === 'number' &&
  Number.isInteger(start) &&
  typeof end === 'number' &&
  Number.isInteger(end) &&
  start >= 0 &&
  end > start &&
  end <= text.length &&
  end - start <= 7600
