import { html } from '../shared/html'
import type { ResearchNode } from '../shared/research'
import { researchPath } from '../shared/research'
import { escape } from './ui'

/** A stable branching layout: adding a sibling never changes node identity or
 * the history shown by a previous node. HTML buttons provide keyboard access. */
export const researchGraph = (
  nodes: ResearchNode[],
  selected: string | null,
  query = ''
) => {
  const path = new Set(researchPath(nodes, selected).map((n) => n.id))
  const placed = new Map<string, { x: number; y: number }>()
  let row = 0,
    maxDepth = 0
  const visit = (parent: string | null, depth: number) => {
    maxDepth = Math.max(maxDepth, depth)
    for (const node of nodes.filter((n) => n.parentId === parent)) {
      placed.set(node.id, { x: 18 + depth * 38, y: 18 + row++ * 80 })
      visit(node.id, depth + 1)
    }
  }
  visit(null, 0)
  const width = Math.max(260, 230 + maxDepth * 38),
    height = Math.max(260, row * 80 + 30)
  return html`<div
    class="research-graph-plane"
    style="width:${width}px;height:${height}px"
  >
    <svg aria-hidden="true" width="${width}" height="${height}">
      ${nodes
        .map((n) => {
          const a = placed.get(n.parentId || ''),
            b = placed.get(n.id)
          return a && b
            ? html`<path
                class="${path.has(n.id) ? 'in-path' : ''}"
                d="M${a.x + 9},${a.y + 56} V${b.y + 28} H${b.x}"
              />`
            : ''
        })
        .join('')}
    </svg>
    ${nodes
      .map((n) => {
        const p = placed.get(n.id)!
        const match =
          !query ||
          n.question.toLowerCase().includes(query.toLowerCase()) ||
          n.answer.toLowerCase().includes(query.toLowerCase())
        return html`<button
          type="button"
          data-research-node="${escape(n.id)}"
          class="research-node ${selected === n.id
            ? 'selected'
            : ''} ${path.has(n.id) ? 'in-path' : ''} ${match ? '' : 'dimmed'}"
          style="left:${p.x}px;top:${p.y}px"
          aria-current="${selected === n.id ? 'step' : 'false'}"
          title="${escape(n.question)}"
        >
          <span class="research-node-dot ${n.state}"></span
          ><span
            >${escape(n.question.slice(0, 70))}<small
              >${n.state === 'working'
                ? 'Researching…'
                : n.state === 'done'
                  ? 'Answered'
                  : n.state}</small
            ></span
          >
        </button>`
      })
      .join('')}
  </div>`
}
