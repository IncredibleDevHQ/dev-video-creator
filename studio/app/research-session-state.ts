import { restoreNewResearchChat } from './research-chat-draft'
import type { HarnessSelection } from '../shared/model'
import type { ResearchViewState } from './research-view'
import { recentResearchChats } from '../shared/research-chats'

/** Start with the question. A durable, named chat is created by the first send. */
export const startResearchChat = (s: ResearchViewState) => {
  s.chatPositions ||= {}
  if (s.chat) s.chatPositions[s.chat] = s.node
  s.chat = null
  s.node = null
  s.anchor = null
  s.inspected = null
  s.repos = []
  s.query = ''
  s.error = ''
  s.message = ''
  s.sidebarOpen = false
  s.contentOpen = false
  s.documentExpanded = false
  s.chatMinimized = false
  if (s.layout) {
    s.layout.notesOpen = false
    s.layout.graphOpen = false
    s.layout.expanded = false
  }
}

export const selectResearchChat = (s: ResearchViewState, id: string | null) => {
  if (id === 'new') {
    startResearchChat(s)
    restoreNewResearchChat(s)
    return
  }
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
  s.notebook =
    s.project.notebooks.find((n) => n.id === chat?.notebookId)?.id ||
    s.project.notebooks
      .flatMap((book) =>
        book.blocks
          .filter((block) =>
            s.project.nodes.some(
              (node) =>
                node.id === block.origin?.nodeId && node.chatId === chat?.id
            )
          )
          .map((block) => ({ id: book.id, at: block.at }))
      )
      .sort((a, b) => b.at.localeCompare(a.at))[0]?.id ||
    s.project.notebooks[0].id
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
  repos: structuredClone(s.repos),
  notebookId: s.notebook
})
