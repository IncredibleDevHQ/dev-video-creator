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
  private inerted: HTMLElement[] = []
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
    window.addEventListener('resize', () => {
      if (this.constrainPanes()) {
        this.resizing = null
        this.save()
        this.changed()
        this.graph.fit()
      }
      this.applyWidths()
    })
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
      if (this.state.graphOpen && event.key === 'Escape') {
        event.preventDefault()
        this.handle(
          this.state.graphMode === 'full'
            ? 'graph-drawer'
            : this.state.graphMode === 'drawer'
              ? 'graph-pip'
              : 'toggle-graph'
        )
        return
      }
      if (
        this.state.graphOpen &&
        this.state.graphMode === 'full' &&
        event.key === 'Tab'
      ) {
        const items = Array.from(
          root.querySelectorAll<HTMLElement>(
            '#research-graph-panel button, #research-graph-panel input, #research-graph-panel summary, #research-graph-panel [tabindex="0"]'
          )
        ).filter((el) => el.getClientRects().length)
        const first = items[0],
          last = items.at(-1)
        if (
          event.shiftKey
            ? document.activeElement === first
            : document.activeElement === last
        ) {
          event.preventDefault()
          ;(event.shiftKey ? last : first)?.focus()
        }
      }
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
    this.constrainPanes()
    this.graph.reset()
  }
  get interacting() {
    return Boolean(this.resizing) || this.graph.isDragging
  }
  mount() {
    this.applyWidths()
    this.graph.mount()
    for (const element of this.inerted) element.inert = false
    this.inerted = []
    const panel = this.root.querySelector<HTMLElement>('#research-graph-panel')
    if (panel && this.state.graphOpen && this.state.graphMode === 'full') {
      let child: HTMLElement = panel
      while (child !== this.root && child.parentElement) {
        for (const sibling of Array.from(child.parentElement.children)) {
          const element = sibling as HTMLElement
          if (element !== child && !element.inert) {
            element.inert = true
            this.inerted.push(element)
          }
        }
        child = child.parentElement
      }
      if (!panel.contains(document.activeElement))
        panel.querySelector<HTMLElement>('button')?.focus()
    }
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
    else if (action === 'toggle-graph') {
      this.state.graphOpen = !this.state.graphOpen
      this.state.expanded = false
      this.state.graphMode = 'pip'
      if (this.state.graphOpen) this.state.notesOpen = false
    } else if (
      ['graph-expand', 'graph-drawer', 'graph-full', 'graph-pip'].includes(
        action
      )
    ) {
      this.state.graphOpen = true
      this.state.graphMode =
        action === 'graph-full'
          ? 'full'
          : action === 'graph-pip'
            ? 'pip'
            : 'drawer'
      this.state.expanded = this.state.graphMode !== 'pip'
      this.state.notesOpen = false
    } else if (action === 'toggle-notebook') {
      this.state.notesOpen = !this.state.notesOpen
      this.state.expanded = false
      if (this.state.notesOpen) this.state.graphOpen = false
    } else return false
    this.save()
    this.changed()
    this.graph.fit()
    if (action.startsWith('graph-'))
      this.root
        .querySelector<HTMLElement>('#research-graph-panel button')
        ?.focus()
    if (action === 'toggle-graph')
      this.root
        .querySelector<HTMLElement>(
          this.state.graphOpen
            ? '#research-graph-panel button'
            : '.project-chat-actions [data-research-action="toggle-graph"]'
        )
        ?.focus()
    return true
  }
  depth(value: number) {
    this.state.depth = Math.max(1, Math.min(3, value))
    this.save()
    this.changed()
  }
  private constrainPanes() {
    if (!this.state.graphOpen || !this.state.notesOpen) return false
    if (this.state.expanded) this.state.notesOpen = false
    else this.state.graphOpen = false
    return true
  }
  private resize(pane: 'graph' | 'notes', value: number) {
    const columns = this.root.querySelector<HTMLElement>('.research-columns')
    const graphOpen = this.state.graphOpen
    const notesOpen = this.state.notesOpen && !this.state.expanded
    if (pane === 'graph' ? !graphOpen : !notesOpen) return
    const room = Math.max(
      0,
      (columns?.clientWidth || 1000) -
        480 -
        (Number(graphOpen) + Number(notesOpen)) * 5 -
        (pane === 'graph'
          ? notesOpen
            ? this.state.notesWidth
            : 0
          : graphOpen
            ? this.state.graphWidth
            : 0)
    )
    if (pane === 'graph')
      this.state.graphWidth = Math.max(
        Math.min(230, room),
        Math.min(620, room, value)
      )
    else
      this.state.notesWidth = Math.max(
        Math.min(230, room),
        Math.min(440, room, value)
      )
    this.applyWidths()
  }
  private applyWidths() {
    const columns = this.root.querySelector<HTMLElement>('.research-columns')
    if (!columns) return
    const graphWidth = this.state.graphOpen ? this.state.graphWidth : 0
    const notesWidth =
      this.state.notesOpen && !this.state.expanded ? this.state.notesWidth : 0
    const available = Math.max(
      0,
      columns.clientWidth -
        480 -
        (Number(graphWidth > 0) + Number(notesWidth > 0)) * 5
    )
    const total = graphWidth + notesWidth
    const ratio = total ? Math.min(1, available / total) : 1
    columns.style.setProperty(
      '--research-graph-width',
      `${graphWidth * ratio}px`
    )
    columns.style.setProperty(
      '--research-notes-width',
      `${notesWidth * ratio}px`
    )
    for (const handle of columns.querySelectorAll<HTMLElement>(
      '[data-resize-pane]'
    ))
      handle.setAttribute(
        'aria-valuenow',
        String(
          handle.dataset.resizePane === 'graph'
            ? Math.round(graphWidth * ratio)
            : Math.round(notesWidth * ratio)
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
