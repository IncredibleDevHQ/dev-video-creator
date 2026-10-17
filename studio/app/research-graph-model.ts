import type { ResearchNode } from '../shared/research'

export type GraphPoint = {
  id: string
  x: number
  y: number
  radius: number
  group: number
}
export type GraphScope = 'all' | 'local'

/** Selection-independent coordinates keep the map still while navigating. The
 * parent links are real question lineage; proximity does not invent links. */
export const graphLayout = (nodes: ResearchNode[]) => {
  const ids = new Set(nodes.map((n) => n.id))
  const roots = nodes.filter((n) => !n.parentId || !ids.has(n.parentId))
  const points = new Map<string, GraphPoint>()
  let leaf = 0
  const visit = (node: ResearchNode, depth: number, group: number) => {
    if (points.has(node.id)) return
    const p = { id: node.id, x: depth * 150, y: leaf * 115, radius: 7, group }
    points.set(node.id, p)
    const children = nodes.filter(
      (n) => n.parentId === node.id && !points.has(n.id)
    )
    if (!children.length) leaf++
    for (const child of children) visit(child, depth + 1, group)
    const placed = children.map((n) => points.get(n.id)!).filter(Boolean)
    if (placed.length)
      p.y = placed.reduce((sum, p) => sum + p.y, 0) / placed.length
    p.radius = Math.min(14, 7 + children.length * 1.5)
  }
  roots.forEach((n, group) => {
    visit(n, 0, group)
    leaf++
  })
  nodes.forEach((n, index) => {
    if (!points.has(n.id)) visit(n, 0, roots.length + index)
  })
  const layout = [...points.values()]
  // A bounded, deterministic spring layout gives small research trees a natural
  // network shape. Large trees retain the inexpensive hierarchy coordinates.
  if (layout.length <= 180) {
    const links = nodes.filter((n) => points.has(n.parentId || ''))
    for (let iteration = 0; iteration < 100; iteration++) {
      const forces = layout.map(() => ({ x: 0, y: 0 }))
      const indexes = new Map(layout.map((p, i) => [p.id, i]))
      for (let i = 0; i < layout.length; i++) {
        for (let j = i + 1; j < layout.length; j++) {
          const a = layout[i],
            b = layout[j]
          const dx = a.x - b.x || 0.01,
            dy = a.y - b.y || 0.01
          const distance = Math.max(25, Math.hypot(dx, dy))
          const force = Math.min(6, 14000 / distance ** 2)
          forces[i].x += (dx / distance) * force
          forces[i].y += (dy / distance) * force
          forces[j].x -= (dx / distance) * force
          forces[j].y -= (dy / distance) * force
        }
      }
      for (const n of links) {
        const a = points.get(n.parentId!)!,
          b = points.get(n.id)!
        const dx = b.x - a.x,
          dy = b.y - a.y
        const distance = Math.max(1, Math.hypot(dx, dy))
        const force = (distance - 150) * 0.025
        const ai = indexes.get(a.id)!,
          bi = indexes.get(b.id)!
        forces[ai].x += (dx / distance) * force
        forces[ai].y += (dy / distance) * force
        forces[bi].x -= (dx / distance) * force
        forces[bi].y -= (dy / distance) * force
      }
      layout.forEach((p, i) => {
        p.x += forces[i].x
        p.y += forces[i].y
      })
    }
  }
  const minX = Math.min(0, ...layout.map((p) => p.x))
  const minY = Math.min(0, ...layout.map((p) => p.y))
  layout.forEach((p) => {
    p.x += 100 - minX
    p.y += 70 - minY
  })
  return {
    points: layout,
    width: Math.max(320, ...layout.map((p) => p.x + 130)),
    height: Math.max(280, ...layout.map((p) => p.y + 100))
  }
}

export const graphNeighborhood = (
  nodes: ResearchNode[],
  selected: string | null,
  depth: number
) => {
  const visible = new Set<string>()
  if (!selected) return new Set(nodes.map((n) => n.id))
  visible.add(selected)
  for (let i = 0; i < depth; i++) {
    const next = new Set(visible)
    for (const n of nodes) {
      if (n.parentId && visible.has(n.parentId)) next.add(n.id)
      if (n.parentId && visible.has(n.id)) next.add(n.parentId)
    }
    next.forEach((id) => visible.add(id))
  }
  return visible
}
