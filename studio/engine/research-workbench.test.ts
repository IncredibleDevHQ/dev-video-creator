import { afterEach, expect, it, vi } from 'vitest'
import { parseHTML } from 'linkedom'
import { normalizeResearchLayout } from '../app/research-layout'
import { renderResearch } from '../app/research-render'
import { ResearchWorkbench } from '../app/research-workbench'
import { toggleProjectPanel } from '../app/research-navigation'
import type { ResearchViewState } from '../app/research-view'

afterEach(() => vi.unstubAllGlobals())

const markup = `<main class="research-columns">
  <div data-resize-pane="graph"></div>
  <textarea id="research-question"></textarea>
  <div data-resize-pane="notes"></div>
  <textarea id="research-note-input"></textarea>
</main>`

const setup = (viewport = 1400, width = 1100) => {
  const { document, window } = parseHTML(`<div id="root">${markup}</div>`)
  const root = document.getElementById('root')! as unknown as HTMLElement
  const stored = new Map<string, string>()
  const browserWindow = Object.assign(new EventTarget(), {
    innerWidth: viewport
  })
  vi.stubGlobal('window', browserWindow)
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value)
  })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  )
  const keys = {
    'research-question': 'chat:branch',
    'research-note-input': 'notebook'
  }
  const changed = vi.fn(() => {
    renderResearch(root, markup, keys, keys)
    columns()
  })
  const workbench = new ResearchWorkbench(root, changed)
  const columns = () => {
    const element = root.querySelector<HTMLElement>('.research-columns')!
    Object.defineProperty(element, 'clientWidth', {
      configurable: true,
      value: width
    })
    return element
  }
  const press = (pane: string, key: string) => {
    columns()
    const event = new window.Event('keydown', {
      bubbles: true,
      cancelable: true
    })
    Object.assign(event, { key })
    root.querySelector(`[data-resize-pane="${pane}"]`)!.dispatchEvent(event)
  }
  const resizeViewport = (viewportWidth: number, columnWidth: number) => {
    browserWindow.innerWidth = viewportWidth
    width = columnWidth
    columns()
    browserWindow.dispatchEvent(new Event('resize'))
  }
  workbench.open('project')
  return { workbench, root, columns, press, stored, changed, resizeViewport }
}

it('starts with a focused conversation and does not reopen a legacy graph', () => {
  expect(normalizeResearchLayout()).toMatchObject({
    graphOpen: false,
    notesOpen: false,
    expanded: false
  })
  expect(
    normalizeResearchLayout({ expanded: true, graphWidth: 410 })
  ).toMatchObject({ graphOpen: false, expanded: false, graphWidth: 410 })
})

it('opens either supporting pane on compact screens and resets graph expansion', () => {
  const { workbench } = setup(1000)
  workbench.handle('toggle-notebook')
  expect(workbench.state).toMatchObject({ notesOpen: true, graphOpen: false })
  workbench.handle('toggle-graph')
  expect(workbench.state).toMatchObject({ graphOpen: true, notesOpen: false })
  workbench.handle('graph-expand')
  expect(workbench.state.expanded).toBe(true)
  workbench.handle('toggle-notebook')
  expect(workbench.state).toMatchObject({
    graphOpen: false,
    notesOpen: true,
    expanded: false
  })
})

it.each([false, true])(
  'restores one support pane on a narrow viewport (expanded graph: %s)',
  (expanded) => {
    const { workbench, stored } = setup(1000)
    stored.set(
      'research-layout:restored',
      JSON.stringify({ graphOpen: true, notesOpen: true, expanded })
    )
    workbench.open('restored')
    expect(workbench.state).toMatchObject({
      graphOpen: expanded,
      notesOpen: !expanded,
      expanded
    })
  }
)

it('updates support pane state on viewport resize without replacing unsent drafts', () => {
  const { workbench, root, columns, resizeViewport, stored, changed } = setup()
  workbench.handle('toggle-graph')
  workbench.handle('toggle-notebook')
  const question =
    root.querySelector<HTMLTextAreaElement>('#research-question')!
  const note = root.querySelector<HTMLTextAreaElement>('#research-note-input')!
  question.value = 'Continue this research'
  note.value = 'An unfinished note'
  changed.mockClear()
  resizeViewport(1000, 850)
  expect(workbench.state).toMatchObject({ graphOpen: false, notesOpen: true })
  expect(changed).toHaveBeenCalledTimes(1)
  expect(columns().style.getPropertyValue('--research-graph-width')).toBe('0px')
  expect(columns().style.getPropertyValue('--research-notes-width')).toBe(
    '280px'
  )
  expect(root.querySelector('#research-question')).toBe(question)
  expect(root.querySelector('#research-note-input')).toBe(note)
  expect(question.value).toBe('Continue this research')
  expect(note.value).toBe('An unfinished note')
  expect(JSON.parse(stored.get('research-layout:project')!)).toMatchObject({
    graphOpen: false,
    notesOpen: true
  })
  resizeViewport(1400, 1100)
  expect(changed).toHaveBeenCalledTimes(1)
  expect(workbench.state.graphOpen).toBe(false)
})

