import type { ResearchProjectView } from '../shared/research'
import type { ResearchViewState } from './research-view'
import { projectLink } from './project-links'

export type WorkspaceItem = {
  key: string
  projectId: string
  projectTitle: string
  title: string
  kind:
    | 'Notes'
    | 'Chat'
    | 'Create'
    | 'Canvas'
    | 'Wireframes'
    | 'Video'
    | 'Question'
  href: string
  search?: string
}
export type WorkspaceState = { pinned: string[]; recent: WorkspaceItem[] }
const kinds = new Set([
  'Notes',
  'Chat',
  'Create',
  'Canvas',
  'Wireframes',
  'Video',
  'Question'
])
const parameters = new Set([
  'space',
  'book',
  'chat',
  'node',
  'projectView',
  'detail',
  'notebook',
  'map',
  'view',
  'scene'
])
/** Persist only local resource identity; never arbitrary links or response bodies. */
export const safeWorkspaceHref = (value: unknown): string | null => {
  if (typeof value !== 'string' || !value.startsWith('/?')) return null
  try {
    const url = new URL(value, 'http://workspace.local')
    if (
      url.origin !== 'http://workspace.local' ||
      !url.searchParams.get('space')
    )
      return null
    for (const key of [...url.searchParams.keys()])
      if (!parameters.has(key)) url.searchParams.delete(key)
    return `/?${url.searchParams}`
  } catch {
    return null
  }
}
export const readWorkspaceState = (raw: string | null): WorkspaceState => {
  try {
    const parsed = JSON.parse(raw || '{}')
    const recent: WorkspaceItem[] = []
    for (const item of Array.isArray(parsed.recent) ? parsed.recent : []) {
      const href = safeWorkspaceHref(item?.href)
      if (
        !href ||
        !kinds.has(item.kind) ||
        ['key', 'projectId', 'projectTitle', 'title'].some(
          (k) => typeof item[k] !== 'string'
        ) ||
        new URL(href, 'http://workspace.local').searchParams.get('space') !==
          item.projectId
      )
        continue
      if (recent.some((r) => r.key === item.key)) continue
      recent.push({
        key: item.key,
        projectId: item.projectId,
        projectTitle: item.projectTitle.slice(0, 160),
        title: item.title.slice(0, 200),
        kind: item.kind,
        href
      })
      if (recent.length === 20) break
    }
    return {
      pinned: [
        ...new Set<string>(
          (Array.isArray(parsed.pinned) ? parsed.pinned : []).filter(
            (id: unknown) => typeof id === 'string'
          )
        )
      ].slice(0, 100),
      recent
    }
  } catch {
    return { pinned: [], recent: [] }
  }
}
export const rememberWorkspaceItem = (
  state: WorkspaceState,
  item: WorkspaceItem
): WorkspaceState => ({
  ...state,
  recent: [
    { ...item, search: undefined },
    ...state.recent.filter((old) => old.key !== item.key)
  ].slice(0, 20)
})
export const researchWorkspaceItem = (s: ResearchViewState): WorkspaceItem => {
  const kind = s.contentOpen ? 'Create' : s.documentExpanded ? 'Notes' : 'Chat'
  const resource =
    kind === 'Notes' ? s.notebook : kind === 'Chat' ? s.chat || 'new' : 'create'
  const title =
    kind === 'Notes'
      ? s.project.notebooks.find((n) => n.id === s.notebook)?.title
      : kind === 'Chat'
        ? s.project.chats?.find((c) => c.id === s.chat)?.title
        : 'Create'
  return {
    key: `${s.project.id}:${kind}:${resource}`,
    projectId: s.project.id,
    projectTitle: s.project.title,
    title: title || 'New chat',
    kind,
    href: projectLink(s.project.id, s, {
      projectView:
        kind === 'Notes' ? 'notes' : kind === 'Create' ? 'canvas' : 'research'
    })
  }
}
export const outputWorkspaceItem = (
  project: ResearchProjectView,
  url: URL
): WorkspaceItem => {
  const id =
    url.searchParams.get('map') || url.searchParams.get('notebook') || ''
  const kind = url.searchParams.has('map')
    ? 'Canvas'
    : url.searchParams.get('view') === 'video'
      ? 'Video'
      : 'Wireframes'
  return {
    key: `${project.id}:${kind}:${id}`,
    projectId: project.id,
    projectTitle: project.title,
    title:
      kind === 'Canvas'
        ? 'Project canvas'
        : project.notebooks.find((n) => n.id === id)?.title || kind,
    kind,
    href: safeWorkspaceHref(url.pathname + url.search)!
  }
}
export const projectSearchItems = (
  project: ResearchProjectView
): WorkspaceItem[] => [
  ...project.notebooks.map((n) => ({
    key: `${project.id}:Notes:${n.id}`,
    projectId: project.id,
    projectTitle: project.title,
    title: n.title,
    kind: 'Notes' as const,
    href: projectLink(project.id, { notebook: n.id }, { projectView: 'notes' }),
    search: n.blocks.map((b) => b.text).join('\n')
  })),
  ...(project.chats || []).map((c) => ({
    key: `${project.id}:Chat:${c.id}`,
    projectId: project.id,
    projectTitle: project.title,
    title: c.title,
    kind: 'Chat' as const,
    href: projectLink(
      project.id,
      { chat: c.id, node: c.lastNodeId, notebook: c.notebookId },
      { projectView: 'research' }
    )
  })),
  ...project.nodes.map((n) => ({
    key: `${project.id}:Question:${n.id}`,
    projectId: project.id,
    projectTitle: project.title,
    title: n.question,
    kind: 'Question' as const,
    href: projectLink(
      project.id,
      { chat: n.chatId, node: n.id },
      { projectView: 'research' }
    )
  }))
]
