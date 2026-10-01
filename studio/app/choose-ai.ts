import { html } from './ui'
import { escape } from './ui'
import type { HarnessChoice, HarnessChoices } from '../shared/api'
const names = { kimi: 'Kimi', 'claude-code': 'Claude Code', codex: 'Codex' }
export const modelOptions = (
  choice: HarnessChoice | undefined,
  selected?: string
) => {
  const options = choice?.models?.options || []
  const value = selected || choice?.models?.default || ''
  const custom =
    value && !options.some((option) => option.id === value)
      ? html`<option value="${escape(value)}" selected>
          ${escape(value)}
        </option>`
      : ''
  return html`<option value="" ${!value ? 'selected' : ''}>
      Configured default
    </option>
    ${custom}${options
      .map(
        (option) =>
          html`<option
            value="${escape(option.id)}"
            ${option.id === value ? 'selected' : ''}
            ${option.unavailable ? 'disabled' : ''}
          >
            ${escape(option.label)}${option.unavailable ? ' · unavailable' : ''}
          </option>`
      )
      .join('')}`
}
export const aiLabel = (choices: HarnessChoices | null) => {
  const selected = choices?.selected,
    choice = choices?.available.find(
      (item) => item.id === selected?.adapter && item.ok
    )
  if (!selected || !choice) return null
  const model =
    choice.models?.options.find((option) => option.id === selected.model)
      ?.label || selected.model
  return `${names[choice.id]}${model ? ` · ${model}` : ''}`
}
export const chooseAiDialog = (choices: HarnessChoices, saveOnly = false) => {
  const selected =
    choices.available.find(
      (choice) => choice.id === choices.selected?.adapter && choice.ok
    ) || choices.available.find((choice) => choice.ok)
  return html`<h2>Choose your AI</h2>
    <p>
      This AI will design your slides, plan the scenes, and make your video.
    </p>
    <form id="choose-ai">
      <label
        >AI harness<select name="harness" required>
          ${choices.available
            .map(
              (choice) =>
                html`<option
                  value="${choice.id}"
                  ${choice.id === selected?.id ? 'selected' : ''}
                  ${!choice.ok ? 'disabled' : ''}
                >
                  ${names[choice.id]}${choice.ok ? '' : ' · not installed'}
                </option>`
            )
            .join('')}
        </select></label
      ><label
        >Model<select name="model">
          ${modelOptions(
            selected,
            selected?.id === choices.selected?.adapter
              ? choices.selected?.model
              : undefined
          )}
        </select></label
      >
      <p class="ai-default-note">
        ${saveOnly
          ? 'New videos use this AI.'
          : 'We’ll remember this choice for new videos.'}
      </p>
      ${!selected
        ? '<p role="alert">Install and sign in to a supported AI harness, then try again.</p>'
        : ''}<button class="primary" ${!selected ? 'disabled' : ''}>
        ${saveOnly ? 'Save' : 'Create presentation →'}
      </button>
    </form>`
}
