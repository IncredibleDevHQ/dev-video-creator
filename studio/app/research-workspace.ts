import { html } from '../shared/html'
import { modelName } from '../shared/agent-models'
import type { ResearchAnchor, ResearchProjectView } from '../shared/research'
import type { RepoInspection } from '../shared/repos'
import { researchApi, researchRequest } from './research-api'
import { researchWorkspaceView, type ResearchViewState } from './research-view'
import { researchGraph } from './research-graph'
import { ResearchWorkbench } from './research-workbench'
import { researchDraftKey } from './research-layout'
import {
  renderResearch,
  researchScroll,
  restoreResearchScroll,
  ResearchReturn
} from './research-render'
import { captureResearchSelection } from './research-selection'
import {
  researchHome,
  populateResearchHome,
  saveHomeNote
} from './research-home'
import { researchNameDialog } from './research-dialog'
import { researchChatSetup } from './research-chat-setup'
import { showResearchTurn, toggleProjectPanel } from './research-navigation'
import {
  selectResearchChat,
  selectResearchNode,
  chatSettings
} from './research-session-state'
import { requestJson } from './http'
import { escape } from './ui'
import './styles/research.css'
import './styles/research-notebooks.css'
import './styles/research-spatial.css'
import './styles/research-sessions.css'
import './styles/project-workspace.css'
import './styles/project-simple.css'

export class ResearchWorkspace {
  isOpen = false
  private state: ResearchViewState | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private revision = 0
  private workbench: ResearchWorkbench
  private selection: ResearchAnchor | null = null
  private drafts: Record<string, string> = {}
  private busy = false
  private settingsSave: Promise<void> = Promise.resolve()
  private settingsVersion = 0
  private settingsPending = false
  private returning = new ResearchReturn()
  private composerKeys: Record<string, string> = {}
  constructor(
    private root: HTMLElement,
    onHistory: () => void,
    private onLocation?: (state: ResearchViewState | null) => void
  ) {
    this.workbench = new ResearchWorkbench(root, () => this.render())
    root.addEventListener('click', (event) => {
      if (!this.isOpen) return
      const element = event.target as Element
      const menu = element.closest(
        '.research-compose-tools summary'
      )?.parentElement
      if (menu || !element.closest('.research-compose-tools'))
        this.root
          .querySelectorAll('.research-compose-tools details[open]')
          .forEach((other) => {
            if (other !== menu) other.removeAttribute('open')
          })
      const target = element.closest<HTMLElement>('button')
      if (target) target.closest('.project-switcher')?.removeAttribute('open')
      if (target) void this.click(target).catch((e) => this.error(e))
    })
    root.addEventListener('submit', (event) => {
      if (
        !this.isOpen ||
        !(event.target instanceof HTMLFormElement) ||
        !event.target.id.startsWith('research-')
      )
        return
      event.preventDefault()
      void this.submit(event.target).catch((e) => this.error(e))
    })
    root.addEventListener('change', (event) => {
      const field = event.target as HTMLInputElement
      const s = this.state
      if (!this.isOpen || !s) return
      if (field.id === 'research-notebook') {
        s.notebook = field.value
        this.navigate()
        this.render()
        void this.saveChatSettings().catch((e) => this.error(e))
      }
      if (field.id === 'research-adapter') {
        s.adapter = field.value
        s.model = ''
        this.render()
        void this.saveChatSettings().catch((e) => this.error(e))
      }
      if (field.id === 'research-graph-depth')
        this.workbench.depth(Number(field.value))
      if (field.id === 'research-model') {
        s.model = field.value.trim()
        const label = this.root.querySelector('.research-agent-options summary')
        if (label)
          label.textContent = `${s.adapter === 'claude-code' ? 'Claude Code' : s.adapter === 'kimi' ? 'Kimi' : 'Codex'}${s.model ? ` · ${modelName(s.model)}` : ''} ⌄`
        void this.saveChatSettings().catch((e) => this.error(e))
      }
    })
    root.addEventListener('input', (event) => {
      const field = event.target as HTMLInputElement
      if (!this.isOpen) return
      if (field.id === 'research-model' && this.state) {
        this.state.model = field.value
        const label = this.root.querySelector('.research-agent-options summary')
        if (label)
          label.textContent = `${this.state.adapter === 'claude-code' ? 'Claude Code' : this.state.adapter === 'kimi' ? 'Kimi' : 'Codex'}${field.value ? ` · ${modelName(field.value)}` : ''} ⌄`
      }
      if (field.id === 'research-search' && this.state) {
        this.state.query = field.value
        const graph = this.root.querySelector('.research-graph-scroll')
        if (graph)
          graph.innerHTML = researchGraph(
            this.state.project.nodes,
            this.state.node,
            field.value,
            this.workbench.state.scope,
            this.workbench.state.depth
          )
        this.workbench.graph.mount()
      }
      if (field.id.startsWith('research-')) {
        this.drafts[this.draftKey(field.id)] = field.value
        this.persistDrafts()
      }
    })
    root.addEventListener('mouseup', (event) => {
      if (!(event.target as Element).closest('#research-selection'))
        this.captureSelection()
    })
    root.addEventListener('keyup', (event) => {
      if (event.key === 'Shift') this.captureSelection()
      if (event.key === 'Escape' && this.state?.sidebarOpen) {
        this.state.sidebarOpen = false
        this.render()
        this.root.querySelector<HTMLElement>('.project-sidebar-toggle')?.focus()
      }
      if (event.key === 'Escape')
        this.root
          .querySelectorAll('.research-compose-tools details[open]')
          .forEach((menu) => menu.removeAttribute('open'))
    })
    window.addEventListener('popstate', onHistory)
  }
  suspend() {
    if (this.isOpen) this.returning.save(this.root, this.state)
    this.isOpen = false
    ++this.revision
    if (this.timer) clearTimeout(this.timer)
  }
  async command(button: HTMLElement) {
    await this.click(button)
  }

