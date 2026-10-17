import { html } from './ui'
import { escape } from './ui'
import type { HarnessChoice } from '../shared/api'
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
