import type { ResearchNode } from './research'
import { researchPath } from './research'
import { researchDocumentFor } from './research-documents'

/** A conversation is one root/selected-passage branch and all ordinary replies.
 * Turns remain immutable: following parentId freezes the exact fork boundary. */
export const conversationId = (nodes: ResearchNode[], node: ResearchNode) =>
  node.conversationId || researchDocumentFor(nodes, node.id)?.id || node.id

export const conversationTurns = (
  nodes: ResearchNode[],
  selected: string | null
) => {
  const node = nodes.find((n) => n.id === selected)
  if (!node) return []
  const id = conversationId(nodes, node)
  return nodes.filter(
    (n) => n.chatId === node.chatId && conversationId(nodes, n) === id
  )
}
export const conversationHead = (
  nodes: ResearchNode[],
  selected: string | null
) => conversationTurns(nodes, selected).at(-1)

/** Never use channel-wide chronological history: siblings and parent turns
 * written after the fork are not ancestors, even when they precede this turn. */
export const ancestorTurns = (nodes: ResearchNode[], node: ResearchNode) =>
  researchPath(nodes, node.parentId).filter(
    (n) => n.chatId === node.chatId && n.state === 'done'
  )
