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
  if (action === 'toggle-sidebar') {
    s.sidebarOpen = !s.sidebarOpen
  } else if (action === 'expand-document') {
    s.documentExpanded = !s.documentExpanded
  } else if (action === 'open-content' || action === 'close-content') {
    s.sidebarOpen = false
    s.documentExpanded = false
    s.contentOpen = action === 'open-content'
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
  return true
}
