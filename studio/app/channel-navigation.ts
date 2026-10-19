import type { ResearchProjectView } from '../shared/research'
import { projectLink } from './project-links'

export type ChannelNavigation = {
  favorites: string[]
  positions: Record<string, string>
  favoritesClosed: boolean
}
export const channelKey = (project: string, chat: string) =>
  `${project}:Chat:${chat}`
export const readChannelNavigation = (
  raw: string | null
): ChannelNavigation => {
  try {
    const value = JSON.parse(raw || '{}')
    return {
      favorites: Array.isArray(value.favorites)
        ? [
            ...new Set<string>(
              value.favorites.filter((id: unknown) => typeof id === 'string')
            )
          ].slice(0, 200)
        : [],
      positions: Object.fromEntries(
        Object.entries(value.positions || {})
          .filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string'
          )
          .slice(-200)
      ),
      favoritesClosed: value.favoritesClosed === true
    }
  } catch {
    return { favorites: [], positions: {}, favoritesClosed: false }
  }
}
export const channelRows = (
  projects: ResearchProjectView[],
  navigation: ChannelNavigation,
  query = ''
) => {
  const needle = query.trim().toLocaleLowerCase()
  return projects
    .flatMap((project) =>
      (project.chats || []).map((chat) => {
        const key = channelKey(project.id, chat.id)
        const saved = navigation.positions[key]
        // A bookmark is navigation only, and cannot point into another channel.
        const node = project.nodes.some(
          (n) => n.id === saved && n.chatId === chat.id
        )
          ? saved
          : chat.lastNodeId
        return {
          key,
          projectId: project.id,
          chatId: chat.id,
          title: chat.title,
          updatedAt: chat.updatedAt,
          context: chat.repos.map((r) => `${r.name} · ${r.branch}`).join(', '),
          favorite: navigation.favorites.includes(key),
          working: project.nodes.some(
            (n) => n.chatId === chat.id && n.state === 'working'
          ),
          href: projectLink(
            project.id,
            { chat: chat.id, notebook: chat.notebookId, node },
            { projectView: 'research' }
          )
        }
      })
    )
    .filter(
      (row) =>
        !needle ||
        `${row.title} ${row.context}`.toLocaleLowerCase().includes(needle)
    )
    .sort(
      (a, b) =>
        b.updatedAt.localeCompare(a.updatedAt) || a.key.localeCompare(b.key)
    )
}