it('persists independent desktop panes and leaves graph expansion explicitly', () => {
  const { workbench, stored } = setup()
  workbench.handle('toggle-graph')
  workbench.handle('toggle-notebook')
  expect(workbench.state).toMatchObject({ graphOpen: true, notesOpen: true })
  workbench.handle('graph-expand')
  workbench.handle('toggle-graph')
  expect(workbench.state).toMatchObject({ graphOpen: false, expanded: false })
  expect(JSON.parse(stored.get('research-layout:project')!)).toMatchObject({
    graphOpen: false,
    notesOpen: true,
    expanded: false
  })
})

it('keeps both unsent drafts when opening and closing supporting panes', () => {
  const { workbench, root, changed } = setup(1000)
  const question =
    root.querySelector<HTMLTextAreaElement>('#research-question')!
  const note = root.querySelector<HTMLTextAreaElement>('#research-note-input')!
  question.value = 'My next question'
  note.value = 'A note still being written'
  for (const action of ['toggle-graph', 'toggle-notebook', 'toggle-notebook'])
    workbench.handle(action)
  expect(changed).toHaveBeenCalledTimes(3)
  expect(root.querySelector('#research-question')).toBe(question)
  expect(root.querySelector('#research-note-input')).toBe(note)
  expect(question.value).toBe('My next question')
  expect(note.value).toBe('A note still being written')
})

it('ignores hidden panes and reserves conversation room when resizing by keyboard', () => {
  const { workbench, columns, press } = setup(1400, 1000)
  workbench.handle('toggle-notebook')
  press('notes', 'ArrowLeft')
  expect(workbench.state.notesWidth).toBe(304)
  expect(columns().style.getPropertyValue('--research-graph-width')).toBe('0px')
  workbench.handle('toggle-notebook')
  workbench.handle('toggle-graph')
  for (let i = 0; i < 20; i++) press('graph', 'ArrowRight')
  expect(workbench.state.graphWidth).toBe(515)
  expect(columns().style.getPropertyValue('--research-notes-width')).toBe('0px')
  expect(
    columns()
      .querySelector('[data-resize-pane="graph"]')!
      .getAttribute('aria-valuenow')
  ).toBe('515')
})

it('scales only visible supporting panes to preserve 480px for the conversation', () => {
  const { workbench, columns } = setup(1400, 1000)
  workbench.state = normalizeResearchLayout({
    graphOpen: true,
    notesOpen: true,
    graphWidth: 620,
    notesWidth: 440
  })
  const element = columns()
  workbench.mount()
  const graphWidth = parseFloat(
    element.style.getPropertyValue('--research-graph-width')
  )
  const notesWidth = parseFloat(
    element.style.getPropertyValue('--research-notes-width')
  )
  expect(1000 - graphWidth - notesWidth - 10).toBeCloseTo(480)
  workbench.state.expanded = true
  workbench.mount()
  expect(element.style.getPropertyValue('--research-notes-width')).toBe('0px')
})

it('returns from content and document focus to the requested pane without losing pane preferences', () => {
  const { workbench, changed } = setup(1000)
  const state = {
    contentOpen: false,
    documentExpanded: false
  } as ResearchViewState
  workbench.handle('toggle-notebook')
  toggleProjectPanel('open-content', state, workbench, changed)
  expect(state.contentOpen).toBe(true)
  toggleProjectPanel('close-content', state, workbench, changed)
  expect(state.contentOpen).toBe(false)
  expect(workbench.state.notesOpen).toBe(true)
  toggleProjectPanel('open-content', state, workbench, changed)
  toggleProjectPanel('open-notebook', state, workbench, changed)
  expect(state.contentOpen).toBe(false)
  expect(workbench.state.notesOpen).toBe(true)
  toggleProjectPanel('expand-document', state, workbench, changed)
  expect(state.documentExpanded).toBe(true)
  toggleProjectPanel('toggle-graph', state, workbench, changed)
  expect(state.documentExpanded).toBe(false)
  expect(workbench.state).toMatchObject({ graphOpen: true, notesOpen: false })
})
it('keeps the notebook tree collapsed across background rendering', () => {
  const { root } = setup()
  const tree =
    '<details id="project-notebooks" open><summary>Notebooks</summary></details>'
  renderResearch(root, tree, {}, {})
  root.querySelector('details')!.removeAttribute('open')
  renderResearch(root, tree, {}, {})
  expect(root.querySelector('details')!.hasAttribute('open')).toBe(false)
})
