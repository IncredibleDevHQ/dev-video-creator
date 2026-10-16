// Studio AI's cursor on the canvas: a pointer with its name that glides to
// what it works on, presses, drags a wire from a handle, and types into a
// note bubble, as a second person on the canvas would. It sits over the
// canvas in screen pixels, so it keeps its size at any zoom and can reach
// the floating tools; on the canvas it stays with what it points at.
import type { MapCanvas } from './map-canvas'
import { repaintWires } from './map-paint'

export type Point = { x: number; y: number }
const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))
const still = () =>
  globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

const ARROW =
  '<svg class="map-ai-arrow" viewBox="0 0 20 22" aria-hidden="true"><path d="M2.2 1.8 17 10.9l-6.9 1.6-3.3 7.3z"/></svg>'

/** A wire's bend, as the canvas draws its own. */
const bend = (a: Point, b: Point) => {
  const h = Math.max(40, Math.abs(b.x - a.x) * 0.5) * (b.x < a.x ? -1 : 1)
  return `M${a.x},${a.y} C${a.x + h},${a.y} ${b.x - h},${b.y} ${b.x},${b.y}`
}

export class AiCursor {
  private node: HTMLElement | null = null
  /** Where it is: a point on the canvas (moves with it) or on the stage. */
  private anchor: { world?: Point; screen?: Point } | null = null
  private at: Point = { x: 0, y: 0 }
  private quiet: ReturnType<typeof setTimeout> | null = null
  private marked: HTMLElement | null = null
  constructor(private readonly map: MapCanvas) {}

  private stage() {
    return this.map.root.querySelector<HTMLElement>('.map-stage')
  }
  private element() {
    const stage = this.stage()
    if (!stage) return null
    let layer = stage.querySelector<HTMLElement>('.map-ai-overlay')
    if (!layer) {
      layer = document.createElement('div')
      layer.className = 'map-ai-overlay'
      layer.setAttribute('aria-hidden', 'true')
      stage.appendChild(layer)
    }
    if (!this.node || !layer.contains(this.node)) {
      const node = document.createElement('div')
      node.className = 'map-ai-cursor'
      node.hidden = true
      node.innerHTML = `${ARROW}<span class="map-ai-tag"><b>Studio AI</b><em hidden></em></span><p class="map-ai-typing" hidden></p><p class="map-ai-bubble" hidden></p>`
      layer.appendChild(node)
      this.node = node
      this.anchor = null
    }
    return this.node
  }
  private part(name: string) {
    return this.element()?.querySelector<HTMLElement>(`.map-ai-${name}`) || null
  }

  /** A point on the canvas, in the stage's pixels. */
  screenOf(p: Point): Point {
    const stage = this.stage()?.getBoundingClientRect()
    const canvas = this.map.canvas?.getBoundingClientRect()
    const { x, y, k } = this.map.camera
    return {
      x: (canvas?.left ?? 0) - (stage?.left ?? 0) + x + p.x * k,
      y: (canvas?.top ?? 0) - (stage?.top ?? 0) + y + p.y * k
    }
  }
  /** Where to point at an element: a little in from its top left. */
  private screenOfElement(element: Element): Point {
    const stage = this.stage()?.getBoundingClientRect()
    const box = element.getBoundingClientRect()
    return {
      x: box.left - (stage?.left ?? 0) + Math.min(28, box.width / 2),
      y: box.top - (stage?.top ?? 0) + Math.min(18, box.height / 2)
    }
  }
  private put(p: Point, ms: number) {
    const node = this.element()
    if (!node) return
    node.style.transition = ms
      ? `transform ${ms}ms cubic-bezier(.3,.7,.2,1)`
      : 'none'
    node.style.transform = `translate(${Math.round(p.x)}px,${Math.round(p.y)}px)`
    this.at = p
  }

  get shown() {
    return Boolean(this.node?.isConnected && !this.node.hidden)
  }
  /** Joins the canvas where it can be seen, near the top. */
  show() {
    const node = this.element()
    if (!node) return
    if (!this.anchor) {
      const width = this.stage()?.getBoundingClientRect().width || 800
      this.anchor = { screen: { x: width * 0.62, y: 150 } }
      this.put(this.anchor.screen!, 0)
    }
    node.hidden = false
  }
  hide() {
    this.unmark()
    this.node?.remove()
    this.node = null
    this.anchor = null
  }
  /** The camera moved: on the canvas, it moves with what it points at. */
  follow(animate: boolean) {
    if (this.anchor?.world && this.shown)
      this.put(this.screenOf(this.anchor.world), animate ? 450 : 0)
  }

