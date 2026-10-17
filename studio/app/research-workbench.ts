import {
  defaultResearchLayout,
  normalizeResearchLayout,
  type ResearchLayout
} from './research-layout'
import { ResearchGraphViewport } from './research-graph-viewport'

/** Layout owns pane preferences and viewport behavior. The host owns project
 * data/navigation. This follows Macro's split-layout/router ownership boundary
 * without coupling the notebook engine to a second application framework. */
export class ResearchWorkbench {
  state: ResearchLayout = defaultResearchLayout()
  graph: ResearchGraphViewport
  private key = ''
  private resizing: {
    pane: 'graph' | 'notes'
    start: number
    width: number
  } | null = null
  constructor(
    private root: HTMLElement,
    private changed: () => void
  ) {
    this.graph = new ResearchGraphViewport(root)
    root.addEventListener('pointerdown', (event) => {
      const handle = (event.target as Element).closest<HTMLElement>(
        '[data-resize-pane]'
      )
      if (!handle || event.button !== 0) return
      const pane = handle.dataset.resizePane as 'graph' | 'notes'
      this.resizing = {
        pane,
        start: event.clientX,
        width: pane === 'graph' ? this.state.graphWidth : this.state.notesWidth
      }
      handle.setPointerCapture(event.pointerId)
      event.preventDefault()
    })
    root.addEventListener('pointermove', (event) => {
      if (!this.resizing) return
      const { pane, start, width } = this.resizing
      this.resize(
        pane,
        width + (event.clientX - start) * (pane === 'graph' ? 1 : -1)
      )
    })
    const release = () => {
      if (this.resizing) {
        this.resizing = null
        this.save()
      }
    }
    root.addEventListener('pointerup', release)
    root.addEventListener('pointercancel', release)
    root.addEventListener('keydown', (event) => {
      const pane = (event.target as HTMLElement).dataset.resizePane as
        | 'graph'
        | 'notes'
      if (!pane || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return
      event.preventDefault()
      const width =
        pane === 'graph' ? this.state.graphWidth : this.state.notesWidth
      this.resize(
        pane,
        width +
          (event.key === 'ArrowRight' ? 24 : -24) * (pane === 'graph' ? 1 : -1)
      )
      this.save()
    })
  }
  open(projectId: string) {
    const key = `research-layout:${projectId}`
    if (this.key === key) return
    this.key = key
    try {
      this.state = normalizeResearchLayout(
        JSON.parse(localStorage.getItem(key) || '{}')
      )
    } catch {
      this.state = defaultResearchLayout()
    }
    this.graph.reset()
  }
  get interacting() {
    return Boolean(this.resizing) || this.graph.isDragging
  }
  mount() {
    this.applyWidths()
    this.graph.mount()
  }
  handle(action: string) {
    if (action === 'graph-in') {
      this.graph.scale(1.25)
      return true
    }
    if (action === 'graph-out') {
      this.graph.scale(0.8)
      return true
    }
    if (action === 'graph-reset') {
      this.graph.fit()
      return true
    }
    if (action === 'graph-all' || action === 'graph-local')
      this.state.scope = action === 'graph-local' ? 'local' : 'all'
    else if (action === 'graph-expand')
      this.state.expanded = !this.state.expanded
    else if (action === 'toggle-notebook') {
      this.state.notesOpen = !this.state.notesOpen
      this.state.expanded = false
    } else return false
    this.save()
    this.changed()
    this.graph.fit()
    return true
  }
  depth(value: number) {
    this.state.depth = Math.max(1, Math.min(3, value))
    this.save()
    this.changed()
  }
  private resize(pane: 'graph' | 'notes', value: number) {
    const columns = this.root.querySelector<HTMLElement>('.research-columns')
    const room =
      (columns?.clientWidth || 1000) -
      330 -
      (pane === 'graph'
        ? this.state.notesOpen
          ? this.state.notesWidth
          : 0
        : this.state.graphWidth)
    if (pane === 'graph')
      this.state.graphWidth = Math.max(230, Math.min(620, room, value))
    else this.state.notesWidth = Math.max(230, Math.min(440, room, value))
    this.applyWidths()
  }
  private applyWidths() {
    const columns = this.root.querySelector<HTMLElement>('.research-columns')
    if (!columns) return
    const available = Math.max(460, columns.clientWidth - 330)
    const notesWidth = this.state.notesOpen ? this.state.notesWidth : 0
    const ratio = Math.min(1, available / (this.state.graphWidth + notesWidth))
    columns.style.setProperty(
      '--research-graph-width',
      `${this.state.graphWidth * ratio}px`
    )
    columns.style.setProperty(
      '--research-notes-width',
      `${this.state.notesWidth * ratio}px`
    )
    for (const handle of columns.querySelectorAll<HTMLElement>(
      '[data-resize-pane]'
    ))
      handle.setAttribute(
        'aria-valuenow',
        String(
          handle.dataset.resizePane === 'graph'
            ? this.state.graphWidth
            : this.state.notesWidth
        )
      )
  }
  private save() {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.state))
    } catch {
      /* Layout still works without persistence. */
    }
  }
}
