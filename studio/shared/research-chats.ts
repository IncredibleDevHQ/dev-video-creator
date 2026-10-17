import type { ResearchProject, ResearchChat } from './research'
import { researchPath } from './research'

/** Upgrade legacy branches in memory; normal project writes persist the result.
 * IDs derive from existing roots, so reads never create duplicate chats. */
export const normalizeResearchChats = <T extends ResearchProject>(
  project: T
): T => {
  project.chats ||= []
  for (const node of project.nodes) {
    if (node.chatId && project.chats.some((c) => c.id === node.chatId)) continue
    const path = researchPath(project.nodes, node.id)
    const root = path[0] || node
    const id = root.chatId || `chat-${root.id}`
    let chat = project.chats.find((c) => c.id === id)
    if (!chat) {
      chat = {
        id,
        title: root.question.slice(0, 100),
        createdAt: root.at,
        updatedAt: node.at,
        repos: node.repos.map(({ commit: _, ...r }) => r),
        harness: node.harness,
        lastNodeId: node.id
      }
      project.chats.push(chat)
    }
    node.chatId = id
    if (node.at >= chat.updatedAt) {
      chat.updatedAt = node.at
      chat.lastNodeId = node.id
      chat.repos = node.repos.map(({ commit: _, ...r }) => r)
      chat.harness = node.harness
    }
  }
  return project
}
export const recentResearchChats = (chats: ResearchChat[] = []) =>
  [...chats].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
