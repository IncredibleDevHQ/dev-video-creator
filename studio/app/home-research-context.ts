import './styles/home-composer.css'
import type { RepoInspection, RepoLink } from '../shared/repos'
import type { ResearchProjectView } from '../shared/research'
import { installAgentPickers, installRepositoryPicker } from './context-pickers'
import { destinationPicker, pickerIcons } from './destination-picker'
import { researchApi, researchRequest } from './research-api'
import { requestJson } from './http'
import { escape } from './ui'

const contexts = new WeakMap<
  HTMLFormElement,
  { repos: RepoLink[]; pending: boolean; path: string; createdProject?: string }
>()
export const homeResearchControls =
  () => `<input type="hidden" name="intent" value="ask" />
<div class="home-compose-intent" role="group" aria-label="What would you like to do?">
<button type="button" data-home-intent="ask" aria-pressed="true">Ask AI</button><button type="button" data-home-intent="note" aria-pressed="false">Save a note</button></div>`
export const homeResearchContext = () => `<div class="home-research-context">
<div class="home-agent-fields"><div><label for="home-agent">Agent</label><select id="home-agent" name="adapter"><option value="claude-code">Claude Code</option><option value="kimi">Kimi</option><option value="codex">Codex</option></select></div><div><label for="home-model">Model</label><input id="home-model" name="model" placeholder="Agent default" /></div></div>
<div class="home-primary-repository" hidden></div>
<details class="home-repositories"><summary>${pickerIcons.repo}<span>Additional repositories</span><small>Optional</small></summary>
<p>Add other repositories when your research spans more than one codebase.</p>
<div class="home-repo-list"></div><div class="home-repo-picker"><input id="home-repo-path" aria-label="Repository folder" /></div>
<div class="home-repo-branch" hidden><label for="home-repo-branch">Branch</label><div><select id="home-repo-branch"></select><button type="button" data-home-add-repo>Add to chat</button></div></div>
<small class="home-repo-status" role="status"></small></details></div>`

