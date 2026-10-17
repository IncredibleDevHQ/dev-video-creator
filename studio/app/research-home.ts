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
      <h1>Start with a thought.<br /><em>See where it takes you.</em></h1>
      <p>
        Collect notes. Explore questions. Turn what you learn into a series.
      </p>
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
      <section class="research-project-list">
        <div class="research-section-heading">
          <h2>Your projects</h2>
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
                ><span class="research-project-symbol">▤</span>
                <h3>${escape(p.title)}</h3>
                <p>
                  ${p.notebooks} ${p.notebooks === 1 ? 'notebook' : 'notebooks'}
                  · ${p.questions} research questions
                </p>
                <span>Open project ↗</span></a
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
  const destination = root.querySelector('#research-note-destination')!
  if (projects.length)
    destination.innerHTML = html`<label class="research-save-to"
      >Save to
      <select name="projectId" aria-label="Save note to project">
        ${projects
          .map((p) => html`<option value="${p.id}">${escape(p.title)}</option>`)
          .join('')}
        <option value="">＋ New project</option>
      </select></label
    >`
}
export const saveHomeNote = async (values: FormData) => {
  const id = String(values.get('projectId') || '')
  const text = values.get('text')
  if (!id) return researchApi.create({ text })
  const project = await researchApi.load(id)
  return researchApi.change(id, 'notes', {
    notebookId: project.notebooks[0].id,
    text
  })
}
