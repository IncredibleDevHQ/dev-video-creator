import { html } from '../shared/html'
import type { ResearchAnchor, ResearchProjectView } from '../shared/research'
import type { RepoInspection } from '../shared/repos'
import { researchApi, researchRequest } from './research-api'
import { researchWorkspaceView, type ResearchViewState } from './research-view'
import { researchGraph } from './research-graph'
import { ResearchWorkbench } from './research-workbench'
import { researchDraftKey } from './research-layout'
import { renderResearch } from './research-render'
import { requestJson } from './http'
import { escape } from './ui'
import './styles/research.css'
import './styles/research-notebooks.css'
import './styles/research-spatial.css'

export class ResearchWorkspace {
  isOpen = false
  private state: ResearchViewState | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private revision = 0
  private workbench: ResearchWorkbench
  private selection: ResearchAnchor | null = null
  private drafts: Record<string, string> = {}
  private busy = false
  private composerKeys: Record<string, string> = {}
  constructor(private root: HTMLElement) {
    this.workbench = new ResearchWorkbench(root, () => this.render())
    root.addEventListener('click', (event) => {
      if (!this.isOpen) return
      const target = (event.target as Element).closest<HTMLElement>('button')
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
      }
      if (field.id === 'research-adapter') {
        s.adapter = field.value
        s.model = ''
        this.render()
      }
      if (field.id === 'research-graph-depth')
        this.workbench.depth(Number(field.value))
      if (field.id === 'research-model') s.model = field.value.trim()
      if (field.id === 'research-jump' && field.value)
        this.root
          .querySelector(`#wireframes-${CSS.escape(field.value)}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    root.addEventListener('input', (event) => {
      const field = event.target as HTMLInputElement
      if (!this.isOpen) return
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
      if (field.id) {
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
    })
    window.addEventListener('popstate', () => {
      const url = new URL(location.href)
      if (url.searchParams.has('detail')) {
        location.reload()
        return
      }
      const id = url.searchParams.get('space')
      if (id) void this.open(id).catch((e) => this.error(e))
      else if (
        !url.searchParams.has('notebook') &&
        !url.searchParams.has('legacy')
      )
        void this.home()
      else location.reload()
    })
  }
  private draftKey(field: string) {
    return researchDraftKey(
      field,
      this.state?.notebook || '',
      this.state?.node || null
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
    this.root.innerHTML = html`<div class="research-home">
      <header class="research-header">
        <a href="/" class="research-brand">✳ <span>Incredible</span></a
        ><a href="/?legacy=1">Earlier notebooks & studio tools ↗</a>
      </header>
      <main>
        <span class="research-eyebrow">A PLACE FOR YOUR CURIOSITY</span>
        <h1>Start with a thought.<br /><em>See where it takes you.</em></h1>
        <p>
          Collect notes. Explore questions. Turn what you learn into a series.
        </p>
        <form id="research-start-form">
          <label class="sr" for="research-first-note">Your first note</label
          ><textarea
            id="research-first-note"
            name="text"
            rows="5"
            maxlength="7600"
            placeholder="Paste a note, an idea, something you’re learning…"
            required
          >
${escape(this.drafts['research-first-note'] || '')}</textarea
          >
          <div class="research-composer-footer">
            <small>We’ll create a project and your first notebook.</small
            ><button class="research-primary">Get started ↗</button>
          </div>
        </form>
        <div class="research-home-error" role="alert"></div>
        <section class="research-project-list">
          <div class="research-section-heading">
            <h2>Your projects</h2>
            <button data-research-action="new-project">+ New project</button>
          </div>
          <div id="research-projects" role="status">Loading your projects…</div>
        </section>
      </main>
    </div>`
    this.root.querySelector<HTMLTextAreaElement>(
      '#research-first-note'
    )!.value = this.drafts['research-first-note'] || ''
    const revision = this.revision
    try {
      const projects = await researchApi.list()
      if (revision !== this.revision) return
      const list = this.root.querySelector('#research-projects')!
      list.innerHTML = projects.length
        ? html`<div class="research-project-grid">
            ${projects
              .map(
                (p) =>
                  html`<a class="research-project-card" href="/?space=${p.id}"
                    ><span class="research-project-symbol">▤</span>
                    <h3>${escape(p.title)}</h3>
                    <p>
                      ${p.notebooks}
                      ${p.notebooks === 1 ? 'notebook' : 'notebooks'} ·
                      ${p.questions} research questions
                    </p>
                    <span>Open project ↗</span></a
                  >`
              )
              .join('')}
          </div>`
        : '<p>Your first project starts with the note above. No setup needed.</p>'
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
      tab:
        tab === 'research' || tab === 'wireframes' || tab === 'canvas'
          ? tab
          : 'notes',
      notebook:
        project.notebooks.find((n) => n.id === url.searchParams.get('book'))
          ?.id || project.notebooks[0].id,
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
    this.render()
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
    url.searchParams.set('projectView', this.state.tab)
    url.searchParams.set('book', this.state.notebook)
    if (this.state.node) url.searchParams.set('node', this.state.node)
    if (url.href !== location.href) history.pushState(null, '', url)
  }
  private render() {
    const s = this.state
    if (!s || !this.isOpen) return
    const active = document.activeElement as
      | HTMLInputElement
      | HTMLTextAreaElement
      | null
    const focus = active?.id
    const selection =
      active instanceof HTMLTextAreaElement
        ? [active.selectionStart, active.selectionEnd]
        : null
    const scroll = [
      ...this.root.querySelectorAll<HTMLElement>(
        '.research-transcript,.research-note-scroll,.research-graph-scroll'
      )
    ].map((e) => [e.className, e.scrollTop, e.scrollLeft] as const)
    const nearEnd = this.root.querySelector('.research-transcript')
    const follow = nearEnd
      ? nearEnd.scrollHeight - nearEnd.scrollTop - nearEnd.clientHeight < 60
      : true
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
    for (const field of this.root.querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement
    >('input[id],textarea[id]')) {
      if (['research-model', 'research-search'].includes(field.id)) continue
      const value = this.drafts[this.draftKey(field.id)]
      if (value !== undefined) field.value = value
    }
    for (const [cls, top, left] of scroll) {
      const element = this.root.querySelector<HTMLElement>(`.${cls}`)
      if (element) {
        element.scrollTop = top
        element.scrollLeft = left
      }
    }
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
  private async submit(form: HTMLFormElement) {
    const values = new FormData(form)
    const formId = form.id
    await this.mutation(async () => {
      if (formId === 'research-start-form') {
        const p = await researchApi.create({ text: values.get('text') })
        this.drafts['research-first-note'] = ''
        this.persistDrafts()
        history.pushState(null, '', `/?space=${p.id}`)
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
        s.message = 'Note saved. It is part of your project’s shared knowledge.'
      }
      if (formId === 'research-question-form') {
        const result = await researchRequest<{
          nodeId: string
          project: ResearchProjectView
        }>(`/${s.project.id}/ask`, {
          question: values.get('question'),
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
        this.drafts['research-repo-path'] = ''
      }
    })
    if (formId === 'research-question-form') this.workbench.graph.fit()
    if (formId === 'research-repo-form' || formId === 'research-branch-form')
      this.root.querySelector('details')?.setAttribute('open', '')
  }
  private captureSelection() {
    if (!this.state || this.state.pending) return
    const selected = getSelection()
    if (!selected?.rangeCount || selected.isCollapsed) return
    const range = selected.getRangeAt(0)
    const element = (
      range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement
    ) as Element
    const passage = element.closest<HTMLElement>(
      '[data-select-response],[data-select-note]'
    )
    if (!passage || !this.root.contains(passage)) return
    const before = range.cloneRange()
    before.selectNodeContents(passage)
    before.setEnd(range.startContainer, range.startOffset)
    const start = before.toString().length,
      end = start + range.toString().length
    if (end <= start || end - start > 7600) return
    const isResponse = Boolean(passage.dataset.selectResponse)
    this.selection = {
      kind: isResponse ? 'response' : 'note',
      id: passage.dataset.selectResponse || passage.dataset.selectNote!,
      ...(isResponse ? {} : { notebookId: passage.dataset.notebookId }),
      start,
      end,
      text: range.toString()
    }
    const bar = this.root.querySelector<HTMLElement>('#research-selection')!
    bar.hidden = false
    bar.innerHTML = html`<span>${end - start} characters selected</span
      >${isResponse
        ? '<button data-research-action="save-selection">Save to notebook</button>'
        : ''}<button data-research-action="ask-selection">
        Ask about this ↗</button
      ><button
        data-research-action="dismiss-selection"
        aria-label="Dismiss selection"
      >
        ×
      </button>`
  }
  private branch(anchor: ResearchAnchor) {
    const s = this.state!
    s.anchor = anchor
    if (anchor.kind === 'response') s.node = anchor.id
    else {
      const block = s.project.notebooks
        .find((n) => n.id === anchor.notebookId)
        ?.blocks.find((b) => b.id === anchor.id)
      s.node = block?.origin?.nodeId || null
    }
    s.tab = 'research'
    getSelection()?.removeAllRanges()
    this.navigate()
    this.render()
    this.root.querySelector<HTMLTextAreaElement>('#research-question')?.focus()
  }
  private showSelectedTurn() {
    const transcript = this.root.querySelector<HTMLElement>(
      '.research-transcript'
    )
    const turn = this.root.querySelector<HTMLElement>(
      `#turn-${CSS.escape(this.state?.node || '')}`
    )
    if (transcript && turn)
      transcript.scrollTop +=
        turn.getBoundingClientRect().top -
        transcript.getBoundingClientRect().top -
        12
  }
  private async click(button: HTMLElement) {
    const action = button.dataset.researchAction
    const s = this.state
    if (action === 'new-project') {
      const title = await this.nameDialog('New project', 'Project name', '')
      if (title) {
        const p = await researchApi.create({ title })
        history.pushState(null, '', `/?space=${p.id}`)
        await this.open(p.id)
      }
      return
    }
    if (!s) return
    if (button.dataset.researchNode) {
      const node = s.project.nodes.find(
        (n) => n.id === button.dataset.researchNode
      )!
      s.node = node.id
      s.anchor = null
      s.tab = 'research'
      s.repos = node.repos.map(({ commit: _, ...r }) => r)
      s.adapter = node.harness.adapter
      s.model = node.harness.model || ''
      this.navigate()
      this.render()
      this.showSelectedTurn()
      return
    }
    if (button.dataset.selectNotebook) {
      s.notebook = button.dataset.selectNotebook
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
    if (action?.startsWith('tab-')) {
      s.tab = action.slice(4) as ResearchViewState['tab']
      this.navigate()
      this.render()
      return
    }
    if (action === 'new-chat') {
      s.node = null
      s.anchor = null
      this.navigate()
      this.render()
      return
    }
    if (action === 'clear-anchor') s.anchor = null
    if (action === 'clear-error') s.error = ''
    if (action === 'remove-repo')
      s.repos.splice(Number(button.dataset.index), 1)
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
      const name = await this.nameDialog('New notebook', 'Notebook name', '')
      if (name)
        await this.mutation(async () => {
          await this.change('notebooks', { title: name })
          s.notebook = s.project.notebooks.at(-1)!.id
        })
    }
    if (action === 'rename-project' || action === 'rename-notebook') {
      const notebook = s.project.notebooks.find((n) => n.id === s.notebook)!
      const name = await this.nameDialog(
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
    await this.mutation(async () => {
      await this.change('notes', {
        notebookId: this.state!.notebook,
        nodeId: selection.id,
        start: selection.start,
        end: selection.end
      })
      this.state!.message =
        'Excerpt saved with its question, response, and repository context. Use View source to return.'
      this.selection = null
    })
  }
  private nameDialog(
    title: string,
    label: string,
    value: string
  ): Promise<string | null> {
    let dialog = this.root.querySelector<HTMLDialogElement>('#research-dialog')
    if (!dialog) {
      dialog = document.createElement('dialog')
      dialog.id = 'research-dialog'
      this.root.append(dialog)
    }
    dialog.innerHTML = html`<form method="dialog">
      <h2>${escape(title)}</h2>
      <label for="research-name">${escape(label)}</label
      ><input
        id="research-name"
        name="name"
        value="${escape(value)}"
        maxlength="160"
        required
      />
      <div>
        <button value="cancel" formnovalidate>Cancel</button
        ><button value="save" class="research-primary">Save</button>
      </div>
    </form>`
    const target = dialog
    return new Promise((resolve) => {
      target.addEventListener(
        'close',
        () =>
          resolve(
            target.returnValue === 'save'
              ? target.querySelector<HTMLInputElement>('input')!.value.trim() ||
                  null
              : null
          ),
        { once: true }
      )
      target.showModal()
      target.querySelector<HTMLInputElement>('input')!.focus()
    })
  }
}
