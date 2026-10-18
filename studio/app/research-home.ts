import { openPopover, closePopover } from './popover'
import './styles/home-radio.css'
import { chooseRepositoryProject } from './repository-project'
import {
  homeResearchControls,
  homeResearchContext,
  installHomeResearch
} from './home-research-context'
import { destinationPicker } from './destination-picker'
import { researchApi } from './research-api'
import { html } from '../shared/html'
import { escape } from './ui'
import type { ResearchProjectSummary } from '../shared/research'
import incredibleLogo from './assets/incredible-logo.svg'
export const researchHome = (draft: string) =>
  html`<div class="research-home">
    <header class="research-header">
      <a
        href="/"
        class="research-brand"
        aria-label="Incredible Studio: all projects"
        ><img src="${incredibleLogo}" alt="" /><span>Incredible</span></a
      >
      <details class="research-home-tools">
        <summary>More</summary>
        <a href="/?legacy=1">Earlier notebooks & studio tools ↗</a>
      </details>
    </header>
    <main>
      <span class="research-eyebrow">A PLACE FOR YOUR CURIOSITY</span>
      <h1>What are you learning?</h1>
      <p>
        Save what you learn, explore it in chat, and turn your notes into
        videos.
      </p>

      <form id="research-start-form" data-intent="ask">
        <div class="radio-faceplate" aria-hidden="true">
          <span class="radio-maker">Incredible</span
          ><span class="radio-series">Research receiver · Model 01</span
          ><span class="radio-power"></span>
        </div>
        <div class="radio-tuning-scale" aria-hidden="true">
          <span>88</span><span>92</span><span>96</span><span>100</span
          ><span>104</span><span>108</span>
        </div>
        ${homeResearchControls()}
        <label class="sr" for="research-first-note">Your question or note</label
        ><textarea
          id="research-first-note"
          name="text"
          rows="5"
          maxlength="7600"
          placeholder="Ask a question, explore an idea, or research your code…"
          required
        >
${escape(draft)}</textarea
        >
        ${homeResearchContext()}
        <div class="research-composer-footer">
          <span id="research-note-destination"
            ><small>Open a repository to start your project.</small></span
          ><button type="submit" class="research-primary" disabled>
            Start chat ↑
          </button>
        </div>
      </form>
      <div class="research-home-error" role="alert"></div>
      <section
        id="workspace-continue"
        aria-label="Recently opened work"
      ></section>
      <section class="research-project-list">
        <div class="research-section-heading">
          <div>
            <h2>Your projects</h2>
            <p class="home-section-help">
              Each repository is a project. Its chats, notebooks and videos stay
              together.
            </p>
          </div>
          <button data-research-action="new-project">+ Open repository</button>
        </div>
        <div id="research-projects" role="status">Loading your projects…</div>
      </section>
    </main>
  </div>`
export const researchProjectCards = (projects: ResearchProjectSummary[]) =>
  projects.length
    ? html`<div class="research-project-grid">
        ${projects
          .map(
            (p) =>
              html`<a class="research-project-card" href="/?space=${p.id}"
                ><span class="research-project-symbol" aria-hidden="true"
                  >▤</span
                >
                <h3>${escape(p.title)}</h3>
                <p>
                  ${p.notebooks} ${p.notebooks === 1 ? 'notebook' : 'notebooks'}
                </p>
                <span class="home-project-open">Open project →</span></a
              >`
          )
          .join('')}
      </div>`
    : '<p>Start by opening a local repository. Your chats, notes and content stay together in its project.</p>'

