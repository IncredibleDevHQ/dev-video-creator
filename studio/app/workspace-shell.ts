import { WorkspaceFocus } from './workspace-focus'
import { signOutWorkspace } from './workspace-login'
import { html } from '../shared/html'
import type {
  ResearchProjectSummary,
  ResearchProjectView
} from '../shared/research'
import type { ResearchViewState } from './research-view'
import { researchApi } from './research-api'
import { escape } from './ui'
import incredibleLogo from './assets/incredible-logo.svg'
import {
  outputWorkspaceItem,
  projectSearchItems,
  readWorkspaceState,
  rememberWorkspaceItem,
  researchWorkspaceItem,
  type WorkspaceItem
} from './workspace-state'
import './styles/workspace-shell.css'

const storageKey = 'incredible-workspace:v1'
/** Workspace owns global navigation and resource identity. ProjectShell owns
 * route transitions; the existing controllers continue to own document state. */
export class WorkspaceShell {
  readonly surface = document.createElement('div')
  private rail = document.createElement('nav')
  private dialog = document.createElement('dialog')
  private state = readWorkspaceState(this.read())
  private projects: ResearchProjectSummary[] = []
  private index = new Map<string, WorkspaceItem[]>()
  private focus: WorkspaceFocus
  private active: WorkspaceItem | null = null
  private mode: 'projects' | 'search' | 'recent' = 'projects'
  private generation = 0
  private loading = false
  private failure = ''
  constructor(
    root: HTMLElement,
    private navigate: (url: URL) => Promise<boolean>
  ) {
    root.classList.add('workspace-shell')
    this.focus = new WorkspaceFocus(root)
    this.surface.className = 'workspace-surface'
    this.rail.className = 'workspace-rail'
    this.rail.setAttribute('aria-label', 'Workspace')
    this.rail.innerHTML = html`<a
        class="workspace-logo"
        href="/"
        aria-label="Incredible workspace"
        ><img src="${incredibleLogo}" alt=""
      /></a>
      <a href="/" data-workspace-home
        ><span aria-hidden="true">⌂</span><small>Home</small></a
      >
      <button data-workspace-mode="projects">
        <span aria-hidden="true">▤</span><small>Projects</small>
      </button>
      <button
        data-workspace-mode="search"
        title="Search workspace (⌘K / Ctrl+K)"
      >
        <span aria-hidden="true">⌕</span><small>Search</small>
      </button>
      <button data-workspace-mode="recent">
        <span aria-hidden="true">◷</span><small>Recent</small>
      </button>
      <button
        class="workspace-account"
        data-workspace-signout
        title="Sign out of this workspace"
      >
        <span aria-hidden="true">↪</span><small>Sign out</small>
      </button>`
    this.dialog.className = 'workspace-picker'
    this.dialog.setAttribute('aria-labelledby', 'workspace-picker-title')
    root.replaceChildren(this.rail, this.surface, this.dialog)
    this.rail.addEventListener('click', (e) => {
      const button = (e.target as Element).closest<HTMLElement>(
        '[data-workspace-mode]'
      )
      if ((e.target as Element).closest('[data-workspace-signout]'))
        void this.navigate(new URL('/', location.href))
          .then((ok) => {
            if (ok) return signOutWorkspace()
          })
          .catch(() => {
            const button = this.rail.querySelector<HTMLElement>(
              '[data-workspace-signout]'
            )!
            button.title = 'Could not sign out. Check the server and try again.'
            button.querySelector('small')!.textContent = 'Try sign out'
          })
      if (button)
        void this.open(button.dataset.workspaceMode as typeof this.mode)
    })
    root.addEventListener('click', (e) => {
      const button = (e.target as Element).closest<HTMLElement>(
        '[data-workspace-projects]'
      )
      if (button) void this.open('projects')
    })
    document.addEventListener('keydown', (e) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === 'k' &&
        !e.altKey
      ) {
        if (document.querySelector('dialog[open]') && !this.dialog.open) return
        e.preventDefault()
        void this.open('search')
      }
    })
    this.dialog.addEventListener('click', (e) => {
      const target = e.target as Element
      if (target.closest('[data-workspace-close]')) this.dialog.close()
      const pin = target.closest<HTMLElement>('[data-workspace-pin]')
      if (pin) {
        const id = pin.dataset.workspacePin!
        this.state.pinned = this.state.pinned.includes(id)
          ? this.state.pinned.filter((p) => p !== id)
          : [...this.state.pinned, id]
        this.persist()
        this.results()
        this.dialog
          .querySelector<HTMLElement>(
            `[data-workspace-pin="${CSS.escape(id)}"]`
          )
          ?.focus()
      }
      if (target.closest('[data-workspace-retry]')) void this.open(this.mode)
      const link = target.closest<HTMLAnchorElement>('a[data-workspace-link]')
      if (link && !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) {
        e.preventDefault()
        void this.navigate(new URL(link.href))
          .then((ok) => {
            if (ok) this.dialog.close()
          })
          .catch((error) => {
            this.failure = String(error)
            this.results()
          })
      }
    })
    this.dialog.addEventListener('input', () => this.results())
    this.dialog.addEventListener('close', () => {
      this.generation++
      this.rail
        .querySelector<HTMLButtonElement>(
          `[data-workspace-mode="${this.mode}"]`
        )
        ?.focus()
    })
  }
  private read() {
    try {
      return localStorage.getItem(storageKey)
    } catch {
      return null
    }
  }
  private persist() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(this.state))
    } catch {
      /* Navigation still works when storage is unavailable. */
    }
  }
  research(state: ResearchViewState | null) {
    this.focus.update()
    if (!state) {
      this.active = null
      this.updateRail()
      this.continueHome()
      return
    }
    this.catalog(state.project)
    this.visit(researchWorkspaceItem(state))
  }
  output(project: ResearchProjectView) {
    requestAnimationFrame(() => this.focus.update())
    this.catalog(project)
    this.visit(outputWorkspaceItem(project, new URL(location.href)))
  }
  private catalog(project: ResearchProjectView) {
    this.index.set(project.id, projectSearchItems(project))
    const summary = {
      id: project.id,
      title: project.title,
      updatedAt: project.updatedAt,
      notebooks: project.notebooks.length,
      questions: project.nodes.length
    }
    this.projects = [
      summary,
      ...this.projects.filter((p) => p.id !== project.id)
    ]
  }
  private visit(item: WorkspaceItem) {
    if (
      this.active?.href === item.href &&
      this.active.title === item.title &&
      this.active.projectTitle === item.projectTitle
    )
      return
    this.active = item
    this.state = rememberWorkspaceItem(this.state, item)
    this.persist()
    this.updateRail()
  }
  private updateRail() {
    this.rail
      .querySelector('[data-workspace-home]')!
      .setAttribute('aria-current', this.active ? 'false' : 'page')
    this.rail
      .querySelector('[data-workspace-mode="projects"]')!
      .setAttribute('aria-current', this.active ? 'page' : 'false')
  }
  private continueHome() {
    const target = this.surface.querySelector('#workspace-continue')
    if (!target) return
    const recent = this.state.recent.filter(
      (item) =>
        item.kind !== 'Create' &&
        new URL(item.href, location.origin).searchParams.get('chat') !== 'new'
    )
    target.innerHTML = recent.length
      ? `<h2>Continue recent work</h2><p class="home-section-help">Reopen a chat, notebook or video you’ve visited.</p><div class="workspace-continue-grid">${recent
          .slice(0, 3)
          .map(
            (item) =>
              `<a data-workspace-link href="${escape(item.href)}"><span class="workspace-item-kind">${item.kind === 'Chat' ? 'Research chat' : item.kind === 'Notes' ? 'Notebook' : item.kind}</span><strong>${escape(item.title)}</strong><small>Project: ${escape(item.projectTitle)}</small><span class="home-resume-action">${item.kind === 'Chat' ? 'Continue chat' : 'Open'} →</span></a>`
          )
          .join('')}</div>`
      : ''
  }
  private itemLink(item: WorkspaceItem) {
    return html`<a data-workspace-link href="${escape(item.href)}"
      ><span class="workspace-item-kind">${item.kind}</span
      ><strong>${escape(item.title)}</strong
      ><small>${escape(item.projectTitle)}</small></a
    >`
  }
  private async open(mode: typeof this.mode) {
    this.mode = mode
    const revision = ++this.generation
    this.loading = true
    this.failure = ''
    this.dialog.innerHTML = html`<header>
        <div>
          <span>Your workspace</span>
          <h2 id="workspace-picker-title">
            ${mode === 'search'
              ? 'Search workspace'
              : mode === 'recent'
                ? 'Recent work'
                : 'Projects'}
          </h2>
        </div>
        <button data-workspace-close aria-label="Close workspace navigator">
          ×
        </button>
      </header>
      <label class="sr" for="workspace-query"
        >${mode === 'search'
          ? 'Search notes, chats and questions'
          : 'Find a project or recent item'}</label
      ><input
        id="workspace-query"
        type="search"
        placeholder="${mode === 'search'
          ? 'Search notes, chats and questions…'
          : 'Filter…'}"
        autocomplete="off"
      />
      <div class="workspace-picker-results"></div>
      <footer>Open work in this workspace. <kbd>Esc</kbd> to close.</footer>`
    if (!this.dialog.open) this.dialog.showModal()
    this.dialog.querySelector<HTMLInputElement>('input')!.focus()
    this.results()
    try {
      const projects = await researchApi.list()
      if (revision !== this.generation) return
      this.projects = projects
      const ids = new Set(projects.map((p) => p.id))
      this.state.recent = this.state.recent.filter((item) =>
        ids.has(item.projectId)
      )
      this.state.pinned = this.state.pinned.filter((id) => ids.has(id))
      for (const id of this.index.keys())
        if (!ids.has(id)) this.index.delete(id)
      this.persist()
      if (mode === 'search') {
        for (let i = 0; i < projects.length; i += 4) {
          const batch = await Promise.allSettled(
            projects.slice(i, i + 4).map((p) => researchApi.load(p.id))
          )
          if (revision !== this.generation) return
          batch.forEach((result) => {
            if (result.status === 'fulfilled') this.catalog(result.value)
            else
              this.failure = 'Some projects could not be searched. Try again.'
          })
          this.results()
        }
      }
    } catch {
      if (revision === this.generation)
        this.failure =
          'Could not load your workspace. Your current work is still open.'
    } finally {
      if (revision === this.generation) {
        this.loading = false
        this.results()
      }
    }
  }
  private results() {
    const target = this.dialog.querySelector('.workspace-picker-results')
    if (!target) return
    const query = this.dialog
      .querySelector<HTMLInputElement>('input')!
      .value.trim()
      .toLowerCase()
    const matching = (item: WorkspaceItem) =>
      `${item.title} ${item.projectTitle} ${item.search || ''}`
        .toLowerCase()
        .includes(query)
    const projects = this.projects
      .filter((p) => p.title.toLowerCase().includes(query))
      .sort(
        (a, b) =>
          Number(this.state.pinned.includes(b.id)) -
          Number(this.state.pinned.includes(a.id))
      )
    const projectRows = projects
      .map((p) => {
        const last = this.state.recent.find((item) => item.projectId === p.id)
        const pinned = this.state.pinned.includes(p.id)
        return html`<div class="workspace-project-row">
          <a
            data-workspace-link
            href="${escape(last?.href || `/?space=${p.id}`)}"
            ><strong>${escape(p.title)}</strong
            ><small
              >${p.notebooks}
              ${p.notebooks === 1 ? 'notebook' : 'notebooks'}${last
                ? ` · Continue ${escape(last.kind.toLowerCase())}`
                : ''}</small
            ></a
          ><button
            data-workspace-pin="${p.id}"
            aria-label="${pinned ? 'Unpin' : 'Pin'} ${escape(p.title)}"
            aria-pressed="${pinned}"
          >
            ${pinned ? '★' : '☆'}
          </button>
        </div>`
      })
      .join('')
    const items = (
      this.mode === 'recent' || !query
        ? this.state.recent
        : [...this.index.values()].flat()
    ).filter(matching)
    const itemRows = items
      .slice(0, 60)
      .map((item) => this.itemLink(item))
      .join('')
    target.innerHTML = `${this.mode === 'projects' ? projectRows : this.mode === 'recent' ? itemRows : `${query && projectRows ? `<h3>Projects</h3>${projectRows}` : ''}<h3>${query ? 'Notes, chats & questions' : 'Recently opened'}</h3>${itemRows}`}
      ${!(this.mode === 'projects' ? projectRows : itemRows || (this.mode === 'search' && projectRows)) ? `<p class="workspace-empty">${this.loading ? 'Loading your workspace…' : query ? 'No matches. Try another word.' : this.mode === 'projects' ? 'Your first note creates a project.' : 'Open a notebook or chat to find it here next time.'}</p>` : ''}
      ${this.loading ? '<p role="status">Loading…</p>' : ''}${this.failure ? `<p role="alert">${escape(this.failure)} <button data-workspace-retry>Try again</button></p>` : ''}`
  }
}
