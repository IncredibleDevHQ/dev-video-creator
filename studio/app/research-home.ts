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
      <h2 class="home-capture-heading">Save a note</h2>
      <form id="research-start-form">
        <label class="sr" for="research-first-note">Your note</label
        ><textarea
          id="research-first-note"
          name="text"
          rows="5"
          maxlength="7600"
          placeholder="Paste a note, an idea, something you’re learning…"
          required
        >
${escape(draft)}</textarea
        >
        <div class="research-composer-footer">
          <span id="research-note-destination"
            ><small
              >We’ll create a project and your first notebook.</small
            ></span
          ><button class="research-primary" disabled>Save note →</button>
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
              A project keeps the notebooks, research chats and videos for one
              topic together.
            </p>
          </div>
          <button data-research-action="new-project">+ New project</button>
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
    : '<p>Your first project starts with the note above. No setup needed.</p>'

/** Returning users can capture a note without making another project. */
export const populateResearchHome = (
  root: HTMLElement,
  projects: ResearchProjectSummary[]
) => {
  root.querySelector<HTMLButtonElement>(
    '#research-start-form button'
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
  if (projects.length)
    destination.innerHTML = html`<div class="home-destination-fields">
        <label class="research-save-to"
          >Project
          <select name="projectId" aria-label="Save note to project">
            ${projects
              .map(
                (p) => html`<option value="${p.id}">${escape(p.title)}</option>`
              )
              .join('')}
            <option value="">＋ New project</option>
          </select></label
        ><label class="research-save-to"
          >Notebook
          <select
            name="notebookId"
            aria-label="Save note to notebook"
            required
          ></select
        ></label>
      </div>
      <small class="home-destination-status" role="status"></small>`
  if (projects.length) setupHomeDestination(root)
}

const setupHomeDestination = (root: HTMLElement) => {
  const project = root.querySelector<HTMLSelectElement>('[name="projectId"]')!
  const notebook = root.querySelector<HTMLSelectElement>('[name="notebookId"]')!
  const status = root.querySelector<HTMLElement>('.home-destination-status')!
  const submit = root.querySelector<HTMLButtonElement>(
    '#research-start-form button'
  )!
  let revision = 0
  const update = async () => {
    const current = ++revision
    submit.disabled = true
    notebook.disabled = true
    notebook.innerHTML = '<option value="">Loading notebooks…</option>'
    status.textContent = ''
    if (!project.value) {
      notebook.innerHTML = '<option value="">First notebook</option>'
      status.textContent =
        'We’ll create a project and its first notebook from your note.'
      submit.disabled = false
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
      notebook.disabled = false
      submit.disabled = !result.notebooks.length
      status.textContent =
        'Notebooks group related notes inside a project. Save opens this notebook.'
    } catch {
      if (current !== revision) return
      notebook.innerHTML = '<option value="">Could not load notebooks</option>'
      status.textContent =
        'Choose the project again to retry. Your note is still here.'
    }
  }
  project.addEventListener('change', () => void update())
  void update()
}
export const saveHomeNote = async (values: FormData) => {
  const id = String(values.get('projectId') || '')
  const text = values.get('text')
  if (!id) return researchApi.create({ text })
  const project = await researchApi.load(id)
  const notebookId = String(values.get('notebookId') || project.notebooks[0].id)
  if (!project.notebooks.some((n) => n.id === notebookId))
    throw new Error('Choose a notebook in this project before saving.')
  return researchApi.change(id, 'notes', {
    notebookId,
    text
  })
}
