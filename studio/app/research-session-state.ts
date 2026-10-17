import type { HarnessSelection } from '../shared/model'
import type { ResearchViewState } from './research-view'
import { recentResearchChats } from '../shared/research-chats'

export const selectResearchChat = (s: ResearchViewState, id: string | null) => {
  s.chatPositions ||= {}
  if (s.chat) s.chatPositions[s.chat] = s.node
  const chat =
    s.project.chats?.find((c) => c.id === id) ||
    recentResearchChats(s.project.chats)[0]
  s.chat = chat?.id || null
  const position = chat ? s.chatPositions[chat.id] : undefined
  s.node =
    position === null
      ? null
      : s.project.nodes.find((n) => n.id === position && n.chatId === chat?.id)
          ?.id ||
        chat?.lastNodeId ||
        null
  s.anchor = null
  s.inspected = null
  s.repos = structuredClone(chat?.repos || [])
  s.adapter = chat?.harness?.adapter || 'claude-code'
  s.model = chat?.harness?.model || ''
  s.query = ''
}
export const selectResearchNode = (
  s: ResearchViewState,
  id: string,
  clearAnchor = true
) => {
  const node = s.project.nodes.find((n) => n.id === id)
  if (!node) return
  const anchor = s.anchor
  if (node.chatId !== s.chat) selectResearchChat(s, node.chatId || null)
  s.node = node.id
  s.anchor = clearAnchor ? null : anchor
  s.tab = 'research'
}
export const chatSettings = (s: ResearchViewState) => ({
  chatId: s.chat,
  harness: {
    adapter: s.adapter as HarnessSelection['adapter'],
    ...(s.model ? { model: s.model } : {})
  },
  repos: structuredClone(s.repos)
})
