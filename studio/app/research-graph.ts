import { researchDocumentTitle } from '../shared/research-documents'
import { html } from '../shared/html'
import type { ResearchNode } from '../shared/research'
import { researchPath } from '../shared/research'
import {
  graphLayout,
  graphNeighborhood,
  type GraphScope
} from './research-graph-model'
import { escape } from './ui'

export const researchGraph = (
  nodes: ResearchNode[],
  selected: string | null,
  query = '',
  scope: GraphScope = 'all',
  depth = 2
) => {
  const path = new Set(researchPath(nodes, selected).map((n) => n.id))
  const visible =
    scope === 'local'
      ? graphNeighborhood(nodes, selected, depth)
      : new Set(nodes.map((n) => n.id))
  const layout = graphLayout(nodes)
  if (scope === 'local' && visible.size) {
    const subset = layout.points.filter((p) => visible.has(p.id))
    const minX = Math.min(...subset.map((p) => p.x))
    const minY = Math.min(...subset.map((p) => p.y))
    for (const point of layout.points) {
      point.x += 100 - minX
      point.y += 40 - minY
    }
    layout.width = Math.max(320, ...subset.map((p) => p.x + 110))
    layout.height = Math.max(180, ...subset.map((p) => p.y + 60))
  }
  const points = new Map(layout.points.map((p) => [p.id, p]))
  const matches = new Set(
    nodes
      .filter(
        (n) =>
          !query ||
          `${n.question} ${n.answer}`
            .toLowerCase()
            .includes(query.toLowerCase())
      )
      .map((n) => n.id)
  )
  const count = nodes.filter(
    (n) => visible.has(n.id) && matches.has(n.id)
  ).length
  return html`<div
      class="research-graph-plane"
      style="width:${layout.width}px;height:${layout.height}px"
      data-graph-local="${scope === 'local' ? `${selected}:${depth}` : 'all'}"
      data-graph-width="${layout.width}"
      data-graph-height="${layout.height}"
    >
      <svg aria-hidden="true" width="${layout.width}" height="${layout.height}">
        ${nodes
          .map((n) => {
            const a = points.get(n.parentId || ''),
              b = points.get(n.id)
            if (!a || !b || !visible.has(n.id) || !visible.has(n.parentId!))
              return ''
            const angle = Math.atan2(b.y - a.y, b.x - a.x)
            const x = b.x - Math.cos(angle) * (b.radius + 6),
              y = b.y - Math.sin(angle) * (b.radius + 6)
            return html`<g
              data-graph-edge="${n.id}"
              data-graph-from="${n.parentId}"
              data-graph-to="${n.id}"
              class="${path.has(n.id) ? 'in-path' : ''}"
            >
              <path d="M${a.x},${a.y} L${b.x},${b.y}" />
              <path
                class="research-edge-arrow"
                d="M${x - Math.cos(angle - 0.5) * 6},${y -
                Math.sin(angle - 0.5) * 6} L${x},${y} L${x -
                Math.cos(angle + 0.5) * 6},${y - Math.sin(angle + 0.5) * 6}"
              />
            </g>`
          })
          .join('')}
      </svg>
      ${nodes
        .filter((n) => visible.has(n.id))
        .map((n) => {
          const p = points.get(n.id)!
          const label = researchDocumentTitle(n)
          const status =
            n.state === 'done'
              ? 'Answered'
              : n.state === 'working'
                ? 'Researching'
                : n.state === 'stopped'
                  ? 'Stopped'
                  : 'Needs attention'
          return html`<button
            type="button"
            data-research-node="${escape(n.id)}"
            data-graph-node="${escape(n.id)}"
            class="research-node ${selected === n.id
              ? 'selected'
              : ''} ${path.has(n.id) ? 'in-path' : ''} ${matches.has(n.id)
              ? ''
              : 'dimmed'} ${n.state}"
            style="left:${p.x}px;top:${p.y}px;--node-radius:${p.radius}px;--graph-group:${p.group %
            5}"
            aria-current="${selected === n.id ? 'step' : 'false'}"
            aria-label="${escape(n.question)} — ${status}"
            title="${escape(n.question)} · ${status}"
          >
            <span class="research-node-orb" aria-hidden="true"></span
            ><span class="research-node-label"
              >${escape(
                label.length > 64 ? label.slice(0, 61) + '…' : label
              )}</span
            >
          </button>`
        })
        .join('')}
    </div>
    <span class="research-graph-results" role="status"
      >${query
        ? `${count} matching question${count === 1 ? '' : 's'}`
        : `${visible.size} question${visible.size === 1 ? '' : 's'} · parent → follow-up`}</span
    >`
}
