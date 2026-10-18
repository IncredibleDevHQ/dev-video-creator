import type { AppContext } from './app-context'
import type { ResearchProjectView } from '../shared/research'
import type { Snapshot } from '../shared/api'
import { researchApi } from './research-api'
import { projectSidebar } from './research-session-view'
import {
  projectContext,
  projectLink,
  projectNotesTarget
} from './project-links'
import { saveBeforeLeaving } from './notebook-editor'
import { escape } from './ui'
import './styles/project-shell.css'

/** Hosts production tools inside the project. Roots survive navigation, so
 * controller listeners and research drafts survive every handoff too. */
export class ProjectShell {
  readonly researchRoot = document.createElement('div')
  readonly editorRoot = document.createElement('div')
  private frame = document.createElement('div')
  private sidebar = document.createElement('div')
  private heading = document.createElement('div')
  private main = document.createElement('div')
  private project: ResearchProjectView | null = null
  private revision = 0
  private rendered = ''
  constructor(
    private app: AppContext,
    root: HTMLElement,
    private onLocation?: (project: ResearchProjectView) => void
  ) {
    this.frame.className =
      'research-workspace project-workspace project-tool-shell'
    this.sidebar.className = 'project-sidebar-slot'
    this.main.className = 'project-workspace-main'
    this.editorRoot.className = 'project-tool-root'
    this.main.append(this.heading, this.editorRoot)
    this.frame.append(this.sidebar, this.main)
    root.replaceChildren(this.researchRoot, this.frame)
    this.frame.hidden = true
    this.frame.addEventListener('click', (event) => {
      const button = (event.target as Element).closest<HTMLElement>('button')
      if (!button) return
      if (button.dataset.researchAction === 'toggle-sidebar') {
        this.toggleSidebar()
        return
      }
      if (!button.closest('.project-sidebar')) return
      void this.sidebarAction(button).catch(app.error)
    })
    this.frame.addEventListener('keydown', (event) => {
      if (
        event.key === 'Escape' &&
        this.frame.classList.contains('sidebar-open')
      ) {
        this.toggleSidebar(false)
        this.heading.querySelector<HTMLElement>('button')?.focus()
      }
    })
    document.addEventListener(
      'click',
      (event) => {
        const anchor = (event.target as Element).closest<HTMLAnchorElement>(
          'a[href]'
        )
        if (
          !anchor ||
          anchor.closest('.workspace-picker') ||
          anchor.target ||
          anchor.hasAttribute('download') ||
          event.button ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return
        const url = new URL(anchor.href, location.href)
        if (url.origin !== location.origin || url.pathname !== '/') return
        if (
          !url.searchParams.has('space') &&
          !(
            url.search === '' &&
            (this.app.researchWorkspace.isOpen || !this.frame.hidden)
          )
        )
          return
        event.preventDefault()
        event.stopPropagation()
        void this.go(url).catch(app.error)
      },
      true
    )
  }
  notesLink(id: string) {
    if (!this.project || this.frame.hidden) return undefined
    const context = projectContext(new URL(location.href))
    const notebook = this.project.notebooks.find((n) => n.id === id)
    return projectLink(
      this.project.id,
      { ...context, ...(notebook ? { notebook: id } : {}) },
      { projectView: notebook ? 'notes' : 'canvas' }
    )
  }
  openCanvas(mapId?: string) {
    if (!this.project || this.frame.hidden) return false
    const context = projectContext(new URL(location.href))
    const canvas = mapId || this.project.canvasId
    const target: Record<string, string> = canvas
      ? { map: canvas, detail: '1' }
      : { projectView: 'canvas' }
    void this.go(
      new URL(projectLink(this.project.id, context, target), location.href)
    ).catch(this.app.error)
    return true
  }
  showStandalone() {
    this.researchRoot.hidden = true
    this.frame.hidden = false
    this.frame.classList.add('project-standalone')
  }
  private toggleSidebar(open = !this.frame.classList.contains('sidebar-open')) {
    this.frame.classList.toggle('sidebar-open', open)
    this.heading
      .querySelector('button')
      ?.setAttribute('aria-expanded', String(open))
  }
  private async sidebarAction(button: HTMLElement) {
    if (!this.project) return
    const context = projectContext(new URL(location.href))
    const target: Record<string, string> = { projectView: 'research' }
    if (button.dataset.selectChat) {
      context.chat = button.dataset.selectChat
      context.node = this.project.chats?.find(
        (c) => c.id === context.chat
      )?.lastNodeId
      context.notebook = this.project.chats?.find(
        (c) => c.id === context.chat
      )?.notebookId
    }
    if (button.dataset.selectNotebook) {
      context.notebook = button.dataset.selectNotebook
      target.projectView = 'notes'
    }
    const action = button.dataset.researchAction
    if (action === 'open-content') target.projectView = 'canvas'
    if (action === 'open-notes') target.projectView = 'notes'
    if (
      !(await this.go(
        new URL(projectLink(this.project.id, context, target), location.href)
      ))
    )
      return
    if (action && !['open-content', 'open-notes', 'open-chat'].includes(action))
      await this.app.researchWorkspace.command(button)
  }
  async go(url: URL, push = true): Promise<boolean> {
    if (this.app.capture.phase !== 'idle') {
      this.app.error(
        new Error(
          'Finish or cancel the recording before leaving this workspace.'
        )
      )
      return false
    }
    if (
      !this.app.researchWorkspace.isOpen &&
      !(await saveBeforeLeaving(this.app))
    )
      return false
    const revision = ++this.revision
    // Save the destination before dismissing a map, which clears its own URL.
    const destination = new URL(url.href)
    this.app.stopPractice()
    this.app.closeStream?.()
    this.app.closeStream = null
    this.app.mapCanvas.dismiss()
    this.app.templateGallery.dismiss()
    if (this.app.settingsScreen.isOpen) this.app.settingsScreen.close(true)
    this.app.root
      .querySelectorAll<HTMLMediaElement>('video,audio')
      .forEach((media) => media.pause())
    this.app.dialog?.close()
    this.researchRoot
      .querySelectorAll<HTMLDialogElement>('dialog[open]')
      .forEach((dialog) => dialog.close())
    this.app.opening.reset()
    this.app.researchWorkspace.suspend()
    if (push) history.pushState(null, '', destination)
    else history.replaceState(null, '', destination)
    const id = destination.searchParams.get('space')
    this.toggleSidebar(false)
    this.frame.classList.remove('project-standalone')
    if (!id || !destination.searchParams.has('detail')) {
      this.frame.hidden = true
      this.researchRoot.hidden = false
      if (id) await this.app.researchWorkspace.open(id)
      else await this.app.researchWorkspace.home()
      return true
    }
    this.researchRoot.hidden = true
    this.frame.hidden = false
    this.frame.setAttribute('aria-busy', 'true')
    this.app.snapshot = null
    this.editorRoot.innerHTML =
      '<div class="research-loading" role="status">Opening your workspace…</div>'
    try {
      const project = await researchApi.load(id)
      if (revision !== this.revision) return false
      this.project = project
      const notes = projectNotesTarget(destination, project.notebooks)
      if (notes) return this.go(new URL(notes, location.href), false)
      this.rendered = ''
      this.sync()
      const map = destination.searchParams.get('map')
      const notebook = destination.searchParams.get('notebook')
      if (map) await this.app.mapCanvas.open(map)
      else if (notebook) {
        this.app.stage =
          destination.searchParams.get('view') === 'video'
            ? 'video'
            : 'presentation'
        this.app.selected = 0
        this.app.selectedPlan = null
        await this.app.openNotebook(notebook)
      } else
        throw new Error('Choose a notebook or the project canvas to continue.')
    } catch (error) {
      if (revision === this.revision) {
        this.editorRoot.innerHTML = `<div class="research-loading" role="alert">${escape((error as Error).message)} <a href="${projectLink(id)}">Back to project</a></div>`
      }
    } finally {
      if (revision === this.revision) this.frame.removeAttribute('aria-busy')
    }
    return true
  }
  /** Engine updates keep the same project frame and update only its location. */
  sync(snapshot?: Snapshot, map = false) {
    const project = this.project
    if (!project || this.frame.hidden) return
    const context = projectContext(new URL(location.href))
    const isMap = map || this.app.mapCanvas.isOpen
    const id =
      snapshot?.project.id ||
      new URL(location.href).searchParams.get(isMap ? 'map' : 'notebook')
    const notebook = project.notebooks.find((n) => n.id === id)
    if (notebook) {
      context.notebook = notebook.id
      const url = new URL(location.href)
      url.searchParams.set('book', notebook.id)
      history.replaceState(null, '', url)
    }
    this.onLocation?.(project)
    const name = isMap
      ? notebook
        ? `${notebook.title} · Content map`
        : 'Project canvas'
      : notebook?.title || snapshot?.project.title || 'Content'
    const notes = projectLink(project.id, context, {
      projectView: notebook ? 'notes' : 'canvas'
    })
    const back = projectLink(
      project.id,
      { ...context, chatMinimized: false },
      { projectView: 'research' }
    )
    const markup = `<header class="project-chat-header project-tool-heading">
      <button class="project-sidebar-toggle" data-research-action="toggle-sidebar" aria-label="Toggle project navigation" aria-expanded="${this.frame.classList.contains('sidebar-open')}">☰</button>
      <div class="project-chat-title"><div class="project-tool-breadcrumb"><a href="${projectLink(project.id, context, { projectView: 'canvas' })}">${escape(project.title)}</a><span aria-hidden="true">/</span><h1>${escape(name)}</h1></div>
      <span class="project-tool-origin">${isMap ? (notebook ? 'Your notes → wireframes → episodes' : `Ideas from all ${project.notebooks.length} notebooks · one shared story`) : 'From your notebook · connected to your research'}</span></div>
      <div class="project-chat-actions"><a href="${notes}">${notebook ? 'Read notes' : 'All creations'}</a><a href="${back}" class="project-resume-chat">Resume chat ↗</a></div></header>`
    const key = markup + (notebook?.id || '')
    if (this.rendered === key) return
    this.rendered = key
    this.heading.innerHTML = markup
    this.sidebar.innerHTML =
      projectSidebar({
        project,
        notebook: notebook?.id || '',
        chat: null,
        contentOpen: true,
        documentExpanded: false
      }) +
      '<button class="project-sidebar-scrim" aria-label="Close project navigation" data-research-action="toggle-sidebar"></button>'
  }
}
