import {
  modelEfforts,
  effortLabels,
  effortDescriptions
} from '../shared/reasoning-effort'
import type { HarnessChoice } from '../shared/api'
import { requestJson } from './http'
import type { RepoInspection, RepoLink } from '../shared/repos'
import { modelName } from '../shared/agent-models'
import { api } from './api'
import { destinationPicker } from './destination-picker'

let catalog: Promise<HarnessChoice[]> | undefined
const agents = () =>
  (catalog ||= api
    .harnesses()
    .then((result) => result.available)
    .catch((error) => {
      catalog = undefined
      throw error
    }))
const repositoryKey = 'incredible-recent-repository-folders'
const recentRepositories = (): string[] => {
  try {
    const values: unknown = JSON.parse(
      localStorage.getItem(repositoryKey) || '[]'
    )
    return Array.isArray(values)
      ? values
          .filter((value): value is string => typeof value === 'string')
          .slice(0, 20)
      : []
  } catch {
    return []
  }
}
export const rememberRepository = (path: string) => {
  try {
    localStorage.setItem(
      repositoryKey,
      JSON.stringify(
        [path, ...recentRepositories().filter((value) => value !== path)].slice(
          0,
          20
        )
      )
    )
  } catch {
    /* Local history is optional. */
  }
}

/** A native select stays in the form so existing change and submit handlers work. */
const replaceInput = (input: HTMLInputElement) => {
  const select = document.createElement('select')
  for (const name of ['id', 'name', 'class', 'aria-label']) {
    const value = input.getAttribute(name)
    if (value !== null) select.setAttribute(name, value)
  }
  select.disabled = input.disabled
  select.required = input.required
  select.add(
    new Option(input.value || 'Agent default', input.value, true, true)
  )
  input.replaceWith(select)
  return select
}

export const installRepositoryPicker = (
  input: HTMLInputElement,
  repos: RepoLink[] = [],
  picked?: (repo: RepoInspection) => void
) => {
  const select = replaceInput(input)
  select.options[0].textContent =
    input.value.split('/').filter(Boolean).pop() || 'Choose a repository…'
  if (input.value)
    select.insertBefore(
      new Option('Choose a repository…', ''),
      select.firstChild
    )
  const paths = [
    ...new Set(
      [
        ...repos.map((repo) => repo.path),
        ...recentRepositories(),
        input.value
      ].filter(Boolean)
    )
  ]
  for (const path of paths) {
    if (path === select.value) continue
    const option = new Option(
      path.split('/').filter(Boolean).pop() || path,
      path
    )
    option.dataset.detail = path
    select.add(option)
  }
  if (select.selectedOptions[0])
    select.selectedOptions[0].dataset.detail = input.value
  const sync = destinationPicker(
    select,
    'repo',
    new Map(paths.map((path) => [path, path])),
    (query) =>
      query && /^(\/|~\/|[A-Za-z]:[\\/])/.test(query)
        ? { value: query, label: 'Use this repository folder', detail: query }
        : null
  )
  select.addEventListener('change', () => {
    const option = select.selectedOptions[0]
    if (select.value && option) {
      option.textContent =
        select.value.split('/').filter(Boolean).pop() || select.value
      option.dataset.detail = select.value
    }
    sync()
    select.dispatchEvent(new Event('input', { bubbles: true }))
  })
  const browse = document.createElement('button')
  browse.type = 'button'
  browse.className = 'repository-browse'
  browse.textContent = 'Browse folders…'
  browse.setAttribute('aria-label', 'Browse local repository folders')
  select.nextElementSibling!.after(browse)
  const status = document.createElement('small')
  status.className = 'repository-picker-status'
  status.setAttribute('role', 'status')
  browse.after(status)
  browse.addEventListener('click', async () => {
    browse.disabled = true
    const form = browse.closest('form')
    if (form) form.dataset.repositoryPicking = 'true'
    status.textContent = 'Choose a folder in the system dialog…'
    try {
      const result = await requestJson<{ repository: RepoInspection | null }>(
        '/api/repos/pick',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}'
        }
      )
      if (!select.isConnected) return
      if (!result.repository) {
        status.textContent = ''
        return
      }
      const repo = result.repository
      rememberRepository(repo.path)
      if (
        !Array.from(select.options).some((option) => option.value === repo.path)
      )
        select.add(new Option(repo.name, repo.path))
      select.value = repo.path
      select.dispatchEvent(
        new CustomEvent('change', {
          bubbles: true,
          detail: { repository: repo }
        })
      )
      status.textContent = ''
      picked?.(repo)
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : 'Could not choose a folder.'
    } finally {
      if (form) delete form.dataset.repositoryPicking
      browse.disabled = false
    }
  })
  return select
}

