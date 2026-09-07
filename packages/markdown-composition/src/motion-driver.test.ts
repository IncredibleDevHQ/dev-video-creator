import { describe, expect, it } from 'vitest'
import { instantiateMotionDriver } from './motion-driver'
import { sanitizeMotionPlan } from './motion-plan'

// A tiny SVG stand-in: enough surface for the driver (querySelector by id,
// getBBox, getTotalLength, style, viewBox attribute) without a DOM.
type FakeNode = {
  id: string
  tagName: string
  style: Record<string, string>
  textContent: string
  children: FakeNode[]
  attrs: Record<string, string>
  fill: string
  length: number
  bbox: { x: number; y: number; width: number; height: number }
  querySelectorAll: (selector: string) => FakeNode[]
  querySelector: (selector: string) => FakeNode | null
  getBBox: () => { x: number; y: number; width: number; height: number }
  getTotalLength?: () => number
  getAttribute: (name: string) => string | null
  setAttribute: (name: string, value: string) => void
  appendChild: (node: FakeNode) => void
  contains: (node: FakeNode) => boolean
  ownerDocument: unknown
}

const makeNode = (id: string, tagName: string, extra: Partial<FakeNode> = {}): FakeNode => {
  const node: FakeNode = {
    id,
    tagName,
    style: {},
    textContent: '',
    children: [],
    attrs: {},
    fill: 'black',
    length: 0,
    bbox: { x: 0, y: 0, width: 10, height: 10 },
    querySelectorAll: () => all(node).filter(n => n !== node && n.tagName !== 'g'),
    querySelector: selector => {
      if (selector === 'text') return all(node).find(n => n !== node && n.tagName === 'text') || null
      const wanted = selector.replace(/^#/, '').replace(/\\/g, '')
      return all(node).find(n => n !== node && n.id === wanted) || null
    },
    getBBox: () => node.bbox,
    getAttribute: name => node.attrs[name] ?? null,
    setAttribute: (name, value) => { node.attrs[name] = value },
    appendChild: child => { node.children.push(child) },
    contains: other => all(node).includes(other),
    ownerDocument: null,
    ...extra,
  }
  return node
}
const all = (node: FakeNode): FakeNode[] => [node, ...node.children.flatMap(all)]

const fakeDocument = {
  defaultView: {
    CSS: { escape: (s: string) => s },
    getComputedStyle: (node: FakeNode) => ({ fill: node.fill }),
  },
  createElementNS: (_ns: string, tag: string) => {
    const node = makeNode('', tag, { fill: 'none', length: 100 })
    node.getTotalLength = () => 100
    return node
  },
}

const buildRoot = () => {
  const root = makeNode('', 'svg', { attrs: { viewBox: '0 0 1280 720' } })
  root.ownerDocument = fakeDocument
  const box = makeNode('box', 'rect', { bbox: { x: 100, y: 100, width: 200, height: 100 } })
  const label = makeNode('label', 'text', { textContent: 'Latency 128 ms', bbox: { x: 110, y: 120, width: 100, height: 20 } })
  const arrow = makeNode('arrow', 'path', { fill: 'none', length: 300, bbox: { x: 300, y: 150, width: 300, height: 4 } })
  arrow.getTotalLength = () => 300
  const other = makeNode('other', 'rect', { bbox: { x: 700, y: 100, width: 200, height: 100 } })
  root.children.push(box, label, arrow, other)
  return { root, box, label, arrow, other }
}

const plan = sanitizeMotionPlan({
  steps: [
    { title: 'in', explanation: 'x', actions: [{ op: 'reveal', targets: ['box', 'label'], durationMs: 400, value: { staggerMs: 100 } }], motionWindowMs: 500, holdMs: 500 },
    { title: 'arrow', explanation: 'y', actions: [{ op: 'trace', targets: ['arrow'], durationMs: 400 }, { op: 'camera', targets: [], durationMs: 400, value: { x: 100, y: 100, width: 500, height: 100 } }], motionWindowMs: 400, holdMs: 600 },
    { title: 'focus', explanation: 'z', actions: [{ op: 'dim', targets: ['box', 'label'], durationMs: 200, value: { to: 0.3 } }, { op: 'count', targets: ['label'], durationMs: 400, value: { from: 0, to: 128 } }, { op: 'emphasize', targets: ['arrow'], durationMs: 400, persistence: 'flourish' }], motionWindowMs: 600, holdMs: 400 },
    { title: 'out', explanation: 'w', actions: [{ op: 'undim', targets: ['box', 'label'], durationMs: 200 }, { op: 'exit', targets: ['arrow'], durationMs: 300 }, { op: 'connect', targets: [], ports: { from: 'box', to: 'other' }, durationMs: 300 }, { op: 'camera', targets: [], durationMs: 300 }], motionWindowMs: 600, holdMs: 400 },
  ],
})!

describe('motion driver state fold', () => {
  it('hides entering targets at rest and leaves everything else alone', () => {
    const { root, box, other, arrow } = buildRoot()
    const driver = instantiateMotionDriver(root as unknown as SVGSVGElement, plan)
    driver.draw(0)
    expect(box.style.opacity).toBe('0')
    expect(arrow.style.opacity).toBe('0')
    expect(other.style.opacity).toBeUndefined()
    expect(driver.offsets).toEqual([0, 1000, 2000, 3000])
    expect(driver.durationMs).toBe(4000)
  })

  it('staggers a reveal and settles it by the end of the window', () => {
    const { root, box, label } = buildRoot()
    const driver = instantiateMotionDriver(root as unknown as SVGSVGElement, plan)
    driver.draw(150)
    expect(Number(box.style.opacity)).toBeGreaterThan(0.2)
    expect(Number(label.style.opacity)).toBeLessThan(Number(box.style.opacity))
    driver.setStep(0, 1)
    expect(box.style.opacity).toBe('1')
    expect(label.style.opacity).toBe('1')
    expect(box.style.transform).toBe('')
  })

  it('draws a trace with dash offset and moves the camera as state', () => {
    const { root, arrow } = buildRoot()
    const driver = instantiateMotionDriver(root as unknown as SVGSVGElement, plan)
    driver.draw(1000 + 200)
    const offset = Number(arrow.style.strokeDashoffset)
    expect(offset).toBeGreaterThan(0)
    expect(offset).toBeLessThan(300)
    driver.draw(1000 + 400)
    expect(arrow.style.strokeDashoffset).toBe('0')
    const viewBox = root.attrs.viewBox.split(' ').map(Number)
    expect(viewBox[2]).toBeLessThan(1280)
    expect(viewBox[2]).toBeGreaterThanOrEqual(1280 / 3)
    // Camera persists into the next beat until the reset.
    driver.draw(2500)
    expect(root.attrs.viewBox.split(' ').map(Number)[2]).toBeLessThan(1280)
    driver.draw(3999)
    expect(root.attrs.viewBox).toBe('0.00 0.00 1280.00 720.00')
  })

  it('dims as state, counts the number, and a flourish returns to rest', () => {
    const { root, box, label, arrow } = buildRoot()
    const driver = instantiateMotionDriver(root as unknown as SVGSVGElement, plan)
    driver.draw(2000 + 200)
    expect(Number(box.style.opacity)).toBeCloseTo(0.3, 1)
    expect(label.textContent).toMatch(/^Latency \d+ ms$/)
    expect(Number(/\d+/.exec(label.textContent)![0])).toBeLessThan(128)
    driver.draw(2000 + 200)
    expect(arrow.style.filter).toContain('drop-shadow')
    driver.draw(2000 + 600)
    expect(label.textContent).toBe('Latency 128 ms')
    expect(arrow.style.filter).toBe('')
    expect(Number(box.style.opacity)).toBeCloseTo(0.3, 1)
  })

  it('undims, exits and synthesizes a connector between two units', () => {
    const { root, box, arrow } = buildRoot()
    const driver = instantiateMotionDriver(root as unknown as SVGSVGElement, plan)
    driver.draw(3000 + 600)
    expect(box.style.opacity).toBe('1')
    expect(arrow.style.opacity).toBe('0')
    const synth = root.children.find(node => node.attrs['data-motion-synth'])
    expect(synth).toBeDefined()
    expect(synth!.attrs.d).toMatch(/^M 300 150 L 700 150$/)
    expect(synth!.style.strokeDashoffset).toBe('0')
    // Seeking backwards is exact: the connector is gone again before its beat.
    driver.draw(1500)
    expect(synth!.style.opacity).toBe('0')
  })
})
