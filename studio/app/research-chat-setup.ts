import { chooseRepositoryProject } from './repository-project'
import { destinationPicker } from './destination-picker'
import {
  installAgentPickers,
  installRepositoryPicker,
  rememberRepository
} from './context-pickers'
import { closePopover } from './popover'
import { html } from '../shared/html'
import type { ResearchProjectView } from '../shared/research'
import type { RepoInspection, RepoLink } from '../shared/repos'
import type { ResearchViewState } from './research-view'
import { researchApi } from './research-api'
import { requestJson } from './http'
import { escape } from './ui'

type Result = { project: ResearchProjectView; chatId: string }

/** A chat is created only after its complete context has been chosen. */
export const researchChatSetup = async (
  root: HTMLElement,
  state: ResearchViewState,
  edit = false
): Promise<Result | null> => {
  const projects = await researchApi.list()
  const current = edit
    ? state.project.chats?.find((c) => c.id === state.chat)
    : undefined
  let project = state.project
  let repos: RepoLink[] = structuredClone(
    current?.repos || (project.repository ? [project.repository] : [])
  )
  let inspected: RepoInspection | null = null
  let busy = false
  let inspecting = false
  let projectLoad = 0
  const dialog = document.createElement('dialog')
  dialog.className = 'chat-setup'
  dialog.setAttribute('aria-labelledby', 'chat-setup-heading')
  dialog.innerHTML = html`<form id="chat-setup-form">
    <header>
      <div>
        <h2 id="chat-setup-heading">
          ${edit ? 'Chat details' : 'Start a chat'}
        </h2>
        <p>Explore together. Keep what you learn in your notebook.</p>
      </div>
      <button type="button" data-close aria-label="Close chat setup">×</button>
    </header>
    <div class="chat-setup-body">
      <label for="chat-title">Chat name</label>
      <input
        id="chat-title"
        name="title"
        placeholder="What are you exploring?"
        value="${escape(current?.title || '')}"
        maxlength="160"
        required
      />
      <p class="chat-setup-default">
        In ${escape(project.title)} · saves to
        ${escape(
          project.notebooks.find(
            (n) => n.id === (current?.notebookId || state.notebook)
          )?.title || 'your notebook'
        )}
      </p>
      <details class="chat-setup-options" ${edit ? 'open' : ''}>
        <summary>Project, notebook & agent</summary>
        <div class="chat-setup-pair">
          <div>
            <label for="chat-project">Project</label>
            <select id="chat-project" ${edit ? 'disabled' : ''}>
              ${projects
                .map(
                  (p) =>
                    html`<option
                      value="${p.id}"
                      ${p.id === project.id ? 'selected' : ''}
                    >
                      ${escape(p.title)}
                    </option>`
                )
                .join('')}
              <option value="new">Open repository…</option>
            </select>
          </div>
          <div>
            <label for="chat-notebook">Save notes to</label
            ><select id="chat-notebook"></select>
          </div>
        </div>
        <div id="chat-new-notebook" hidden>
          <label for="chat-notebook-title">New notebook name</label
          ><input
            id="chat-notebook-title"
            maxlength="160"
            placeholder="Research notes"
          />
        </div>
        <p class="chat-setup-hint">
          Notebooks organize your notes. The project brings them together into
          one shared canvas.
        </p>
        <div class="chat-setup-pair">
          <div>
            <label for="chat-agent">Agent</label
            ><select id="chat-agent">
              ${[
                ['kimi', 'Kimi'],
                ['claude-code', 'Claude Code'],
                ['codex', 'Codex']
              ]
                .map(
                  ([id, name]) =>
                    html`<option
                      value="${id}"
                      ${id === (current?.harness?.adapter || state.adapter)
                        ? 'selected'
                        : ''}
                    >
                      ${name}
                    </option>`
                )
                .join('')}
            </select>
          </div>
          <div>
            <label for="chat-model">Model</label
            ><input
              id="chat-model"
              maxlength="200"
              placeholder="Agent default"
              value="${escape(current?.harness?.model || state.model)}"
            />
          </div>
        </div>
      </details>
      <details class="chat-setup-repos" ${repos.length ? 'open' : ''}>
        <summary>Add repositories <span>optional</span></summary>
        <p>
          Point the agent at local repositories and branches. You can change
          these later.
        </p>
        <div id="chat-repo-list"></div>
        <label for="chat-repo-path">Local repository folder</label>
        <div class="chat-repo-add">
          <input id="chat-repo-path" placeholder="/path/to/repository" /><button
            type="button"
            data-inspect
          >
            Find branches
          </button>
        </div>
        <div id="chat-repo-branch" hidden>
          <label for="chat-branch">Branch</label>
          <div class="chat-repo-add">
            <select id="chat-branch"></select
            ><button type="button" data-add-repo>Add repository</button>
          </div>
        </div>
      </details>
      <p role="alert" id="chat-setup-error" hidden></p>
    </div>
    <footer>
      <button type="button" data-close>Cancel</button
      ><button type="submit" class="research-primary">
        ${edit ? 'Save changes' : 'Create chat'}
      </button>
    </footer>
  </form>`
  root.append(dialog)
  const field = <T extends HTMLElement = HTMLInputElement>(id: string) =>
    dialog.querySelector<T>(`#${id}`)!
  const notebook = field<HTMLSelectElement>('chat-notebook')
  const projectPicker = field<HTMLSelectElement>('chat-project')
  const error = (value: unknown) => {
    const target = field('chat-setup-error')
    target.textContent = value instanceof Error ? value.message : String(value)
    target.hidden = false
  }
  const updateNotebook = (selected = '') => {
    notebook.innerHTML =
      projectPicker.value === 'new'
        ? '<option value="new">New notebook</option>'
        : project.notebooks
            .map(
              (n) =>
                html`<option
                  value="${n.id}"
                  ${n.id === selected ? 'selected' : ''}
                >
                  ${escape(n.title)}
                </option>`
            )
            .join('') + '<option value="new">+ New notebook</option>'
    field('chat-new-notebook').hidden = notebook.value !== 'new'
    field('chat-notebook-title').required = notebook.value === 'new'
  }
  const updateRepos = () => {
    field('chat-repo-list').innerHTML = repos
      .map(
        (r, i) =>
          html`<div class="chat-repo-row">
            <span
              ><strong>${escape(r.name)}</strong
              ><small>${escape(r.branch)}</small></span
            ><button
              type="button"
              data-remove-repo="${i}"
              aria-label="Remove ${escape(r.name)} repository"
            >
              ×
            </button>
          </div>`
      )
      .join('')
    dialog.querySelector<HTMLButtonElement>('[data-inspect]')!.disabled =
      repos.length >= 4
  }
  updateNotebook(current?.notebookId || state.notebook)
  updateRepos()
  destinationPicker(projectPicker, 'project')
  destinationPicker(notebook, 'notebook')
  destinationPicker(field<HTMLSelectElement>('chat-branch'), 'branch')
  installAgentPickers(dialog, 'chat-agent', 'chat-model')
  const applyRepository = (repo: RepoInspection) => {
    inspected = repo
    rememberRepository(repo.path)
    field<HTMLSelectElement>('chat-branch').replaceChildren(
      ...repo.branches.map(
        (branch) => new Option(branch, branch, false, branch === repo.current)
      )
    )
    field('chat-repo-branch').hidden = false
  }
  installRepositoryPicker(
    field('chat-repo-path'),
    [...state.repos, ...repos],
    applyRepository
  )
  const updateSummary = () => {
    dialog.querySelector('.chat-setup-default')!.textContent =
      `In ${projectPicker.selectedOptions[0]?.textContent?.trim()} · saves to ${notebook.selectedOptions[0]?.textContent?.trim()}`
  }
  dialog.addEventListener(
    'invalid',
    (event) => {
      ;(event.target as HTMLElement)
        .closest('details')
        ?.setAttribute('open', '')
    },
    true
  )
  dialog.addEventListener('change', async (event) => {
    const target = event.target as HTMLInputElement
    if (target.id === 'chat-project') {
      const revision = ++projectLoad
      const fresh = projectPicker.value === 'new'
      notebook.disabled = true
      try {
        const loaded = fresh
          ? await chooseRepositoryProject()
          : await researchApi.load(projectPicker.value)
        if (revision !== projectLoad || !dialog.isConnected) return
        if (!loaded) {
          projectPicker.value = project.id
          projectPicker.dispatchEvent(new Event('picker-sync'))
          return
        }
        if (fresh) {
          if (
            !Array.from(projectPicker.options).some(
              (option) => option.value === loaded.id
            )
          )
            projectPicker.add(new Option(loaded.title, loaded.id))
          projectPicker.value = loaded.id
          projectPicker.dispatchEvent(new Event('picker-sync'))
          root.dispatchEvent(
            new CustomEvent('repository-project-opened', {
              bubbles: true,
              detail: loaded
            })
          )
        }
        if (revision !== projectLoad) return
        project = loaded
        if (!edit) {
          repos = project.repository
            ? [structuredClone(project.repository)]
            : []
          updateRepos()
        }
        updateNotebook()
      } catch (e) {
        if (revision === projectLoad) {
          projectPicker.value = project.id
          projectPicker.dispatchEvent(new Event('picker-sync'))
          updateNotebook()
          error(e)
        }
      } finally {
        if (revision === projectLoad) notebook.disabled = false
      }
    }
    if (target.id === 'chat-notebook') {
      field('chat-new-notebook').hidden = notebook.value !== 'new'
      field('chat-notebook-title').required = notebook.value === 'new'
    }
    updateSummary()
  })
  dialog.addEventListener('input', (event) => {
    if ((event.target as HTMLElement).id === 'chat-repo-path') {
      inspected = null
      field('chat-repo-branch').hidden = true
    }
  })
  let finish: (result: Result | null) => void
  const result = new Promise<Result | null>((resolve) => {
    finish = resolve
  })
  dialog.addEventListener('cancel', (event) => {
    if (busy) event.preventDefault()
  })
  dialog.addEventListener(
    'close',
    () => {
      closePopover()
      finish(null)
      dialog.remove()
    },
    { once: true }
  )
  dialog.addEventListener('click', async (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      'button'
    )
    if (!button || busy) return
    if (button.hasAttribute('data-close')) {
      dialog.close()
      return
    }
    if (button.dataset.removeRepo !== undefined) {
      repos.splice(Number(button.dataset.removeRepo), 1)
      updateRepos()
    }
    if (button.hasAttribute('data-inspect')) {
      inspected = null
      field('chat-repo-branch').hidden = true
      inspecting = true
      button.disabled = true
      try {
        const requestedPath = field('chat-repo-path').value
        const result = await requestJson<RepoInspection>('/api/repos/inspect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: requestedPath })
        })
        if (field('chat-repo-path').value !== requestedPath) return
        applyRepository(result)
      } catch (e) {
        error(e)
      } finally {
        inspecting = false
        button.disabled = false
      }
    }
    if (button.hasAttribute('data-add-repo') && inspected) {
      const branch = field<HTMLSelectElement>('chat-branch').value
      if (
        repos.length < 4 &&
        !repos.some((r) => r.path === inspected!.path && r.branch === branch)
      )
        repos.push({
          path: inspected.path,
          name: inspected.name,
          base: inspected.base,
          branch
        })
      inspected = null
      field('chat-repo-branch').hidden = true
      const repoField = field<HTMLSelectElement>('chat-repo-path')
      repoField.value = ''
      repoField.dispatchEvent(new Event('change', { bubbles: true }))
      updateRepos()
    }
  })
  dialog.querySelector('form')!.addEventListener('submit', async (event) => {
    event.preventDefault()
    event.stopPropagation()
    if (busy || notebook.disabled) return
    if (inspecting || dialog.querySelector('form')!.dataset.repositoryPicking) {
      error('Wait for repository inspection to finish.')
      return
    }
    if (field('chat-repo-path').value.trim() || inspected) {
      error(
        'Add the repository to this chat, or clear its folder before continuing.'
      )
      return
    }
    if (!field('chat-title').value.trim()) {
      error('Give this chat a name.')
      return
    }
    busy = true
    field('chat-setup-error').hidden = true
    const controls = [
      ...dialog.querySelectorAll<HTMLInputElement>('input,select,button')
    ]
    const enabled = controls.filter((c) => !c.disabled)
    enabled.forEach((c) => {
      c.disabled = true
    })
    try {
      if (notebook.value === 'new') {
        project = await researchApi.change(project.id, 'notebooks', {
          title: field('chat-notebook-title').value
        })
        updateNotebook(project.notebooks.at(-1)!.id)
      }
      project = await researchApi.change(project.id, 'chats', {
        ...(current ? { chatId: current.id } : {}),
        title: field('chat-title').value,
        notebookId: notebook.value,
        repos,
        harness: {
          adapter: field<HTMLSelectElement>('chat-agent').value,
          ...(field('chat-model').value.trim()
            ? { model: field('chat-model').value.trim() }
            : {})
        }
      })
      finish({ project, chatId: current?.id || project.chats!.at(-1)!.id })
      dialog.close()
    } catch (e) {
      error(e)
    } finally {
      busy = false
      enabled.forEach((c) => {
        c.disabled = false
      })
    }
  })
  dialog.showModal()
  field('chat-title').focus()
  return result
}
