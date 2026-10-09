import type { HarnessChoice } from '../shared/api'
import type { HarnessSelection } from '../shared/model'
import { api } from './api'
import { escape } from './ui'
import { modelName } from '../shared/agent-models'

export const agentNames = {
  'claude-code': 'Claude Code',
  codex: 'Codex',
  kimi: 'Kimi'
}
const ids = Object.keys(agentNames) as HarnessSelection['adapter'][]

let detected: HarnessSelection['adapter'] | null | undefined
let asking = false
/** The models each agent on this computer lists, as the picker names them. */
const listed = new Map<string, Array<{ id: string; label: string }>>()
export const rememberModels = (choices: HarnessChoice[]) => {
  for (const choice of choices)
    if (choice.models?.options?.length)
      listed.set(choice.id, choice.models.options)
}
/**
 * A chosen model's name, as the picker gives it: from the agent's own list,
 * else as the engine kept it, else its short name (review 6: the row said
 * the raw id).
 */
export const modelLabelOf = (selection: HarnessSelection) =>
  listed.get(selection.adapter)?.find((option) => option.id === selection.model)
    ?.label ||
  selection.label ||
  modelName(selection.model)
/** The agent Create would use when the notebook has none chosen: the first
 * found on this computer. Undefined until asked; null when none is found. */
export const foundAgent = () => detected
export const lookForAgent = (then: () => void) => {
  if (detected !== undefined || asking) return
  asking = true
  void api
    .harnesses()
    .then((result) => {
      rememberModels(result.available)
      detected =
        ids.find((id) => result.available.some((c) => c.id === id && c.ok)) ??
        null
      then()
    })
    .catch(() => {
      detected = null
    })
    .finally(() => {
      asking = false
    })
}
/** "Found Claude Code and Kimi on this computer." */
const found = (choices: Map<HarnessSelection['adapter'], HarnessChoice>) => {
  const names = ids
    .filter((id) => choices.get(id)?.ok)
    .map((id) => agentNames[id])
  if (!names.length) return 'No agent was found on this computer.'
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
  return `Found ${list} on this computer.`
}
type Detection = 'idle' | 'searching' | 'done'

