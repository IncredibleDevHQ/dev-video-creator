// The switch between a project's notebooks (the four-notebook model): one
// tab per kind, in the order the kinds are made from one another. A tab
// shows where its notebook stands; a notebook not made yet says what it is
// made from, and where that is. A new kind of notebook is a new entry in
// NOTEBOOK_FORMATS and an icon here.
import { NOTEBOOK_FORMATS, formatOf, type NotebookKind, type NotebookSummary } from 'markdown-composition'

export type SwitchTab = {
  kind: NotebookKind
  label: string
  // The notebook this tab opens: the one open now, else the newest of its
  // kind; none when it is not made yet.
  notebook: NotebookSummary | null
  current: boolean
  // What it is made from, and that notebook if it is made.
  madeFrom: { kind: NotebookKind; label: string; notebook: NotebookSummary | null } | null
  // Its state in a few words, under its label.
  status: string
  // What choosing it does, said in its tooltip.
  title: string
}

const newestOf = (notebooks: NotebookSummary[], kind: NotebookKind, currentId: string) =>
  notebooks.find(entry => entry.kind === kind && entry.id === currentId) ||
  [...notebooks].filter(entry => entry.kind === kind).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))[0] ||
  null

export const switchTabsOf = (notebooks: NotebookSummary[], currentId: string): SwitchTab[] =>
  NOTEBOOK_FORMATS.map(format => {
    const notebook = newestOf(notebooks, format.kind, currentId)
    const upstream = format.madeFrom ? formatOf(format.madeFrom) : null
    const madeFrom = upstream ? { kind: upstream.kind, label: upstream.label, notebook: newestOf(notebooks, upstream.kind, currentId) } : null
    const current = Boolean(notebook && notebook.id === currentId)
    const status = notebook ? (notebook.state === 'empty' ? 'empty' : notebook.detail) : 'not made yet'
    const title = notebook
      ? `${current ? 'This notebook' : `Open the ${format.label.toLowerCase()}`}: ${format.holds} · ${notebook.detail}`
      : madeFrom
        ? `Not made yet. It is made from the ${madeFrom.label.toLowerCase()}${madeFrom.notebook ? ` — open it to make ${format.label === 'Video' ? 'the video' : `the ${format.label.toLowerCase()}`}` : ', which is not made yet either'}.`
        : 'Not made yet.'
    return { kind: format.kind, label: format.label, notebook, current, madeFrom, status, title }
  })

// Each kind's icon, as an SVG path set in a 24-unit box.
const ICONS: Record<NotebookKind, string> = {
  text: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8M8 17h5"/>',
  wireframe: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M10 10v10"/>',
  presentation: '<rect x="3" y="3" width="18" height="12" rx="2"/><path d="M12 15v4M8 21h8"/><path d="m7 11 3-3 2 2 5-4"/>',
  video: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>',
}

export const renderNotebookSwitch = (host: HTMLElement, tabs: SwitchTab[], choose: (tab: SwitchTab) => void) => {
  host.replaceChildren(
    ...tabs.map(tab => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = `notebook-switch-tab is-${tab.notebook ? tab.notebook.state : 'missing'}`
      button.dataset.kind = tab.kind
      button.title = tab.title
      if (tab.current) button.setAttribute('aria-current', 'page')
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      icon.setAttribute('viewBox', '0 0 24 24')
      icon.setAttribute('aria-hidden', 'true')
      icon.innerHTML = ICONS[tab.kind]
      const copy = document.createElement('span')
      copy.className = 'notebook-switch-copy'
      const label = document.createElement('strong')
      label.textContent = tab.label
      const status = document.createElement('small')
      status.textContent = tab.status
      copy.append(label, status)
      button.append(icon, copy)
      button.addEventListener('click', () => choose(tab))
      return button
    }),
  )
}

// A project's notebooks as small chips, for the library and the menu: each
// kind's icon and name, its state in its tooltip; a chip opens its
// notebook, and a kind not made yet is shown dimmed.
export const renderProjectKinds = (host: HTMLElement, tabs: SwitchTab[], choose: (tab: SwitchTab) => void) => {
  host.replaceChildren(
    ...tabs.map(tab => {
      const chip = document.createElement('button')
      chip.type = 'button'
      chip.className = `project-kind is-${tab.notebook ? tab.notebook.state : 'missing'}`
      chip.dataset.kind = tab.kind
      chip.disabled = !tab.notebook
      chip.title = tab.notebook ? `${tab.label} · ${tab.status}` : `${tab.label} · not made yet`
      if (tab.current) chip.setAttribute('aria-current', 'page')
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      icon.setAttribute('viewBox', '0 0 24 24')
      icon.setAttribute('aria-hidden', 'true')
      icon.innerHTML = ICONS[tab.kind]
      const label = document.createElement('span')
      label.textContent = tab.label
      chip.append(icon, label)
      chip.addEventListener('click', event => {
        event.stopPropagation()
        choose(tab)
      })
      return chip
    }),
  )
}