/** Returning users can capture a note without making another project. */
export const populateResearchHome = (
  root: HTMLElement,
  projects: ResearchProjectSummary[]
) => {
  projects = projects.filter((project) => project.repository)
  root.querySelector<HTMLButtonElement>(
    '#research-start-form button[type="submit"]'
  )!.disabled = false
  root.querySelector('#research-projects')!.innerHTML =
    researchProjectCards(projects)
  if (projects.length) {
    root
      .querySelector('.research-home')
      ?.classList.add('workspace-home-returning')
    root.querySelector('h1')!.textContent = 'What are you learning?'
    root.querySelector('main > p')!.textContent =
      'Save what you learn, explore it in chat, and turn your notes into videos.'
    root.querySelector<HTMLTextAreaElement>('textarea')!.rows = 3
  }
  const destination = root.querySelector('#research-note-destination')!
  destination.innerHTML = html`<div class="home-destination-fields">
      <div class="research-save-to home-project-value" hidden>
        Project
        <select name="projectId" aria-label="Save note to project">
          ${projects
            .map(
              (p) => html`<option value="${p.id}">${escape(p.title)}</option>`
            )
            .join('')}
          <option value="">Choose a repository…</option>
        </select>
      </div>
      <div class="research-save-to home-note-destination">
        Notebook
        <select
          name="notebookId"
          aria-label="Save note to notebook"
          required
        ></select>
      </div>
    </div>
    <small class="home-destination-status" role="status"></small>`
  if (!projects.length) {
    root.querySelector('h1')!.textContent = 'Start with your repository'
    root.querySelector('main > p')!.textContent =
      'Choose a local repository and branch. Then chat, explore, and save what you learn.'
    root.querySelector('.research-home')!.classList.add('home-first-project')
  }
  installHomeResearch(root)
  setupHomeDestination(root, projects)
}

