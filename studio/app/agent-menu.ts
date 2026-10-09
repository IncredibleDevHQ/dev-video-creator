// The agent, chosen from a small menu under the header pill instead of a
// full settings page (review 5): the agents found on this computer, one
// mark each, and the model in a menu. Settings keeps the full page.
import type { HarnessChoice } from '../shared/api'
import type { HarnessSelection } from '../shared/model'
import { agentNames, rememberModels } from './agent-setup'
import { api } from './api'
import type { AppContext } from './app-context'
import { closePopover, openPopover } from './popover'
import { escape } from './ui'
import { modelName } from '../shared/agent-models'

const order = ['claude-code', 'codex', 'kimi'] as const

/** The model's name, from the list the picker uses ("Opus 5.5", "K3"). */
export const modelLabel = modelName

const rows = (
  choices: Map<string, HarnessChoice> | null,
  selected: HarnessSelection | null
) =>
  order
    .map((id) => {
      const found = choices?.get(id)
      const state = !choices
        ? 'Looking…'
        : found?.ok
          ? ''
          : 'Not on this computer'
      return `<label class="agent-menu-row${found?.ok || !choices ? '' : ' is-missing'}">
<input type="radio" name="menu-agent" value="${id}" ${selected?.adapter === id ? 'checked' : ''} ${choices && !found?.ok ? 'disabled' : ''}>
<span>${agentNames[id]}</span>${state ? `<small>${state}</small>` : ''}</label>`
    })
    .join('')

// Models as rows, like the agents: plain names, an alias explained in its
// tooltip, an unavailable one saying why (review 6).
const models = (choice: HarnessChoice | undefined, selected?: string) => {
  const options = choice?.models?.options || []
  const list: Array<{
    id: string
    label: string
    hint?: string
    unavailable?: string
  }> = [{ id: '', label: 'Agent default' }, ...options]
  if (selected && !options.some((option) => option.id === selected))
    list.push({ id: selected, label: modelName(selected) })
  return list
    .map(
      (option) =>
        `<label class="agent-menu-row${option.unavailable ? ' is-missing' : ''}"${option.hint ? ` title="${escape(option.hint)}"` : ''}>
<input type="radio" name="menu-model" value="${escape(option.id)}" ${option.id === (selected || '') ? 'checked' : ''} ${option.unavailable ? 'disabled' : ''}>
<span>${escape(option.label)}</span>${option.unavailable ? `<small>${escape(option.unavailable)}</small>` : ''}</label>`
    )
    .join('')
}

export const openAgentMenu = (app: AppContext, anchor: HTMLElement) => {
  const id = app.snapshot?.project.id || null
  let selected: HarnessSelection | null = app.snapshot?.project.harness || null
  let choices: Map<string, HarnessChoice> | null = null
  const panel = openPopover(
    anchor,
    'agent',
    `<form class="agent-menu" data-agent-menu>
<p class="popover-title">Agent</p>
<div class="agent-menu-list" role="radiogroup" aria-label="Agent" data-agent-rows>${rows(null, selected)}</div>
<p class="popover-title">Model</p>
<div class="agent-menu-list" role="radiogroup" aria-label="Model" data-agent-model></div>
<p class="popover-note">Used for this notebook and for new ones.</p>
<p class="popover-error" role="alert" data-agent-error></p>
<div class="popover-actions"><button type="button" class="quiet" data-action="agent-settings">All agent settings</button><button class="primary" data-agent-save disabled>Done</button></div>
</form>`,
    'agent-popover'
  )
  if (!panel) return
  const form = panel.querySelector<HTMLFormElement>('[data-agent-menu]')!
  const model = panel.querySelector<HTMLElement>('[data-agent-model]')!
  const save = panel.querySelector<HTMLButtonElement>('[data-agent-save]')!
  const draw = () => {
    panel.querySelector('[data-agent-rows]')!.innerHTML = rows(
      choices,
      selected
    )
    const choice = selected ? choices?.get(selected.adapter) : undefined
    model.innerHTML = choice?.ok ? models(choice, selected?.model) : ''
    save.disabled = !choice?.ok
  }
  void api
    .harnesses()
    .then((result) => {
      rememberModels(result.available)
      choices = new Map(result.available.map((item) => [item.id, item]))
      if (!selected || !choices.get(selected.adapter)?.ok) {
        const first = order.find((item) => choices!.get(item)?.ok)
        selected = first ? { adapter: first } : null
      }
      draw()
      if (!selected)
        panel.querySelector('[data-agent-error]')!.textContent =
          'No agent was found. Install Claude Code, Codex or Kimi and sign in.'
    })
    .catch(app.error)
  form.addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement
    if (input.name === 'menu-agent') {
      selected = { adapter: input.value as HarnessSelection['adapter'] }
      draw()
    }
    if (input.name === 'menu-model' && selected)
      selected = {
        adapter: selected.adapter,
        ...(input.value ? { model: input.value } : {})
      }
  })
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    event.stopPropagation()
    if (!selected) return
    save.disabled = true
    save.textContent = 'Saving…'
    try {
      await api.saveSettings({
        harness: selected,
        ...(id ? { projectId: id } : {})
      })
      if (id && app.snapshot?.project.id === id)
        app.snapshot = await api.load(id)
      closePopover()
      app.render()
    } catch (reason) {
      panel.querySelector('[data-agent-error]')!.textContent =
        reason instanceof Error ? reason.message : 'Could not save the agent'
      save.disabled = false
      save.textContent = 'Done'
    }
  })
}
