/** Imperative graph viewport; navigation and project data stay in the host.
 * Transform state survives renders and polling. Pointer capture keeps dragging
 * bound to the graph instead of selecting the transcript beside it. */
export class ResearchGraphViewport {
  private x = 0
  private y = 0
  private zoom = 1
  private fitted = false
  private local = 'all'
  private size = ''
  private frame: HTMLElement | null = null
  private drag: {
    x: number
    y: number
    startX: number
    startY: number
  } | null = null
  private observer = new ResizeObserver(() => {
    const size = `${this.frame?.clientWidth}:${this.frame?.clientHeight}`
    if (!this.fitted || size !== this.size) this.fit()
    else this.paint()
    this.size = size
  })
  constructor(private root: HTMLElement) {
    root.addEventListener('pointerdown', (event) => {
      const target = event.target as Element
      const frame = target.closest<HTMLElement>('.research-graph-scroll')
      if (!frame || target.closest('button') || event.button !== 0) return
      frame.focus({ preventScroll: true })
      this.drag = {
        x: event.clientX,
        y: event.clientY,
        startX: this.x,
        startY: this.y
      }
      frame.setPointerCapture(event.pointerId)
      frame.classList.add('panning')
      event.preventDefault()
    })
    root.addEventListener('pointermove', (event) => {
      if (!this.drag) return
      this.x = this.drag.startX + event.clientX - this.drag.x
      this.y = this.drag.startY + event.clientY - this.drag.y
      this.paint()
    })
    const release = () => {
      this.drag = null
      this.frame?.classList.remove('panning')
    }
    root.addEventListener('pointerup', release)
    root.addEventListener('pointercancel', release)
    root.addEventListener(
      'wheel',
      (event) => {
        if (!(event.target as Element).closest('.research-graph-scroll')) return
        event.preventDefault()
        const box = this.frame!.getBoundingClientRect()
        this.scale(
          Math.exp(-event.deltaY * 0.0015),
          event.clientX - box.left,
          event.clientY - box.top
        )
      },
      { passive: false }
    )
    root.addEventListener('keydown', (event) => {
      if (!(event.target as Element).closest('.research-graph-scroll')) return
      if (['+', '=', '-'].includes(event.key)) {
        event.preventDefault()
        this.scale(event.key === '-' ? 0.8 : 1.25)
      } else if (event.target === this.frame && event.key.startsWith('Arrow')) {
        event.preventDefault()
        const step = event.shiftKey ? 90 : 30
        if (event.key === 'ArrowLeft') this.x += step
        if (event.key === 'ArrowRight') this.x -= step
        if (event.key === 'ArrowUp') this.y += step
        if (event.key === 'ArrowDown') this.y -= step
        this.paint()
      } else if (event.key === '0') {
        event.preventDefault()
        this.fit()
      }
    })
    root.addEventListener('pointerover', (event) =>
      this.highlight(
        (event.target as Element).closest<HTMLElement>('[data-graph-node]')
          ?.dataset.graphNode
      )
    )
    root.addEventListener('focusin', (event) =>
      this.highlight(
        (event.target as Element).closest<HTMLElement>('[data-graph-node]')
          ?.dataset.graphNode
      )
    )
    root.addEventListener('pointerleave', () => this.highlight())
  }
  reset() {
    this.fitted = false
    this.drag = null
  }
  mount() {
    this.observer.disconnect()
    this.frame = this.root.querySelector('.research-graph-scroll')
    if (!this.frame) return
    this.observer.observe(this.frame)
    const local =
      this.root.querySelector<HTMLElement>('.research-graph-plane')?.dataset
        .graphLocal || 'all'
    if (local !== this.local) this.fitted = false
    this.local = local
    if (!this.fitted) this.fit()
    else this.paint()
  }
  fit() {
    const plane = this.root.querySelector<HTMLElement>('.research-graph-plane')
    if (!plane || !this.frame?.clientWidth) return
    const width = Number(plane.dataset.graphWidth),
      height = Number(plane.dataset.graphHeight)
    const floating = Boolean(this.frame.closest('.graph-pip'))
    this.zoom = Math.min(
      1.5,
      Math.max(
        0.15,
        Math.min(
          (this.frame.clientWidth - 24) / width,
          (this.frame.clientHeight - (floating ? 12 : 64)) / height
        )
      )
    )
    this.x = (this.frame.clientWidth - width * this.zoom) / 2
    this.y =
      (this.frame.clientHeight - height * this.zoom) / 2 - (floating ? 0 : 16)
    this.fitted = true
    this.paint()
  }
  scale(
    factor: number,
    x = (this.frame?.clientWidth || 0) / 2,
    y = (this.frame?.clientHeight || 0) / 2
  ) {
    const next = Math.max(0.15, Math.min(3, this.zoom * factor))
    this.x = x - ((x - this.x) * next) / this.zoom
    this.y = y - ((y - this.y) * next) / this.zoom
    this.zoom = next
    this.paint()
  }
  get isDragging() {
    return Boolean(this.drag)
  }
  private paint() {
    const plane = this.root.querySelector<HTMLElement>('.research-graph-plane')
    if (plane)
      plane.style.transform = `translate(${this.x}px, ${this.y}px) scale(${this.zoom})`
    const label = this.root.querySelector('[data-graph-zoom]')
    if (label) label.textContent = `${Math.round(this.zoom * 100)}%`
  }
  private highlight(id?: string) {
    const plane = this.root.querySelector('.research-graph-plane')
    if (!plane) return
    plane.classList.toggle('has-hover', Boolean(id))
    const connected = new Set([id])
    for (const edge of plane.querySelectorAll<HTMLElement>(
      '[data-graph-edge]'
    )) {
      const active =
        edge.dataset.graphFrom === id || edge.dataset.graphTo === id
      edge.classList.toggle('hover-link', Boolean(id && active))
      if (id && active) {
        connected.add(edge.dataset.graphFrom)
        connected.add(edge.dataset.graphTo)
      }
    }
    for (const node of plane.querySelectorAll<HTMLElement>('[data-graph-node]'))
      node.classList.toggle(
        'hover-linked',
        connected.has(node.dataset.graphNode)
      )
  }
}
