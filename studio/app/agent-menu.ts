// The same searchable controls used in research, with local availability
// and model access supplied by the engine.
import type { HarnessChoice } from '../shared/api'
import type { HarnessSelection } from '../shared/model'
import { agentNames, rememberModels } from './agent-setup'
import { api } from './api'
import type { AppContext } from './app-context'
import { closePopover, openPopover } from './popover'
import { destinationPicker } from './destination-picker'
import { escape } from './ui'
import { modelName } from '../shared/agent-models'

const order = ['claude-code', 'codex', 'kimi'] as const
export const modelLabel = modelName

export const openAgentMenu = (app: AppContext, anchor: HTMLElement) => {
  const id = app.snapshot?.project.id || null
  let selected: HarnessSelection | null = app.snapshot?.project.harness || null
  let choices: Map<string, HarnessChoice> | null = null
  const panel = openPopover(
    anchor,
    'agent',
    `<form class="agent-menu" data-agent-menu>
<label class="popover-title" for="menu-agent">Agent</label>
<select id="menu-agent" name="menu-agent" disabled></select>
<label class="popover-title" for="menu-model">Model</label>
<select id="menu-model" name="menu-model" disabled></select>
<p class="popover-note">Used for this notebook and for new ones.</p>
<p class="popover-error" role="alert" data-agent-error></p>
<div class="popover-actions"><button type="button" class="quiet" data-action="agent-settings">All agent settings</button><button type="submit" class="primary" data-agent-save disabled>Done</button></div>
</form>`,
    'agent-popover'
  )
  if (!panel) return
  const form = panel.querySelector<HTMLFormElement>('form')!
  const agent = form.querySelector<HTMLSelectElement>('[name="menu-agent"]')!
  const model = form.querySelector<HTMLSelectElement>('[name="menu-model"]')!
  const save = form.querySelector<HTMLButtonElement>('[data-agent-save]')!
  const syncAgent = destinationPicker(agent, 'agent')
  const syncModel = destinationPicker(model, 'model')
  const draw = () => {
    agent.innerHTML = order
      .map((adapter) => {
        const found = choices?.get(adapter)
        return `<option value="${adapter}" ${selected?.adapter === adapter ? 'selected' : ''} ${!found?.ok ? 'disabled' : ''} data-detail="${escape(!choices ? 'Looking…' : found?.ok ? 'Local agent' : found?.reason || 'Not on this computer')}">${agentNames[adapter]}</option>`
      })
      .join('')
    agent.disabled =
      !choices || !order.some((adapter) => choices?.get(adapter)?.ok)
    const choice = selected ? choices?.get(selected.adapter) : undefined
    const options = [
      {
        id: '',
        label: 'Agent default',
        hint: 'The model configured in the agent'
      },
      ...(choice?.models?.options || [])
    ]
    if (
      selected?.model &&
      !options.some((option) => option.id === selected!.model)
    )
      options.push({
        id: selected.model,
        label: modelName(selected.model),
        hint: 'Current model ID'
      })
    model.innerHTML = options
      .map(
        (option) =>
          `<option value="${escape(option.id)}" ${option.id === (selected?.model || '') ? 'selected' : ''} ${'unavailable' in option && option.unavailable ? 'disabled' : ''} data-detail="${escape(('unavailable' in option ? option.unavailable : '') || option.hint || '')}">${escape(option.label)}</option>`
      )
      .join('')
    model.disabled = !choice?.ok
    save.disabled = !choice?.ok
    syncAgent()
    syncModel()
  }
  draw()
  void api
    .harnesses()
    .then((result) => {
      if (!panel.isConnected) return
      rememberModels(result.available)
      choices = new Map(result.available.map((item) => [item.id, item]))
      if (!selected || !choices.get(selected.adapter)?.ok) {
        const first = order.find((item) => choices!.get(item)?.ok)
        selected = first ? { adapter: first } : null
      }
      draw()
      if (!selected)
        form.querySelector('[data-agent-error]')!.textContent =
          'No agent was found. Install Claude Code, Codex or Kimi and sign in.'
    })
    .catch((reason) => {
      if (panel.isConnected)
        form.querySelector('[data-agent-error]')!.textContent =
          reason instanceof Error
            ? reason.message
            : 'Could not load local agents. Reopen this menu to retry.'
    })
  form.addEventListener('change', (event) => {
    const input = event.target as HTMLSelectElement
    if (input === agent) {
      selected = { adapter: input.value as HarnessSelection['adapter'] }
      draw()
    }
    if (input === model && selected)
      selected = {
        adapter: selected.adapter,
        ...(input.value ? { model: input.value } : {})
      }
  })
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    event.stopPropagation()
    if (!selected || save.disabled) return
    save.disabled = true
    agent.disabled = true
    model.disabled = true
    syncAgent()
    syncModel()
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
      form.querySelector('[data-agent-error]')!.textContent =
        reason instanceof Error ? reason.message : 'Could not save the agent'
      draw()
      save.textContent = 'Done'
    }
  })
}