  private draftKey(field: string) {
    return researchDraftKey(
      field,
      this.state?.notebook || '',
      this.state?.node || null,
      this.state?.chat || null
    )
  }
  private persistDrafts() {
    try {
      sessionStorage.setItem(
        `research-drafts:${this.state?.project.id || 'home'}`,
        JSON.stringify(this.drafts)
      )
    } catch {
      /* typing still works when storage is unavailable */
    }
  }
  private loadDrafts(id: string) {
    try {
      this.drafts = JSON.parse(
        sessionStorage.getItem(`research-drafts:${id}`) || '{}'
      )
    } catch {
      this.drafts = {}
    }
  }
  async home() {
    this.isOpen = true
    this.state = null
    this.revision++
    if (this.timer) clearTimeout(this.timer)
    this.loadDrafts('home')
    this.root.innerHTML = researchHome(this.drafts['research-first-note'] || '')
    this.root.querySelector<HTMLTextAreaElement>(
      '#research-first-note'
    )!.value = this.drafts['research-first-note'] || ''
    const revision = this.revision
    try {
      const projects = await researchApi.list()
      if (revision !== this.revision) return
      populateResearchHome(this.root, projects)
      this.onLocation?.(null)
    } catch (error) {
      this.error(error)
    }
  }
  async open(id: string) {
    this.isOpen = true
    const revision = ++this.revision
    if (this.timer) clearTimeout(this.timer)
    this.root.innerHTML =
      '<div class="research-loading" role="status">Opening your project…</div>'
    let project: ResearchProjectView
    try {
      project = await researchApi.load(id)
    } catch (error) {
      if (revision !== this.revision) return
      this.state = null
      this.error(error)
      return
    }
    if (revision !== this.revision) return
    const url = new URL(location.href)
    const tab = url.searchParams.get('projectView')
    const node = url.searchParams.get('node')
    this.loadDrafts(id)
    this.workbench.open(id)
    this.state = {
      layout: this.workbench.state,
      project,
      tab: 'research',
      contentOpen: tab === 'wireframes' || tab === 'canvas',
      documentExpanded:
        tab === 'notes' || (!tab && !node && !url.searchParams.has('chat')),
      notebook:
        project.notebooks.find((n) => n.id === url.searchParams.get('book'))
          ?.id || project.notebooks[0].id,
      chat: null,
      node: project.nodes.some((n) => n.id === node) ? node : null,
      anchor: null,
      repos: [...project.repos],
      inspected: null,
      adapter: project.harness?.adapter || 'claude-code',
      model: project.harness?.model || '',
      query: '',
      pending: false,
      message: '',
      error: ''
    }
    const selected = project.nodes.find((n) => n.id === node)
    selectResearchChat(
      this.state,
      selected?.chatId || url.searchParams.get('chat')
    )
    if (selected) this.state.node = selected.id
    if (
      url.searchParams.get('book') &&
      project.notebooks.some((n) => n.id === url.searchParams.get('book'))
    )
      this.state.notebook = url.searchParams.get('book')!
    this.workbench.state.graphOpen = false
    this.workbench.state.expanded = false
    this.workbench.state.notesOpen = Boolean(
      this.state.contentOpen || this.state.documentExpanded
    )
    this.render()
    if (tab === 'research') this.showSelectedTurn()
    this.returning.restore(this.root, this.state)
    this.poll(revision)
  }
  private poll(revision: number) {
    this.timer = setTimeout(async () => {
      if (!this.isOpen || !this.state || revision !== this.revision) return
      try {
        const project = await researchApi.load(this.state.project.id)
        if (revision !== this.revision || !this.state) return
        if (JSON.stringify(project) !== JSON.stringify(this.state.project)) {
          if (
            !this.busy &&
            !this.settingsPending &&
            !this.workbench.interacting &&
            !this.root.querySelector('dialog[open]') &&
            !getSelection()?.toString()
          ) {
            this.state.project = project
            this.render()
          }
        }
      } catch (error) {
        if (this.state) {
          this.state.error = String((error as Error).message)
          this.render()
        }
      }
      if (revision === this.revision) this.poll(revision)
    }, 2200)
  }
  private navigate() {
    if (!this.state) return
    const url = new URL(location.href)
    url.search = ''
    url.searchParams.set('space', this.state.project.id)
    url.searchParams.set(
      'projectView',
      this.state.contentOpen
        ? 'canvas'
        : this.state.documentExpanded
          ? 'notes'
          : 'research'
    )
    url.searchParams.set('book', this.state.notebook)
    if (this.state.chat) url.searchParams.set('chat', this.state.chat)
    if (this.state.node) url.searchParams.set('node', this.state.node)
    if (url.href !== location.href) history.pushState(null, '', url)
  }
  private render() {
    const s = this.state
    if (!s || !this.isOpen || this.root.querySelector('dialog[open]')) return
    const active = document.activeElement as
      | HTMLInputElement
      | HTMLTextAreaElement
      | null
    const focus = active?.id
    const selection =
      active instanceof HTMLTextAreaElement
        ? [active.selectionStart, active.selectionEnd]
        : null
    const scroll = researchScroll(this.root)
    const nearEnd = this.root.querySelector('.research-transcript')
    const follow = nearEnd
      ? nearEnd.scrollHeight - nearEnd.scrollTop - nearEnd.clientHeight < 60
      : true
    const openDetails = [
      ...this.root.querySelectorAll('details[id][open]')
    ].map((detail) => detail.id)
    const composerKeys = Object.fromEntries(
      ['research-question', 'research-note-input'].map((id) => [
        id,
        `${s.project.id}:${this.draftKey(id)}`
      ])
    )
    renderResearch(
      this.root,
      researchWorkspaceView(s),
      this.composerKeys,
      composerKeys
    )
    this.composerKeys = composerKeys
    for (const id of openDetails)
      this.root.querySelector(`#${CSS.escape(id)}`)?.setAttribute('open', '')
    for (const field of this.root.querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement
    >('input[id],textarea[id]')) {
      if (['research-model', 'research-search'].includes(field.id)) continue
      const value = this.drafts[this.draftKey(field.id)]
      if (value !== undefined) field.value = value
    }
    restoreResearchScroll(this.root, scroll)
    const transcript = this.root.querySelector('.research-transcript')
    if (transcript && follow) transcript.scrollTop = transcript.scrollHeight
    if (focus) {
      const field = this.root.querySelector<HTMLElement>(
        `#${CSS.escape(focus)}`
      )
      field?.focus({ preventScroll: true })
      if (selection && field instanceof HTMLTextAreaElement)
        field.setSelectionRange(selection[0], selection[1])
    }
    this.workbench.mount()
    this.onLocation?.(s)
  }
  private error(error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    if (this.state) {
      this.state.error = message
      this.render()
    } else {
      const box = this.root.querySelector('.research-home-error')
      if (box) box.textContent = message
      else
        this.root.innerHTML = html`<div class="research-loading" role="alert">
          ${escape(message)} <a href="/">Back to projects</a>
        </div>`
    }
  }
  private async mutation(work: () => Promise<void>) {
    if (this.busy) return
    this.busy = true
    if (this.state) {
      this.state.pending = true
      this.state.error = ''
      this.state.message = ''
    }
    this.render()
    try {
      await work()
    } finally {
      this.busy = false
      if (this.state) this.state.pending = false
      this.render()
    }
  }
  private async change(action: string, body: unknown) {
    if (!this.state) return
    const id = this.state.project.id
    const project = await researchApi.change(id, action, body)
    if (this.state?.project.id === id) this.state.project = project
  }
  private async saveChatSettings() {
    const s = this.state
    if (!s?.chat) return
    const body = chatSettings(s)
    const version = ++this.settingsVersion
    this.settingsPending = true
    const chat = s.project.chats?.find((c) => c.id === s.chat)
    if (chat) {
      chat.repos = structuredClone(body.repos)
      chat.harness = body.harness
      chat.notebookId = body.notebookId
    }
    this.settingsSave = this.settingsSave
      .catch(() => {})
      .then(async () => {
        const project = await researchApi.change(s.project.id, 'chats', body)
        if (
          this.state?.project.id === project.id &&
          version === this.settingsVersion
        )
          this.state.project = project
      })
    try {
      await this.settingsSave
    } finally {
      if (version === this.settingsVersion) this.settingsPending = false
    }
  }
  private async submit(form: HTMLFormElement) {
    const values = new FormData(form)
    const formId = form.id
    await this.settingsSave.catch(() => {})
    await this.mutation(async () => {
      if (formId === 'research-start-form') {
        const p = await saveHomeNote(values)
        this.drafts['research-first-note'] = ''
        this.persistDrafts()
        history.pushState(
          null,
          '',
          `/?space=${p.id}&projectView=notes&book=${p.notebooks[0].id}`
        )
        await this.open(p.id)
        return
      }
      const s = this.state
      if (!s) return
      if (formId === 'research-note-form') {
        await this.change('notes', {
          notebookId: s.notebook,
          text: values.get('note')
        })
        this.drafts[this.draftKey('research-note-input')] = ''
        this.persistDrafts()
        s.message = 'Note saved.'
      }
      if (formId === 'research-question-form') {
        const result = await researchRequest<{
          nodeId: string
          project: ResearchProjectView
        }>(`/${s.project.id}/ask`, {
          question: values.get('question'),
          notebookId: s.notebook,
          chatId: s.chat || undefined,
          parentId: s.node,
          anchor: s.anchor,
          harness: {
            adapter: s.adapter,
            ...(s.model ? { model: s.model } : {})
          },
          repos: s.repos
        })
        this.drafts[this.draftKey('research-question')] = ''
        s.project = result.project
        s.chat = result.project.nodes.find(
          (n) => n.id === result.nodeId
        )!.chatId!
        s.node = result.nodeId
        s.anchor = null
        this.drafts[this.draftKey('research-question')] = ''
        this.persistDrafts()
        this.navigate()
      }
      if (formId === 'research-repo-form') {
        s.inspected = await requestJson<RepoInspection>('/api/repos/inspect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: values.get('path') })
        })
      }
      if (formId === 'research-branch-form' && s.inspected) {
        if (s.repos.length >= 4)
          throw new Error('Choose up to four repositories')
        const repo = {
          path: s.inspected.path,
          name: s.inspected.name,
          base: s.inspected.base,
          branch: String(values.get('branch'))
        }
        if (
          !s.repos.some((r) => r.path === repo.path && r.branch === repo.branch)
        )
          s.repos.push(repo)
        s.inspected = null
        this.drafts[this.draftKey('research-repo-path')] = ''
        if (s.chat) await this.change('chats', chatSettings(s))
      }
    })
    if (formId === 'research-question-form') this.workbench.graph.fit()
    if (formId === 'research-repo-form' || formId === 'research-branch-form')
      this.root.querySelector('.research-repos')?.setAttribute('open', '')
  }
  private captureSelection() {
    if (this.state && !this.state.pending)
      this.selection = captureResearchSelection(this.root) || this.selection
  }
  private branch(anchor: ResearchAnchor) {
    const s = this.state!
    s.anchor = anchor
    let nodeId: string | null = anchor.kind === 'response' ? anchor.id : null
    if (anchor.kind === 'note') {
      const block = s.project.notebooks
        .find((n) => n.id === anchor.notebookId)
        ?.blocks.find((b) => b.id === anchor.id)
      nodeId = block?.origin?.nodeId || null
    }
    if (nodeId) selectResearchNode(s, nodeId, false)
    else s.node = null
    if (anchor.kind === 'note' && anchor.notebookId) {
      s.notebook = anchor.notebookId
      void this.saveChatSettings().catch((e) => this.error(e))
    }
    s.tab = 'research'
    s.contentOpen = false
    s.documentExpanded = false
    getSelection()?.removeAllRanges()
    this.navigate()
    this.render()
    this.showSelectedTurn()
    this.root.querySelector<HTMLTextAreaElement>('#research-question')?.focus()
  }
  private showSelectedTurn() {
    showResearchTurn(this.root, this.workbench, this.state?.node || null)
  }
  private async click(button: HTMLElement) {
    const action = button.dataset.researchAction
    const s = this.state
    if (this.busy) return
    if (action === 'new-project') {
      const title = await researchNameDialog(
        this.root,
        'New project',
        'Project name',
        ''
      )
      if (title) {
        const p = await researchApi.create({ title })
        history.pushState(null, '', `/?space=${p.id}`)
        await this.open(p.id)
      }
      return
    }
    if (!s) return
    if (button.dataset.selectChat) {
      selectResearchChat(s, button.dataset.selectChat)
      s.sidebarOpen = false
      s.contentOpen = false
      s.documentExpanded = false
      this.navigate()
      this.render()
      this.showSelectedTurn()
      return
    }
    if (button.dataset.researchNode) {
      const node = s.project.nodes.find(
        (n) => n.id === button.dataset.researchNode
      )!
      selectResearchNode(s, node.id)
      s.contentOpen = false
      s.documentExpanded = false
      this.navigate()
      this.render()
      this.showSelectedTurn()
      return
    }
    if (button.dataset.selectNotebook) {
      s.notebook = button.dataset.selectNotebook
      s.documentExpanded = Boolean(
        button.closest('.project-sidebar') || s.contentOpen
      )
      s.contentOpen = false
      s.sidebarOpen = false
      if (!this.workbench.state.notesOpen || this.workbench.state.expanded) {
        this.workbench.state.notesOpen = false
        this.workbench.handle('toggle-notebook')
      }
      void this.saveChatSettings().catch((e) => this.error(e))
      this.navigate()
      this.render()
      return
    }
    if (button.dataset.noteAsk) {
      const n = s.project.notebooks.find((n) => n.id === s.notebook)!
      const b = n.blocks.find((b) => b.id === button.dataset.noteAsk)!
      this.branch({
        kind: 'note',
        id: b.id,
        notebookId: n.id,
        start: 0,
        end: Math.min(b.text.length, 7600),
        text: b.text.slice(0, 7600)
      })
      return
    }
    if (button.dataset.branchAnswer) {
      s.node = button.dataset.branchAnswer
      s.anchor = null
      this.navigate()
      this.render()
      this.root.querySelector<HTMLElement>('#research-question')?.focus()
      return
    }
    if (button.dataset.retryNode) {
      const node = s.project.nodes.find(
        (n) => n.id === button.dataset.retryNode
      )!
      s.node = node.parentId
      s.anchor = node.anchor || null
      this.drafts[this.draftKey('research-question')] = node.question
      this.render()
      return
    }
    if (button.dataset.saveAnswer) {
      const node = s.project.nodes.find(
        (n) => n.id === button.dataset.saveAnswer
      )!
      if (node.answerText.length > 7600)
        throw new Error(
          'Select a passage of up to 7600 characters to keep in a note'
        )
      this.selection = {
        kind: 'response',
        id: node.id,
        start: 0,
        end: node.answerText.length,
        text: node.answerText
      }
      await this.saveSelection()
      return
    }
    if (!action) return
    this.returning.save(this.root, s)
    if (toggleProjectPanel(action, s, this.workbench, () => this.render())) {
      this.returning.restore(this.root, s)
      this.navigate()
      return
    }
    if (action === 'close-context') {
      this.root.querySelector('.research-repos')?.removeAttribute('open')
      return
    }
    if (action === 'new-chat' || action === 'rename-chat') {
      await this.settingsSave.catch(() => {})
      const result = await researchChatSetup(
        this.root,
        s,
        action === 'rename-chat'
      )
      if (!result) return
      if (result.project.id !== s.project.id) {
        history.pushState(
          null,
          '',
          `/?space=${result.project.id}&chat=${result.chatId}`
        )
        await this.open(result.project.id)
        return
      }
      s.project = result.project
      selectResearchChat(s, result.chatId)
      s.sidebarOpen = false
      s.contentOpen = false
      s.documentExpanded = false
      this.navigate()
      this.render()
      return
    }
    if (action === 'clear-anchor') s.anchor = null
    if (action === 'clear-error') s.error = ''
    if (action === 'clear-message') s.message = ''
    if (action === 'remove-repo') {
      s.repos.splice(Number(button.dataset.index), 1)
      await this.saveChatSettings()
    }
    if (action && this.workbench.handle(action)) return
    if (action === 'dismiss-selection') {
      getSelection()?.removeAllRanges()
      this.root.querySelector<HTMLElement>('#research-selection')!.hidden = true
      return
    }
    if (action === 'ask-selection' && this.selection) {
      this.branch(this.selection)
      return
    }
    if (action === 'save-selection') {
      await this.saveSelection()
      return
    }
    if (action === 'new-notebook') {
      const name = await researchNameDialog(
        this.root,
        'New notebook',
        'Notebook name',
        ''
      )
      if (name)
        await this.mutation(async () => {
          await this.change('notebooks', { title: name })
          s.notebook = s.project.notebooks.at(-1)!.id
          s.contentOpen = false
          s.documentExpanded = true
          s.sidebarOpen = false
          this.workbench.state.notesOpen = false
          this.workbench.handle('toggle-notebook')
          await this.saveChatSettings()
          this.navigate()
        })
    }
    if (action === 'rename-project' || action === 'rename-notebook') {
      const notebook = s.project.notebooks.find((n) => n.id === s.notebook)!
      const name = await researchNameDialog(
        this.root,
        action === 'rename-project' ? 'Rename project' : 'Rename notebook',
        'Name',
        action === 'rename-project' ? s.project.title : notebook.title
      )
      if (name)
        await this.mutation(() =>
          this.change('rename', {
            title: name,
            ...(action === 'rename-notebook' ? { notebookId: notebook.id } : {})
          })
        )
    }
    if (action === 'sync') await this.mutation(() => this.change('sync', {}))
    if (action === 'stop')
      await this.mutation(() =>
        this.change('stop', { nodeId: button.dataset.nodeId })
      )
    if (action === 'generate-canvas' || action === 'generate-notebook')
      await this.mutation(() =>
        this.change('wireframes', {
          harness: {
            adapter: s.adapter,
            ...(s.model ? { model: s.model } : {})
          },
          ...(action === 'generate-notebook'
            ? { notebookId: button.dataset.notebookId }
            : {})
        })
      )
    this.render()
  }
  private async saveSelection() {
    const selection = this.selection
    if (!selection || selection.kind !== 'response' || !this.state) return
    getSelection()?.removeAllRanges()
    this.state.contentOpen = false
    await this.mutation(async () => {
      await this.change('notes', {
        notebookId: this.state!.notebook,
        nodeId: selection.id,
        start: selection.start,
        end: selection.end
      })
      this.state!.message = 'Saved to your notebook with its source.'
      this.selection = null
    })
    if (!this.workbench.state.notesOpen || this.workbench.state.expanded) {
      this.workbench.state.notesOpen = false
      this.workbench.handle('toggle-notebook')
    }
    const notes = this.root.querySelector('.research-note-scroll')
    if (notes) notes.scrollTop = notes.scrollHeight
  }
}
