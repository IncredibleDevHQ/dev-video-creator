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
${escape(draft)}</textarea
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