export const installHomeResearch = (root: HTMLElement) => {
  const form = root.querySelector<HTMLFormElement>('#research-start-form')!
  const state = { repos: [] as RepoLink[], pending: false, path: '' }
  contexts.set(form, state)
  installAgentPickers(root, 'home-agent', 'home-model')
  const branch = form.querySelector<HTMLSelectElement>('#home-repo-branch')!
  destinationPicker(branch, 'branch')
  const status = form.querySelector<HTMLElement>('.home-repo-status')!
  const branchPanel = form.querySelector<HTMLElement>('.home-repo-branch')!
  let inspected: RepoInspection | null = null
  let revision = 0
  let projectRevision = 0
  let primaryPath = ''
  const apply = (repo: RepoInspection) => {
    revision++
    state.pending = false
    inspected = repo
    branch.replaceChildren(
      ...repo.branches.map(
        (value) => new Option(value, value, false, value === repo.current)
      )
    )
    branchPanel.hidden = false
    status.textContent = ''
  }
  const repo = installRepositoryPicker(
    form.querySelector<HTMLInputElement>('#home-repo-path')!,
    [],
    apply
  )
  repo.addEventListener('change', async (event) => {
    const current = ++revision
    state.path = repo.value
    inspected = null
    branchPanel.hidden = true
    state.pending = Boolean(repo.value)
    status.textContent = repo.value ? 'Finding branches…' : ''
    if (!repo.value) return
    if (event instanceof CustomEvent && event.detail?.repository) {
      apply(event.detail.repository)
      return
    }
    try {
      const result = await requestJson<RepoInspection>('/api/repos/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: repo.value })
      })
      if (current === revision) apply(result)
    } catch (error) {
      if (current === revision) {
        state.pending = false
        status.textContent =
          error instanceof Error
            ? error.message
            : 'Could not inspect this repository.'
      }
    }
  })
  const drawRepos = () => {
    form.querySelector('.home-repo-list')!.innerHTML = state.repos
      .map(
        (item, index) =>
          `<div ${item.path === primaryPath && index === 0 ? 'hidden' : ''}>${pickerIcons.repo}<span>${escape(item.name)}<small>${pickerIcons.branch}${escape(item.branch)}</small></span><button type="button" data-home-remove-repo="${index}" aria-label="Remove ${escape(item.name)}">×</button></div>`
      )
      .join('')
    const extra = state.repos.length - (primaryPath ? 1 : 0)
    form.querySelector('.home-repositories summary span')!.textContent =
      extra > 0
        ? `${extra} additional ${extra === 1 ? 'repository' : 'repositories'}`
        : 'Additional repositories'
  }
  root.addEventListener('home-project-context', (event) => {
    const project = (event as CustomEvent<ResearchProjectView | null>).detail
    const current = ++projectRevision
    const context = contexts.get(form)
    if (context) context.createdProject = undefined
    primaryPath = project?.repository?.path || ''
    state.repos = project?.repository
      ? [structuredClone(project.repository)]
      : []
    repo.value = ''
    repo.dispatchEvent(new Event('change', { bubbles: true }))
    drawRepos()
    const primary = form.querySelector<HTMLElement>('.home-primary-repository')!
    primary.hidden = !project?.repository
    primary.replaceChildren()
    if (!project?.repository) return
    const linked = project.repository
    primary.innerHTML = `<div>${pickerIcons.repo}<span><strong>${escape(linked.name)}</strong><small>${escape(linked.path)}</small></span><div class="home-repository-actions"><button type="button" data-home-change-project>Change repository</button><button type="button" data-home-clear-project title="Clear the selection without deleting the project">Clear selection</button></div></div><label for="home-project-branch">Branch for this chat</label><select id="home-project-branch"><option value="${escape(linked.branch)}">${escape(linked.branch)}</option></select><small class="home-primary-status" role="status">Loading branches…</small>`
    const select = primary.querySelector<HTMLSelectElement>('select')!
    destinationPicker(select, 'branch')
    select.addEventListener('change', () => {
      if (state.repos[0]?.path === linked.path)
        state.repos[0].branch = select.value
    })
    void requestJson<RepoInspection>('/api/repos/inspect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: linked.path })
    })
      .then((found) => {
        if (current !== projectRevision) return
        const chosen = found.branches.includes(linked.branch)
          ? linked.branch
          : found.branches.includes(found.current)
            ? found.current
            : found.base
        select.replaceChildren(
          ...found.branches.map(
            (branch) => new Option(branch, branch, false, branch === chosen)
          )
        )
        if (state.repos[0]) state.repos[0].branch = select.value
        primary.querySelector('.home-primary-status')!.textContent =
          'Inherited from this project. Branch changes apply to this chat.'
      })
      .catch(() => {
        if (current === projectRevision)
          primary.querySelector('.home-primary-status')!.textContent =
            'Could not refresh branches. Check that the repository folder is available.'
      })
  })
  form.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      'button'
    )
    if (!button) return
    if (button.dataset.homeIntent) {
      const ask = button.dataset.homeIntent === 'ask'
      form.dataset.intent = ask ? 'ask' : 'note'
      form.querySelector<HTMLInputElement>('[name="intent"]')!.value = ask
        ? 'ask'
        : 'note'
      form
        .querySelectorAll<HTMLElement>('[data-home-intent]')
        .forEach((item) =>
          item.setAttribute('aria-pressed', String(item === button))
        )
      form.querySelector<HTMLElement>('.home-research-context')!.hidden = false
      form.querySelector<HTMLTextAreaElement>('textarea')!.placeholder = ask
        ? 'Ask a question, explore an idea, or research your code…'
        : 'Paste a note, an idea, something you’re learning…'
      form.querySelector<HTMLButtonElement>(
        'button[type="submit"]'
      )!.textContent = ask ? 'Start chat ↑' : 'Save note →'
    }
    if (button.hasAttribute('data-home-add-repo') && inspected) {
      if (state.repos.length >= 4) {
        status.textContent = 'You can add up to four repositories.'
        return
      }
      if (!branch.value) {
        status.textContent = 'Choose a branch before adding this repository.'
        return
      }
      if (
        !state.repos.some(
          (item) =>
            item.path === inspected!.path && item.branch === branch.value
        )
      )
        state.repos.push({
          path: inspected.path,
          name: inspected.name,
          base: inspected.base,
          branch: branch.value
        })
      repo.value = ''
      repo.dispatchEvent(new Event('change', { bubbles: true }))
      drawRepos()
    }
    if (button.dataset.homeRemoveRepo !== undefined) {
      state.repos.splice(Number(button.dataset.homeRemoveRepo), 1)
      drawRepos()
    }
  })
}

export const startHomeResearch = async (
  form: HTMLFormElement,
  values: FormData
) => {
  const context = contexts.get(form)!
  if (form.dataset.repositoryPicking)
    throw new Error('Finish choosing a repository folder first.')
  if (context.pending)
    throw new Error('Wait for the repository’s branches to load.')
  if (context.path)
    throw new Error(
      'Choose a branch and add the repository to this chat, or clear the folder selection.'
    )
  const id = String(values.get('projectId') || context.createdProject || '')
  if (!id) throw new Error('Open a repository to start your project.')
  const project = await researchApi.load(id)
  if (!project.repository)
    throw new Error('Open a repository to start your project.')
  const notebookId = String(
    values.get('notebookId') || project.notebooks[0]?.id || ''
  )
  if (!project.notebooks.some((book) => book.id === notebookId))
    throw new Error('Choose a notebook in this project.')
  return researchRequest<{ nodeId: string; project: ResearchProjectView }>(
    `/${project.id}/ask`,
    {
      question: values.get('text'),
      notebookId,
      parentId: null,
      harness: {
        adapter: values.get('adapter'),
        ...(values.get('model') ? { model: values.get('model') } : {})
      },
      repos: context.repos
    }
  )
}