export const installAgentPickers = (
  root: HTMLElement,
  agentId: string,
  modelId: string
) => {
  const agent = root.querySelector<HTMLSelectElement>(`#${agentId}`)
  const modelField = root.querySelector<HTMLInputElement | HTMLSelectElement>(
    `#${modelId}`
  )
  if (!agent || !modelField) return
  const initialEffort = modelField.dataset.effort || ''
  const model =
    modelField instanceof HTMLSelectElement
      ? modelField
      : replaceInput(modelField)
  const syncAgent = destinationPicker(agent, 'agent')
  const syncModel = destinationPicker(model, 'model', new Map(), (query) =>
    query
      ? {
          value: query,
          label: `Use model “${query}”`,
          detail: 'Custom model ID · access depends on your agent'
        }
      : null
  )
  const effortGroup = document.createElement('div')
  effortGroup.className = 'thinking-effort-field'
  const effort = document.createElement('select')
  effort.id = `${modelId}-effort`
  effort.name = 'effort'
  effort.setAttribute('aria-label', 'Thinking effort')
  effort.add(new Option('Thinking: Auto', initialEffort, true, true))
  const effortLabel = document.createElement('label')
  effortLabel.htmlFor = effort.id
  effortLabel.className = 'sr'
  effortLabel.textContent = 'Thinking effort'
  effortGroup.append(effortLabel, effort)
  // Inline beside the model on home; within the model menu in an active chat.
  if (model.parentElement?.classList.contains('home-agent-fields'))
    model.after(effortGroup)
  else if (model.closest('.home-agent-fields'))
    model.parentElement!.after(effortGroup)
  else model.nextElementSibling!.after(effortGroup)
  const syncEffort = destinationPicker(effort, 'effort')
  let choices: HarnessChoice[] | undefined
  const updateEffort = () => {
    const choice = choices?.find((item) => item.id === agent.value)
    const levels = modelEfforts(choice?.models, model.value)
    const previous = effort.value
    effort.replaceChildren(new Option('Thinking: Auto', ''))
    effort.options[0].dataset.detail = levels.length
      ? "Studio's task default · balances depth and usage"
      : 'Choose a model with advertised effort levels to customize thinking'
    for (const level of levels) {
      const option = new Option(effortLabels[level], level)
      option.dataset.detail = effortDescriptions[level]
      effort.add(option)
    }
    if (levels.includes(previous as never)) effort.value = previous
    // Keep a saved choice while catalog is loading, never silently submit a stale choice.
    else if (!choices && previous)
      effort.add(new Option(previous, previous, true, true))
    effort.disabled = model.disabled || !choices || !levels.length
    syncEffort()
    if (choices && previous !== effort.value)
      queueMicrotask(() => {
        if (effort.isConnected)
          effort.dispatchEvent(new Event('change', { bubbles: true }))
      })
  }
  model.addEventListener('change', updateEffort)
  let catalogFailed = false
  const update = () => {
    if (!model.isConnected) return
    const value = model.value
    const choice = choices?.find((item) => item.id === agent.value)
    model.replaceChildren(new Option('Agent default', '', false, !value))
    if (!choices) {
      const status = new Option(
        catalogFailed
          ? 'Model list unavailable · use a custom ID'
          : 'Loading model list…',
        '__catalog-status'
      )
      status.disabled = true
      model.add(status)
    }
    for (const item of choice?.models?.options || []) {
      const option = new Option(item.label, item.id, false, item.id === value)
      option.disabled = Boolean(item.unavailable)
      option.dataset.detail = item.unavailable || item.hint || ''
      model.add(option)
    }
    if (
      value &&
      !Array.from(model.options).some((option) => option.value === value)
    ) {
      const option = new Option(modelName(value), value, false, true)
      option.dataset.detail = choices ? 'Custom model ID' : 'Current model'
      model.add(option)
    }
    for (const option of Array.from(agent.options)) {
      const found = choices?.find((item) => item.id === option.value)
      option.dataset.detail = found
        ? found.ok
          ? 'Local agent'
          : found.reason || 'Not available on this computer'
        : 'Local agent'
      option.disabled = Boolean(
        found && !found.ok && option.value !== agent.value
      )
    }
    syncAgent()
    syncModel()
    updateEffort()
  }
  agent.addEventListener('change', () => {
    model.value = ''
    effort.value = ''
    queueMicrotask(update)
  })
  void agents()
    .then((result) => {
      choices = result
      update()
    })
    .catch(() => {
      catalogFailed = true
      update()
    })
  update()
}

export const installResearchPickers = (
  root: HTMLElement,
  repos: RepoLink[],
  picked?: (repo: RepoInspection) => void
) => {
  installAgentPickers(root, 'research-adapter', 'research-model')
  for (const [id, kind] of [
    ['research-notebook', 'notebook'],
    ['research-repo-branch', 'branch']
  ] as const) {
    const select = root.querySelector<HTMLSelectElement>(`#${id}`)
    if (select) destinationPicker(select, kind)
  }
  const repo = root.querySelector<HTMLInputElement>('#research-repo-path')
  if (repo) installRepositoryPicker(repo, repos, picked)
}
