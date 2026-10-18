import { rememberNewResearchChat } from './research-chat-draft'
import { projectLink } from './project-links'
import { startResearchChat } from './research-session-state'
import type { ResearchViewState } from './research-view'
import type { ResearchWorkbench } from './research-workbench'

export const showResearchTurn = (
  root: HTMLElement,
  workbench: ResearchWorkbench,
  node: string | null
) => {
  if (matchMedia('(max-width: 700px)').matches) {
    if (workbench.state.graphOpen) workbench.handle('toggle-graph')
    if (workbench.state.notesOpen) workbench.handle('toggle-notebook')
  }
  const transcript = root.querySelector<HTMLElement>('.research-transcript')
  const turn = root.querySelector<HTMLElement>(
    `#turn-${CSS.escape(node || '')}`
  )
  if (matchMedia('(max-width: 700px)').matches)
    root.querySelector('.research-chat')?.scrollIntoView({ block: 'start' })
  if (transcript && turn)
    transcript.scrollTop +=
      turn.getBoundingClientRect().top -
      transcript.getBoundingClientRect().top -
      12
}

/** One workspace, with optional graph, document, or content focus. */
export const toggleProjectPanel = (
  action: string,
  s: ResearchViewState,
  workbench: ResearchWorkbench,
  render: () => void
) => {
  if (action === 'new-chat') {
    startResearchChat(s)
    rememberNewResearchChat(s)
  } else if (action === 'toggle-sidebar') {
    s.sidebarOpen = !s.sidebarOpen
  } else if (['open-notes', 'open-chat', 'minimize-chat'].includes(action)) {
    s.sidebarOpen = false
    s.contentOpen = false
    s.documentExpanded = action !== 'open-chat'
    s.chatMinimized = action === 'minimize-chat'
    workbench.state.notesOpen = s.documentExpanded
    workbench.state.graphOpen = false
    workbench.state.expanded = false
  } else if (action === 'expand-document') {
    s.documentExpanded = !s.documentExpanded
  } else if (action === 'open-content' || action === 'close-content') {
    s.sidebarOpen = false
    s.documentExpanded = false
    s.contentOpen = action === 'open-content'
    if (action === 'close-content' && window.innerWidth <= 700) {
      workbench.state.notesOpen = false
      workbench.state.graphOpen = false
    }
  } else if (action === 'open-notebook' || action === 'toggle-graph') {
    if (s.contentOpen || s.documentExpanded) {
      if (action === 'open-notebook') workbench.state.notesOpen = false
      else workbench.state.graphOpen = false
    }
    s.sidebarOpen = false
    s.contentOpen = false
    s.documentExpanded = false
    workbench.handle(action === 'open-notebook' ? 'toggle-notebook' : action)
    return true
  } else return false
  render()
  if (action === 'new-chat')
    document.querySelector<HTMLElement>('#research-question')?.focus()
  return true
}

export const researchLocation = (s: ResearchViewState) =>
  projectLink(
    s.project.id,
    { ...s, chat: s.chat || 'new' },
    {
      projectView: s.contentOpen
        ? 'canvas'
        : s.documentExpanded
          ? 'notes'
          : 'research'
    }
  )

/** A saved-answer link should land on the excerpt, not the notebook's top. */
export const showSavedNote = (root: HTMLElement, source?: string) => {
  if (!source) return
  const note = root.querySelector<HTMLElement>(
    `[data-note-source="${CSS.escape(source)}"]`
  )
  const scroll = note?.closest<HTMLElement>('.research-note-scroll')
  if (!note || !scroll) return
  scroll.scrollTop +=
    note.getBoundingClientRect().top - scroll.getBoundingClientRect().top - 12
  note.setAttribute('tabindex', '-1')
  note.focus({ preventScroll: true })
}