const setupHomeDestination = (
  root: HTMLElement,
  projects: ResearchProjectSummary[]
) => {
  const project = root.querySelector<HTMLSelectElement>('[name="projectId"]')!
  const notebook = root.querySelector<HTMLSelectElement>('[name="notebookId"]')!
  const status = root.querySelector<HTMLElement>('.home-destination-status')!
  const submit = root.querySelector<HTMLButtonElement>(
    '#research-start-form button[type="submit"]'
  )!
  const locationParams = new URL(location.href).searchParams
  const requested = locationParams.get('space')
  if (locationParams.has('chooseRepository')) project.value = ''
  if (requested && projects.some((item) => item.id === requested))
    project.value = requested
  const syncNotebook = destinationPicker(notebook, 'notebook')
  let revision = 0
  const update = async () => {
    const current = ++revision
    submit.disabled = true
    notebook.disabled = true
    notebook.innerHTML = '<option value="">Loading notebooks…</option>'
    syncNotebook()
    status.textContent = ''
    root.dispatchEvent(
      new CustomEvent('home-project-context', { detail: null })
    )
    if (!project.value) {
      browse.hidden = false
      root.querySelector('.research-home')!.classList.add('home-first-project')
      root.querySelector('h1')!.textContent = 'Start with your repository'
      root.querySelector('main > p')!.textContent =
        'Choose a local repository and branch. Then chat, explore, and save what you learn.'
      notebook.innerHTML = '<option value="">First notebook</option>'
      status.textContent =
        'Open a local repository and choose its branch to start chatting.'
      submit.disabled = true
      syncNotebook()
      return
    }
    try {
      const result = await researchApi.load(project.value)
      if (current !== revision) return
      notebook.innerHTML = result.notebooks
        .map(
          (n) => `<option value="${escape(n.id)}">${escape(n.title)}</option>`
        )
        .join('')
      root.dispatchEvent(
        new CustomEvent('home-project-context', { detail: result })
      )
      browse.hidden = true
      root
        .querySelector('.research-home')!
        .classList.remove('home-first-project')
      root.querySelector('h1')!.textContent = `Explore ${result.title}`
      root.querySelector('main > p')!.textContent =
        'Ask a question about your code. Save useful discoveries as notes as you go.'
      notebook.disabled = !result.notebooks.length
      submit.disabled = !result.notebooks.length
      status.textContent = result.notebooks.length
        ? ''
        : 'This project has no notebooks. Open the project to add one, or choose another project.'
    } catch {
      if (current !== revision) return
      browse.hidden = false
      notebook.innerHTML = '<option value="">Could not load notebooks</option>'
      status.textContent =
        'Choose the project again to retry. Your note is still here.'
    } finally {
      if (current === revision) syncNotebook()
    }
  }
  const browse = document.createElement('button')
  browse.type = 'button'
  browse.className = 'home-open-repository'
  browse.textContent = 'Open repository…'
  browse.hidden = Boolean(project.value)
  root.querySelector('#research-note-destination')!.append(browse)
  browse.addEventListener('click', async () => {
    if (browse.disabled) return
    browse.disabled = true
    const form = project.closest('form')!
    form.dataset.repositoryPicking = 'true'
    status.textContent = 'Choose a repository folder…'
    try {
      const opened = await chooseRepositoryProject()
      if (!opened || !project.isConnected) {
        status.textContent = ''
        return
      }
      if (
        !Array.from(project.options).some(
          (option) => option.value === opened.id
        )
      )
        project.add(new Option(opened.title, opened.id))
      root
        .querySelector('.research-home')!
        .classList.remove('home-first-project')
      root.querySelector('h1')!.textContent = `Explore ${opened.title}`
      browse.hidden = true
      project.value = opened.id
      const option = project.selectedOptions[0]
      option.dataset.detail = opened.repository?.path || ''
      selectProject(opened.id)
      root.querySelector<HTMLTextAreaElement>('textarea')?.focus()
      root.dispatchEvent(
        new CustomEvent('repository-project-opened', {
          bubbles: true,
          detail: opened
        })
      )
    } catch (error) {
      status.textContent =
        error instanceof Error
          ? error.message
          : 'Could not open the repository project.'
    } finally {
      browse.disabled = false
      delete form.dataset.repositoryPicking
    }
  })
  const selectProject = (id: string) => {
    project.value = id
    const url = new URL(location.href)
    for (const key of [
      'space',
      'book',
      'notebook',
      'chat',
      'node',
      'projectView',
      'chooseRepository'
    ])
      url.searchParams.delete(key)
    if (id) {
      url.searchParams.set('space', id)
      url.searchParams.set('chat', 'new')
      url.searchParams.set('projectView', 'research')
    } else url.searchParams.set('chooseRepository', '1')
    history.replaceState(null, '', url)
    void update()
  }
  root.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      'button'
    )
    if (!button || project.closest('form')!.dataset.repositoryPicking) return
    if (button.hasAttribute('data-home-clear-project')) {
      selectProject('')
      browse.focus()
    }
    if (button.hasAttribute('data-home-change-project')) {
      const menu = openPopover(
        button,
        'home-change-project',
        `<h3>Change repository</h3><label for="home-existing-project">Your repositories</label><select id="home-existing-project">${Array.from(
          project.options
        )
          .filter((option) => option.value)
          .map(
            (option) =>
              `<option value="${escape(option.value)}" ${option.value === project.value ? 'selected' : ''}>${escape(option.text)}</option>`
          )
          .join(
            ''
          )}</select><button type="button" data-browse-project>Open another repository…</button>`,
        'home-project-switcher'
      )
      if (!menu) return
      menu.setAttribute('aria-label', 'Change repository')
      const select = menu.querySelector<HTMLSelectElement>('select')!
      destinationPicker(select, 'project')
      select.addEventListener('change', () => {
        closePopover()
        selectProject(select.value)
      })
      menu
        .querySelector<HTMLButtonElement>('[data-browse-project]')!
        .addEventListener('click', () => {
          closePopover()
          browse.click()
        })
    }
  })
  project.addEventListener('change', () => selectProject(project.value))
  void update()
}
export const saveHomeNote = async (values: FormData) => {
  const id = String(values.get('projectId') || '')
  const text = values.get('text')
  if (!id) throw new Error('Open a repository before saving notes.')
  const project = await researchApi.load(id)
  const notebookId = String(
    values.get('notebookId') || project.notebooks[0]?.id || ''
  )
  if (!project.notebooks.some((n) => n.id === notebookId))
    throw new Error('Choose a notebook in this project before saving.')
  return researchApi.change(id, 'notes', {
    notebookId,
    text
  })
}
