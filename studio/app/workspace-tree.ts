import { chooseRepositoryProject } from './repository-project'
import type {
  ResearchProjectSummary,
  ResearchProjectView
} from '../shared/research'
import { recentResearchChats } from '../shared/research-chats'
import type { WorkspaceItem } from './workspace-state'
import { researchApi } from './research-api'
import { researchNameDialog } from './research-dialog'
import { closePopover, openPopover } from './popover'
import { projectContext, projectLink } from './project-links'
import { pickerIcons } from './destination-picker'
import { escape } from './ui'
import './styles/workspace-tree.css'
import { channelRows, readChannelNavigation } from './channel-navigation'
import { channelWork } from './channel-work'

const storageKey = 'incredible-project-tree:v1'
const channelStorageKey = 'incredible-channel-navigation:v1'
/** Project folders persist while the main area switches between chats and work. */
export class WorkspaceTree {
  readonly element = document.createElement('aside')
  private projects: ResearchProjectSummary[] = []
  private loaded = new Map<string, ResearchProjectView>()
  private pending = new Map<string, symbol>()
  private errors = new Set<string>()
  private expanded = new Set<string>()
  private showAll = new Set<string>()
  private notebooks = new Set<string>()
  private active: WorkspaceItem | null = null
  private initialized = false
  private loading = true
  private error = ''
  private busy = false
  private channelNavigation = readChannelNavigation(null)
  private channelQuery = ''
  private allChannels = false
  constructor(
    private root: HTMLElement,
    private navigate: (url: URL) => Promise<boolean>
  ) {
    this.element.className = 'workspace-tree'
    this.element.id = 'workspace-project-tree'
    this.element.setAttribute('aria-label', 'Channels navigation')
    try {
      this.channelNavigation = readChannelNavigation(
        localStorage.getItem(channelStorageKey)
      )
      const saved: unknown = JSON.parse(
        localStorage.getItem(storageKey) || 'null'
      )
      if (Array.isArray(saved)) {
        this.expanded = new Set(
          saved.filter((id): id is string => typeof id === 'string')
        )
        this.initialized = true
      }
    } catch {
      /* Expansion is optional local state. */
    }
    this.element.addEventListener('input', (event) => {
      const input = event.target as HTMLInputElement
      if (!input.matches('[data-channel-search]')) return
      this.channelQuery = input.value
      this.draw()
    })
    this.element.addEventListener('keydown', (event) => {
      if (
        (event.target as Element).matches('[data-channel-search]') &&
        event.key === 'Escape'
      ) {
        this.channelQuery = ''
        this.draw()
      }
    })
    this.element.addEventListener(
      'click',
      (event) =>
        void this.click(event).catch((error) => {
          this.error =
            error instanceof Error
              ? error.message
              : 'Could not open this work. Try again.'
          this.draw()
        })
    )
    this.draw()
    void this.refresh()
  }
  setActive(item: WorkspaceItem | null) {
    if (item?.kind === 'Chat') {
      const node = new URL(item.href, location.href).searchParams.get('node')
      if (node) {
        delete this.channelNavigation.positions[item.key]
        this.channelNavigation.positions[item.key] = node
        this.channelNavigation.positions = Object.fromEntries(
          Object.entries(this.channelNavigation.positions).slice(-200)
        )
        this.persistChannels()
      }
    }
    if (item && item.projectId !== this.active?.projectId) {
      this.expanded.add(item.projectId)
      this.persist()
    }
    if (item?.kind === 'Notes' && item.key !== this.active?.key)
      this.notebooks.add(item.projectId)
    this.active = item
    this.draw()
  }
  update(project: ResearchProjectView) {
    this.pending.delete(project.id)
    this.loaded.set(project.id, project)
    this.errors.delete(project.id)
    const summary = {
      id: project.id,
      title: project.title,
      updatedAt: project.updatedAt,
      notebooks: project.notebooks.length,
      questions: project.nodes.length,
      repository: project.repository
    }
    const index = this.projects.findIndex((item) => item.id === project.id)
    if (index < 0) this.projects.unshift(summary)
    else this.projects[index] = summary
    this.draw()
  }
  private persist() {
    try {
      localStorage.setItem(storageKey, JSON.stringify([...this.expanded]))
    } catch {
      /* Keep in memory. */
    }
  }
  private persistChannels() {
    try {
      localStorage.setItem(
        channelStorageKey,
        JSON.stringify(this.channelNavigation)
      )
    } catch {
      /* Keep navigation usable in memory. */
    }
  }
  private async refresh() {
    this.loading = true
    this.error = ''
    this.draw()
    const known = new Set(this.projects.map((project) => project.id))
    try {
      const projects = await researchApi.list()
      const created = this.projects.filter(
        (project) =>
          !known.has(project.id) &&
          !projects.some((item) => item.id === project.id)
      )
      // A project opened while the list was loading may be newer than the list.
      this.projects = [
        ...created,
        ...projects.map((summary) => {
          const cached = this.projects.find((item) => item.id === summary.id)
          return cached && cached.updatedAt > summary.updatedAt
            ? cached
            : summary
        })
      ]
      if (!this.initialized) {
        this.projects
          .slice(0, 3)
          .forEach((project) => this.expanded.add(project.id))
        this.initialized = true
      }
      for (const project of this.projects) {
        void this.load(project.id)
      }
    } catch {
      this.error = 'Could not load projects. Try again.'
    } finally {
      this.loading = false
      this.draw()
    }
  }
  private async load(id: string) {
    if (this.loaded.has(id) || this.pending.has(id)) return
    const token = Symbol()
    this.pending.set(id, token)
    this.errors.delete(id)
    this.draw()
    try {
      const project = await researchApi.load(id)
      if (this.pending.get(id) !== token) return
      this.update(project)
    } catch {
      if (this.pending.get(id) === token) this.errors.add(id)
    } finally {
      if (this.pending.get(id) === token) this.pending.delete(id)
      this.draw()
    }
  }
  private link(
    href: string,
    title: string,
    key: string,
    icon = '',
    working = false
  ) {
    return `<a href="${escape(href)}" data-tree-link data-tree-key="${escape(key)}" title="${escape(title)}" aria-current="${this.active?.key === key ? 'page' : 'false'}">${icon}<span>${escape(title)}</span>${working ? '<i class="workspace-tree-working" role="status" aria-label="Answer in progress"></i>' : ''}</a>`
  }
  private projectRows(project: ResearchProjectSummary) {
    const id = escape(project.id)
    const open = this.expanded.has(project.id)
    const loaded = this.loaded.get(project.id)
    const chats = recentResearchChats(loaded?.chats)
    const activeChat = chats.find(
      (chat) => this.active?.key === `${project.id}:Chat:${chat.id}`
    )
    const visible = this.showAll.has(project.id) ? chats : chats.slice(0, 5)
    if (activeChat && !visible.includes(activeChat)) visible.push(activeChat)
    const context = {
      notebook: loaded?.notebooks[0]?.id,
      ...(this.active?.projectId === project.id
        ? projectContext(new URL(this.active.href, location.href))
        : {})
    }
    return `<section class="workspace-tree-project">
      <div class="workspace-tree-project-heading">
        <button type="button" data-tree-toggle="${id}" data-tree-key="folder:${id}" aria-expanded="${open}" aria-controls="tree-children-${id}" title="${escape(project.repository?.path || project.title)}"><span class="workspace-tree-chevron" aria-hidden="true">${open ? '⌄' : '›'}</span>${pickerIcons.project}<span>${escape(project.title)}</span></button>
        <button type="button" data-tree-new-chat="${id}" aria-label="New chat in ${escape(project.title)}" title="New chat in ${escape(project.title)}">${pickerIcons.plus}</button><button type="button" class="workspace-tree-project-menu" data-tree-menu="${id}" aria-label="Actions for ${escape(project.title)}" title="Project actions">···</button>
      </div>
      <div class="workspace-tree-children" id="tree-children-${id}" ${open ? '' : 'hidden'}>
        ${
          !loaded
            ? this.errors.has(project.id)
              ? `<button type="button" data-tree-retry="${id}">Could not load chats · Retry</button>`
              : '<p role="status">Loading chats…</p>'
            : `${visible
                .map((chat) =>
                  this.link(
                    projectLink(
                      project.id,
                      {
                        chat: chat.id,
                        notebook: chat.notebookId,
                        node: chat.lastNodeId
                      },
                      { projectView: 'research' }
                    ),
                    chat.title,
                    `${project.id}:Chat:${chat.id}`,
                    '',
                    loaded.nodes.some(
                      (node) =>
                        node.chatId === chat.id && node.state === 'working'
                    )
                  )
                )
                .join('')}
        ${!chats.length ? `<a data-tree-link href="${escape(projectLink(project.id, { ...context, chat: 'new' }, { projectView: 'research' }))}" class="workspace-tree-empty">Start your first chat</a>` : ''}
        ${chats.length > 5 ? `<button type="button" class="workspace-tree-more" data-tree-more="${id}" aria-expanded="${this.showAll.has(project.id)}">${this.showAll.has(project.id) ? 'Show fewer chats' : `Show all ${chats.length} chats`}</button>` : ''}
        <div class="workspace-tree-resources">
          <button type="button" data-tree-notebooks="${id}" aria-expanded="${this.notebooks.has(project.id)}">${pickerIcons.notebook}<span>Notebooks</span><small>${loaded.notebooks.length}</small></button>
          ${this.notebooks.has(project.id) ? loaded.notebooks.map((book) => this.link(projectLink(project.id, { ...context, notebook: book.id }, { projectView: 'notes' }), book.title, `${project.id}:Notes:${book.id}`)).join('') : ''}
          ${this.notebooks.has(project.id) ? `<button type="button" data-tree-new-notebook="${id}">${pickerIcons.plus}<span>New notebook</span></button>` : ''}
          ${this.link(projectLink(project.id, context, { projectView: 'canvas' }), 'Create content', `${project.id}:Create:create`, pickerIcons.model)}
        </div>`
        }
      </div>
    </section>`
  }
  private channelRows() {
    const rows = channelRows(
      [...this.loaded.values()],
      this.channelNavigation,
      this.channelQuery
    )
    const render = (row: (typeof rows)[number]) =>
      `<div class="channel-nav-row">${this.link(row.href, row.title, row.key, '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M21 11a9 9 0 0 1-9 9H4l-2 2V11a9 9 0 0 1 19 0Z"/></svg>', row.working)}<button type="button" data-channel-menu="${escape(row.key)}" data-tree-key="menu:${escape(row.key)}" aria-label="Options for ${escape(row.title)}" title="Channel options">···</button></div>`
    if (this.channelQuery.trim())
      return `<div class="workspace-tree-section"><span>${rows.length} ${rows.length === 1 ? 'result' : 'results'}</span></div>${rows.map(render).join('') || '<p class="workspace-tree-empty">No channels found. Try a channel name, repository or branch.</p>'}`
    const favorites = rows.filter((row) => row.favorite)
    const recent = rows.filter((row) => !row.favorite)
    const shown = this.allChannels ? recent : recent.slice(0, 8)
    const active = recent.find((row) => row.key === this.active?.key)
    if (active && !shown.includes(active)) shown.push(active)
    return `${favorites.length ? `<section><button class="channel-section-toggle" data-channel-favorites data-tree-key="favorites" aria-expanded="${!this.channelNavigation.favoritesClosed}" aria-controls="channel-favorites"><span>${this.channelNavigation.favoritesClosed ? '›' : '⌄'} Favorites</span><small>${favorites.length}</small></button><div id="channel-favorites" ${this.channelNavigation.favoritesClosed ? 'hidden' : ''}>${favorites.map(render).join('')}</div></section>` : ''}<section><div class="workspace-tree-section channel-recent-heading"><span>Recent channels</span><small>${recent.length}</small></div>${shown.map(render).join('')}${recent.length > shown.length || (this.allChannels && recent.length > 8) ? `<button class="workspace-tree-more" data-channel-more data-tree-key="more-channels">${this.allChannels ? 'Show fewer' : `Show all ${recent.length} channels`}</button>` : ''}</section>${rows.length ? '' : `<p class="workspace-tree-empty">${this.loading || this.pending.size ? 'Loading channels…' : 'Start a channel to explore with your agent.'}</p>`}`
  }
  private draw() {
    const scroll =
      this.element.querySelector('.workspace-tree-scroll')?.scrollTop || 0
    const focused = this.element.contains(document.activeElement)
      ? (document.activeElement as HTMLElement).dataset.treeKey
      : undefined
    const search = this.element.querySelector<HTMLInputElement>(
      '[data-channel-search]'
    )
    const searching = search === document.activeElement
    const selection = searching
      ? [search!.selectionStart, search!.selectionEnd]
      : null
    this.element.innerHTML = `<header><strong>Workspace</strong><button type="button" class="workspace-tree-hide" data-research-action="toggle-sidebar" aria-label="Hide channel navigation" title="Hide channel navigation">‹</button><button type="button" class="workspace-tree-close" data-tree-close aria-label="Close channel navigation">×</button></header>
      <button type="button" class="workspace-tree-new" data-tree-start-channel>${pickerIcons.plus}<span>New channel</span></button>
      <label class="channel-nav-search">${pickerIcons.search}<input type="search" data-channel-search aria-label="Find a channel" placeholder="Find a channel…" value="${escape(this.channelQuery)}"></label>
      <nav class="workspace-tree-scroll" aria-label="Channels">${this.channelRows()}</nav>
      ${this.active && this.loaded.has(this.active.projectId) ? channelWork(this.loaded.get(this.active.projectId)!, this.active) : ''}
      ${this.error ? `<p class="workspace-tree-error" role="alert">${escape(this.error)} <button type="button" data-tree-refresh>Retry</button></p>` : ''}`
    this.element.querySelector('.workspace-tree-scroll')!.scrollTop = scroll
    if (searching) {
      const input = this.element.querySelector<HTMLInputElement>(
        '[data-channel-search]'
      )!
      input.focus({ preventScroll: true })
      // Search inputs do not support setSelectionRange in every browser.
      try {
        input.setSelectionRange(selection![0], selection![1])
      } catch {
        /* Keep focus. */
      }
    }
    if (focused)
      this.element
        .querySelector<HTMLElement>(`[data-tree-key="${CSS.escape(focused)}"]`)
        ?.focus({ preventScroll: true })
  }
  private async click(event: MouseEvent) {
    const target = event.target as Element
    const control = target.closest<HTMLButtonElement>('button')
    if (control?.hasAttribute('data-channel-more')) {
      this.allChannels = !this.allChannels
      this.draw()
      return
    }
    if (control?.hasAttribute('data-channel-favorites')) {
      this.channelNavigation.favoritesClosed =
        !this.channelNavigation.favoritesClosed
      this.persistChannels()
      this.draw()
      return
    }
    if (control?.dataset.channelMenu) {
      const row = channelRows(
        [...this.loaded.values()],
        this.channelNavigation
      ).find((row) => row.key === control.dataset.channelMenu)
      if (!row) return
      const panel = openPopover(
        control,
        'channel-options',
        `<p class="workspace-project-path">${escape(row.title)}</p><button data-channel-favorite>${row.favorite ? 'Remove from favorites' : 'Add to favorites'}</button><button data-channel-rename>Rename channel</button>`,
        'workspace-tree-menu'
      )
      panel?.addEventListener('click', async (event) => {
        const action = event.target as Element
        if (action.closest('[data-channel-favorite]')) {
          this.channelNavigation.favorites = row.favorite
            ? this.channelNavigation.favorites.filter((key) => key !== row.key)
            : [...this.channelNavigation.favorites, row.key]
          this.channelNavigation.favoritesClosed = false
          this.persistChannels()
          closePopover()
          this.draw()
          this.element
            .querySelector<HTMLAnchorElement>(
              `[data-tree-key="${CSS.escape(row.key)}"]`
            )
            ?.focus()
        } else if (action.closest('[data-channel-rename]') && !this.busy) {
          closePopover()
          this.busy = true
          try {
            const title = await researchNameDialog(
              this.root,
              'Rename channel',
              'Channel name',
              row.title
            )
            if (!title) return
            this.update(
              await researchApi.change(row.projectId, 'chats', {
                chatId: row.chatId,
                title
              })
            )
            if (this.active?.key === row.key)
              await this.navigate(new URL(row.href, location.href))
          } catch (error) {
            this.error =
              error instanceof Error
                ? error.message
                : 'Could not rename this channel.'
          } finally {
            this.busy = false
            this.draw()
          }
        }
      })
      return
    }
    if (target.closest('[data-tree-start-channel]')) {
      await this.navigate(new URL('/', location.href))
      this.root.classList.remove('workspace-tree-open')
      return
    }
    if (target.closest('[data-tree-close]')) {
      this.root.classList.remove('workspace-tree-open')
      this.root
        .querySelector<HTMLButtonElement>('[data-workspace-mode="projects"]')
        ?.focus()
    }
    const button = target.closest<HTMLButtonElement>('button')
    if (button?.dataset.treeMenu) {
      const projectId = button.dataset.treeMenu
      const panel = openPopover(
        button,
        `project-actions-${projectId}`,
        `<p class="workspace-project-path">${escape(this.projects.find((project) => project.id === projectId)?.repository?.path || 'Notes project · no repository')}</p><button type="button" data-tree-rename="${escape(projectId)}">Rename project</button><button type="button" data-tree-new-notebook="${escape(projectId)}">New notebook</button>`,
        'workspace-tree-menu'
      )
      panel?.addEventListener('click', (event) => {
        closePopover()
        void this.click(event).catch((error) => {
          this.error = String(error)
          this.draw()
        })
      })
      return
    }
    const editProject =
      button?.dataset.treeRename || button?.dataset.treeNewNotebook
    if (editProject && !this.busy) {
      this.busy = true
      try {
        const rename = Boolean(button?.dataset.treeRename)
        const title = await researchNameDialog(
          this.root,
          rename ? 'Rename project' : 'New notebook',
          rename ? 'Project name' : 'Notebook name',
          rename
            ? this.projects.find((project) => project.id === editProject)
                ?.title || ''
            : ''
        )
        if (!title) return
        const project = await researchApi.change(
          editProject,
          rename ? 'rename' : 'notebooks',
          { title }
        )
        this.update(project)
        this.expanded.add(editProject)
        this.persist()
        const href =
          rename && this.active?.projectId === editProject
            ? this.active.href
            : projectLink(
                editProject,
                {
                  notebook: rename
                    ? project.notebooks[0]?.id
                    : project.notebooks.at(-1)?.id
                },
                { projectView: 'notes' }
              )
        await this.navigate(new URL(href, location.href))
        this.root.classList.remove('workspace-tree-open')
      } finally {
        this.busy = false
        this.draw()
      }
      return
    }
    const id = button?.dataset.treeToggle
    if (id) {
      if (this.expanded.has(id)) this.expanded.delete(id)
      else {
        this.expanded.add(id)
        void this.load(id)
      }
      this.persist()
      this.draw()
    }
    const notebooks = button?.dataset.treeNotebooks
    if (notebooks) {
      this.notebooks.has(notebooks)
        ? this.notebooks.delete(notebooks)
        : this.notebooks.add(notebooks)
      this.draw()
    }
    const more = button?.dataset.treeMore
    if (more) {
      this.showAll.has(more)
        ? this.showAll.delete(more)
        : this.showAll.add(more)
      this.draw()
    }
    if (button?.dataset.treeRetry) void this.load(button.dataset.treeRetry)
    if (button?.hasAttribute('data-tree-refresh')) void this.refresh()
    const link = target.closest<HTMLAnchorElement>('a[data-tree-link]')
    if (
      link &&
      !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    ) {
      event.preventDefault()
      if (await this.navigate(new URL(link.href)))
        this.root.classList.remove('workspace-tree-open')
    }
    if (!button || this.busy) return
    if (
      button.hasAttribute('data-tree-new-project') ||
      button.hasAttribute('data-tree-new-chat')
    ) {
      this.busy = true
      try {
        let projectId = button.dataset.treeNewChat
        if (button.hasAttribute('data-tree-new-project')) {
          const project = await chooseRepositoryProject()
          if (!project) return
          this.update(project)
          projectId = project.id
        } else if (!projectId) {
          const project = await chooseRepositoryProject()
          if (!project) return
          this.update(project)
          projectId = project.id
        }
        this.expanded.add(projectId!)
        this.persist()
        if (
          await this.navigate(
            new URL(
              projectLink(
                projectId!,
                { chat: 'new' },
                { projectView: 'research' }
              ),
              location.href
            )
          )
        )
          this.root.classList.remove('workspace-tree-open')
      } finally {
        this.busy = false
        this.draw()
      }
    }
  }
}
