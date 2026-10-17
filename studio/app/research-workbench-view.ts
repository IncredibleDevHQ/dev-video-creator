import { html } from '../shared/html'
import type { ResearchNode } from '../shared/research'
import { researchPath } from '../shared/research'
import { escape } from './ui'
import { researchGraph } from './research-graph'
import { defaultResearchLayout, type ResearchLayout } from './research-layout'
const control = (action: string, text: string, attrs = '') =>
  html`<button type="button" data-research-action="${action}" ${attrs}>
    ${text}
  </button>`
export const workbenchToolbar = (layout = defaultResearchLayout()) =>
  html`<div class="research-workbench-toolbar">
    <span>RESEARCH WORKSPACE <small>Explore · ask · keep</small></span>
    <div>
      ${control(
        'graph-expand',
        layout.expanded ? '↙ Restore workspace' : '↗ Expand graph',
        `aria-pressed="${layout.expanded}"`
      )}${control(
        'toggle-notebook',
        '▤ Notebook',
        `aria-pressed="${layout.notesOpen && !layout.expanded}"`
      )}
    </div>
  </div>`
export const graphPanel = (
  nodes: ResearchNode[],
  selected: string | null,
  query: string,
  layout: ResearchLayout = defaultResearchLayout()
) =>
  html`<aside class="research-graph-panel" aria-label="Question graph">
    <div class="research-panel-heading">
      <div>
        <span class="research-eyebrow">YOUR RESEARCH</span>
        <h2>Follow a thought.</h2>
      </div>
      <span class="research-count">${nodes.length}</span>
    </div>
    <label class="sr" for="research-search">Find a question</label
    ><input
      id="research-search"
      type="search"
      placeholder="Find a question…"
      value="${escape(query)}"
    />
    <div class="research-graph-scope" aria-label="Graph scope">
      ${control(
        'graph-all',
        'All questions',
        `aria-pressed="${layout.scope === 'all'}"`
      )}${control(
        'graph-local',
        'Around this question',
        `aria-pressed="${layout.scope === 'local'}"`
      )}
    </div>
    ${layout.scope === 'local'
      ? html`<label class="research-graph-depth"
          >Connection depth<select
            id="research-graph-depth"
            aria-label="Connection depth"
          >
            ${[1, 2, 3]
              .map(
                (n) =>
                  html`<option
                    value="${n}"
                    ${layout.depth === n ? 'selected' : ''}
                  >
                    ${n} ${n === 1 ? 'step' : 'steps'}
                  </option>`
              )
              .join('')}
          </select></label
        >`
      : ''}
    <div
      class="research-graph-scroll"
      tabindex="0"
      role="group"
      aria-label="Question graph canvas. Drag to pan, scroll to zoom; arrow keys move, plus and minus zoom, zero fits."
    >
      ${nodes.length
        ? researchGraph(nodes, selected, query, layout.scope, layout.depth)
        : '<p class="research-graph-empty">Your first question starts the graph.<br>Follow-ups branch from the answer you select.</p>'}
    </div>
    <div class="research-graph-controls">
      <span data-graph-zoom>100%</span>${control(
        'graph-out',
        '−',
        'aria-label="Zoom graph out"'
      )}${control(
        'graph-reset',
        'Fit',
        'aria-label="Fit question graph"'
      )}${control('graph-in', '+', 'aria-label="Zoom graph in"')}
    </div>
    <small class="research-graph-footer"
      >Drag to explore · scroll to zoom<br />Choose a question to return and
      branch.</small
    >
  </aside>`
export const paneDivider = (pane: 'graph' | 'notes') =>
  html`<div
    class="research-pane-divider ${pane === 'notes' ? 'notes-divider' : ''}"
    data-resize-pane="${pane}"
    role="separator"
    tabindex="0"
    aria-label="Resize ${pane === 'graph' ? 'graph' : 'notebook'} pane"
    aria-orientation="vertical"
    aria-valuemin="230"
    aria-valuemax="${pane === 'graph' ? 620 : 440}"
    aria-valuenow="280"
  ></div>`
export const ancestryTrail = (
  nodes: ResearchNode[],
  selected: string | null
) => {
  const path = researchPath(nodes, selected)
  return path.length
    ? html`<nav class="research-ancestry" aria-label="Question ancestry">
        <span>PATH</span>${path
          .map(
            (node, index) =>
              html`${index ? '<span aria-hidden="true">›</span>' : ''}<button
                  data-research-node="${escape(node.id)}"
                  type="button"
                  aria-current="${node.id === selected ? 'step' : 'false'}"
                  title="${escape(node.question)}"
                >
                  ${index === 0 ? 'Starting question' : `Follow-up ${index}`}
                </button>`
          )
          .join('')}
      </nav>`
    : ''
}