/** Real checks finish independently; no simulated discovery or model calls. */
export class AgentSetup {
  private states = new Map<HarnessSelection['adapter'], Detection>()
  private choices = new Map<HarnessSelection['adapter'], HarnessChoice>()
  private disposed = false
  private detecting = false
  private saving = false
  private message = ''
  constructor(
    private root: HTMLElement,
    private selected: HarnessSelection | null,
    private save: (selection: HarnessSelection) => Promise<void>,
    private actionLabel = 'Save selection',
    autoDetect = false
  ) {
    root.addEventListener('click', this.click)
    root.addEventListener('change', this.change)
    root.addEventListener('submit', this.submit)
    this.draw()
    if (autoDetect) void this.detect()
  }
  dispose() {
    this.disposed = true
    this.root.removeEventListener('click', this.click)
    this.root.removeEventListener('change', this.change)
    this.root.removeEventListener('submit', this.submit)
  }
  private draw() {
    if (this.disposed) return
    const choice = this.selected && this.choices.get(this.selected.adapter)
    const completed = ids.every((id) => this.states.get(id) === 'done')
    this.root.innerHTML = `<div class="agent-setup">
      <p class="agent-intro">Choose the agent and model that will create your wireframes.</p>
      ${this.selected && !completed ? `<p class="agent-current">Selected agent: <strong>${agentNames[this.selected.adapter]}</strong>${this.selected.model ? ` · ${escape(modelLabelOf(this.selected))}` : ''}</p>` : ''}
      <button type="button" data-detect-agents ${this.detecting || this.saving ? 'disabled' : ''}>${this.detecting ? 'Searching this computer…' : completed ? 'Detect again' : 'Detect local agents'}</button>
      <form data-agent-form>
        <fieldset class="agent-options" ${this.detecting || this.saving ? 'disabled' : ''}>
          <legend class="sr">Local agent</legend>
          ${ids
            .map((id) => {
              const state = this.states.get(id) || 'idle'
              const found = this.choices.get(id)
              // One mark per card: the radio says which is chosen (review 5).
              return `<label class="agent-option ${state === 'searching' ? 'is-searching' : ''} ${found?.ok ? 'is-available' : 'is-unavailable'}">
              <input type="radio" name="agent" value="${id}" ${this.selected?.adapter === id && found?.ok ? 'checked' : ''} ${!found?.ok ? 'disabled' : ''}>
              <span><strong>${agentNames[id]}</strong><small>${state === 'idle' ? 'Not checked' : state === 'searching' ? 'Looking…' : found?.ok ? 'On this computer' : 'Not on this computer'}</small></span>
              ${state === 'searching' ? '<span class="spinner" aria-hidden="true"></span>' : ''}
            </label>`
            })
            .join('')}
        </fieldset>
        ${completed && choice?.ok ? this.models(choice) : ''}
        <p class="ai-default-note">Remembered for new notebooks. Change anytime in Settings.</p>
        <p class="agent-detection-note">Sign in to your agent before generating. Model access depends on your agent’s account.</p>
        ${completed && ![...this.choices.values()].some((item) => item.ok) ? '<p role="alert">No supported agent was found. Install Claude Code, Codex, or Kimi on this computer, then detect again.</p>' : ''}
        <p class="agent-message" role="status" aria-live="polite">${escape(this.message || (this.detecting ? 'Looking for agents on this computer…' : completed ? found(this.choices) : ''))}</p>
        <button class="primary" ${!completed || !choice?.ok || this.saving ? 'disabled' : ''}>${this.saving ? 'Saving…' : this.actionLabel}</button>
      </form>
    </div>`
  }
  private models(choice: HarnessChoice) {
    const options = choice.models?.options || []
    const selected = this.selected?.model || ''
    const items = [
      {
        id: '',
        label: 'Agent default',
        unavailable: undefined as string | undefined
      },
      ...options
    ]
    if (selected && !options.some((item) => item.id === selected))
      items.push({ id: selected, label: selected, unavailable: undefined })
    return `<fieldset class="model-options" ${this.saving ? 'disabled' : ''}>
      <legend>Model</legend>
      <p class="model-source">${escape(choice.models?.source || 'The models this agent offers.')}</p>
      <div class="model-list">${items
        .map(
          (
            item
          ) => `<label class="model-option ${item.unavailable ? 'is-unavailable' : ''}">
        <input type="radio" name="agent-model" value="${escape(item.id)}" ${item.id === selected ? 'checked' : ''} ${item.unavailable ? 'disabled' : ''}>
        <span><strong>${escape(item.label)}</strong>${
          item.unavailable || !item.id || item.label !== item.id
            ? `<small>${escape(item.unavailable || (item.id ? item.id : 'The model set in the agent itself'))}</small>`
            : ''
        }</span>
        ${item.unavailable ? '<span class="model-availability">Unavailable</span>' : ''}
      </label>`
        )
        .join('')}</div>
    </fieldset>`
  }
  private click = (event: Event) => {
    if ((event.target as Element).closest('[data-detect-agents]'))
      void this.detect()
  }
  private change = (event: Event) => {
    const input = event.target as HTMLInputElement
    if (input.name === 'agent-model' && this.selected) {
      this.selected = {
        adapter: this.selected.adapter,
        ...(input.value ? { model: input.value } : {})
      }
      return
    }
    if (input.name !== 'agent') return
    const adapter = input.value as HarnessSelection['adapter']
    this.selected = { adapter }
    this.draw()
    this.root
      .querySelector<HTMLInputElement>(`input[value="${adapter}"]`)
      ?.focus()
  }
  private async detect() {
    if (this.detecting || this.saving) return
    this.detecting = true
    this.message = ''
    this.choices.clear()
    ids.forEach((id) => this.states.set(id, 'searching'))
    this.draw()
    await Promise.all(
      ids.map(async (id) => {
        try {
          const result = await api.harnesses(id)
          rememberModels(result.available)
          if (this.disposed) return
          this.choices.set(
            id,
            result.available.find((item) => item.id === id) || { id, ok: false }
          )
        } catch {
          this.choices.set(id, { id, ok: false })
          this.message =
            'Some checks could not complete. Check that Studio is running and try detecting again.'
        }
        this.states.set(id, 'done')
        this.draw()
      })
    )
    this.detecting = false
    if (!this.selected || !this.choices.get(this.selected.adapter)?.ok) {
      const first = ids.find((id) => this.choices.get(id)?.ok)
      this.selected = first ? { adapter: first } : null
    }
    this.draw()
  }
  private submit = async (event: Event) => {
    event.preventDefault()
    event.stopPropagation()
    if (
      this.saving ||
      this.detecting ||
      !this.selected ||
      !this.choices.get(this.selected.adapter)?.ok
    )
      return
    const values = new FormData(event.target as HTMLFormElement)
    const model = String(values.get('agent-model') || '')
    const selection = {
      adapter: this.selected.adapter,
      ...(model ? { model } : {})
    }
    this.saving = true
    this.draw()
    try {
      await this.save(selection)
      this.selected = selection
      this.message = `Saved. This notebook and new ones use ${agentNames[selection.adapter]}.`
    } catch (reason) {
      this.message =
        reason instanceof Error
          ? reason.message
          : 'Could not save this agent. Try again.'
    } finally {
      this.saving = false
      this.draw()
    }
  }
}