  /** Brings a point into view, as a collaborator's work is followed. */
  private async inView(p: Point) {
    const box = this.map.canvas?.getBoundingClientRect()
    if (!box) return
    const s = this.screenOf(p)
    const margin = 90
    if (
      s.x > margin &&
      s.y > margin &&
      s.x < box.width - margin &&
      s.y < box.height - margin
    )
      return
    this.map.camera.x += box.width * 0.45 - s.x
    this.map.camera.y += box.height * 0.42 - s.y
    this.map.applyCamera(true)
    await wait(still() ? 0 : 470)
  }
  private async moveTo(target: Point) {
    const distance = Math.hypot(target.x - this.at.x, target.y - this.at.y)
    const ms = still()
      ? 0
      : Math.round(Math.min(850, Math.max(260, distance * 0.85)))
    this.put(target, ms)
    await wait(ms + 30)
  }
  /** Glides to a point on the canvas. */
  async glide(p: Point) {
    this.show()
    await this.inView(p)
    await this.moveTo(this.screenOf(p))
    this.anchor = { world: p }
  }
  /** Glides to something floating over the canvas: a tool, a menu item. */
  async glideTo(element: Element) {
    this.show()
    const p = this.screenOfElement(element)
    await this.moveTo(p)
    this.anchor = { screen: p }
  }
  /** A press where it is, shown as a ring. */
  async press() {
    const node = this.element()
    if (!node) return
    node.classList.remove('is-pressing')
    void node.offsetWidth
    node.classList.add('is-pressing')
    await wait(still() ? 40 : 230)
    node.classList.remove('is-pressing')
  }
  /** Drags a wire from one point to another, as a handle is dragged. */
  async drag(from: Point, to: Point) {
    await this.glide(from)
    await this.press()
    await this.inView(to)
    const node = this.element()
    node?.classList.add('is-dragging')
    const steps = still() ? 1 : 24
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
      const p = {
        x: from.x + (to.x - from.x) * e,
        y: from.y + (to.y - from.y) * e
      }
      this.put(this.screenOf(p), 0)
      this.map.connecting = `<path class="map-flow is-linking is-ai" d="${bend(from, p)}"/>`
      repaintWires(this.map)
      await wait(24)
    }
    this.anchor = { world: to }
    await wait(140)
    node?.classList.remove('is-dragging')
    this.map.connecting = ''
    repaintWires(this.map)
  }
  /** Rings what it works on, in its own colour, until the next thing. */
  mark(key: string) {
    this.unmark()
    const node = this.map.els.get(key)
    if (!node) return
    node.dataset.ai = 'on'
    this.marked = node
  }
  unmark() {
    if (this.marked) delete this.marked.dataset.ai
    this.marked = null
  }
  /** What it is doing, beside its name. */
  doing(text: string | null) {
    const label = this.part('tag')?.querySelector('em')
    if (!label) return
    label.textContent = text || ''
    label.hidden = !text
  }
  /** Its words, in a bubble by the cursor; a final line fades after a while. */
  say(text: string, final: boolean) {
    const bubble = this.part('bubble')
    if (!bubble) return
    this.show()
    const line = text.trim()
    bubble.textContent = line.length > 240 ? `…${line.slice(-239)}` : line
    bubble.hidden = !line
    if (this.quiet) clearTimeout(this.quiet)
    this.quiet = final
      ? setTimeout(() => {
          bubble.hidden = true
        }, 6000)
      : null
  }
  /** Types a note as it is written; it goes once the work is done. */
  async type(text: string) {
    const note = this.part('typing')
    if (!note) return
    this.show()
    note.hidden = false
    const total = still() ? 0 : Math.min(1100, text.length * 16)
    const frames = Math.max(1, Math.round(total / 24))
    for (let i = 1; i <= frames; i++) {
      note.textContent = text.slice(0, Math.ceil((text.length * i) / frames))
      await wait(24)
    }
    note.textContent = text
  }
  typed() {
    const note = this.part('typing')
    if (note) note.hidden = true
  }
}
