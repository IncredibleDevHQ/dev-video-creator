import './styles/destination-picker.css'
import { escape } from './ui'
import { closePopover, openPopover } from './popover'

const svg = (path: string) =>
  `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`
export const pickerIcons = {
  project: svg(
    '<path d="M3 7V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/>'
  ),
  notebook: svg(
    '<rect x="5" y="3" width="15" height="18" rx="2"/><path d="M9 3v18M3 7h4M3 12h4M3 17h4M12 8h5M12 12h5"/>'
  ),
  agent: svg(
    '<rect x="4" y="6" width="16" height="14" rx="4"/><path d="M12 2v4M8 12h.01M16 12h.01M9 16h6"/>'
  ),
  model: svg('<path d="m12 3 9 5-9 5-9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>'),
  repo: svg(
    '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 3v18m4-13-2 3 2 3m3-6 2 3-2 3"/>'
  ),
  branch: svg(
    '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M6 7v10m12-10c0 7-12 3-12 9"/>'
  ),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  check: svg('<path d="m5 12 4 4L19 6"/>'),
  chevron: svg('<path d="m8 10 4 4 4-4"/>'),
  search: svg('<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>')
}
export type PickerKind =
  | 'project'
  | 'notebook'
  | 'agent'
  | 'model'
  | 'repo'
  | 'branch'
type Item = {
  value: string
  label: string
  detail?: string
  disabled?: boolean
  create?: boolean
}
const titles: Record<PickerKind, string> = {
  project: 'Project',
  notebook: 'Notebook',
  agent: 'Agent',
  model: 'Model',
  repo: 'Repository',
  branch: 'Branch'
}
let pickerId = 0
const enhanced = new WeakMap<HTMLSelectElement, () => void>()

/** Enhance a form select without changing its submission contract. */
export const destinationPicker = (
  select: HTMLSelectElement,
  kind: PickerKind,
  details: Map<string, string> = new Map(),
  custom?: (
    query: string
  ) => { value: string; label: string; detail?: string } | null
) => {
  const existing = enhanced.get(select)
  if (existing) return existing
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'destination-picker-trigger'
  button.setAttribute('aria-haspopup', 'dialog')
  button.setAttribute('aria-expanded', 'false')
  const key = `destination-${++pickerId}`
  button.id = `${select.id || key}-picker`
  for (const label of Array.from(select.labels || [])) {
    if (label.htmlFor) label.htmlFor = button.id
  }
  button.dataset.popover = key
  select.classList.add('destination-picker-source')
  select.hidden = true
  // A hidden native select retains form values; focus validation on its trigger.
  select.addEventListener('invalid', (event) => {
    event.preventDefault()
    button.focus()
    button.click()
  })
  select.after(button)
  let refreshMenu: (() => void) | undefined
  const sync = () => {
    const label =
      select.selectedOptions[0]?.textContent?.trim() ||
      `Choose ${titles[kind].toLowerCase()}`
    button.disabled = select.disabled || select.matches(':disabled')
    button.setAttribute('aria-label', `${titles[kind]}: ${label}`)
    button.title =
      select.selectedOptions[0]?.dataset.detail ||
      details.get(select.value) ||
      label
    button.innerHTML = `${pickerIcons[kind]}<span>${escape(label)}</span>${pickerIcons.chevron}`
    refreshMenu?.()
  }
  button.addEventListener('click', () => {
    if (button.disabled) return
    const panel = openPopover(
      button,
      key,
      `<div class="destination-picker-heading">Choose ${titles[kind].toLowerCase()}</div>
       <label class="destination-picker-search">${pickerIcons.search}<input type="search" placeholder="Search ${titles[kind].toLowerCase()}…" aria-label="Search ${titles[kind].toLowerCase()}" autocomplete="off" /></label>
       <div class="destination-picker-results"></div>`,
      'destination-picker-menu',
      () => {
        refreshMenu = undefined
        button.setAttribute('aria-expanded', 'false')
      }
    )
    if (!panel) return
    button.setAttribute('aria-expanded', 'true')
    panel.setAttribute('aria-label', `Choose ${titles[kind].toLowerCase()}`)
    const search = panel.querySelector<HTMLInputElement>('input')!
    search.maxLength = kind === 'model' ? 200 : 4096
    if (kind === 'repo')
      search.placeholder = 'Search recent repos or paste a folder path…'
    const results = panel.querySelector<HTMLElement>(
      '.destination-picker-results'
    )!
    const render = () => {
      const items: Item[] = Array.from(select.options, (option) => ({
        value: option.value,
        label: option.textContent?.trim() || '',
        detail: option.dataset.detail || details.get(option.value),
        disabled:
          option.disabled ||
          (option.parentElement instanceof HTMLOptGroupElement &&
            option.parentElement.disabled),
        create:
          (kind === 'project' || kind === 'notebook') &&
          (!option.value || option.value === 'new')
      }))
      const raw = search.value.trim()
      const query = raw.toLocaleLowerCase()
      const visible = items.filter(
        (item) =>
          item.create ||
          `${item.label} ${item.detail || ''} ${item.value}`
            .toLocaleLowerCase()
            .includes(query)
      )
      const extra = custom?.(raw)
      if (extra && !items.some((item) => item.value === extra.value))
        visible.push({ ...extra, create: true })
      results.innerHTML = visible
        .map(
          (
            item
          ) => `<button type="button" class="destination-picker-option ${item.create ? 'destination-picker-create' : ''}" data-value="${escape(item.value)}" aria-pressed="${item.value === select.value}" ${item.disabled ? 'disabled' : ''}>
        ${pickerIcons[item.create ? 'plus' : kind]}<span><strong>${escape(item.label.replace(/^＋\s*/, ''))}</strong>${item.detail ? `<small>${escape(item.detail)}</small>` : ''}</span>${item.value === select.value ? pickerIcons.check : ''}</button>`
        )
        .join('')
      if (!visible.length)
        results.insertAdjacentHTML(
          'afterbegin',
          `<p class="destination-picker-empty" role="status">${kind === 'repo' ? 'Paste the full path to a local repository folder.' : 'No matches. Try another name.'}</p>`
        )
    }
    refreshMenu = render
    search.addEventListener('input', render)
    results.addEventListener('click', (event) => {
      const option = (event.target as Element).closest<HTMLButtonElement>(
        'button[data-value]'
      )
      if (!option) return
      if (option.disabled) return
      const value = option.dataset.value!
      if (!Array.from(select.options).some((item) => item.value === value))
        select.add(new Option(value, value))
      select.value = value
      sync()
      closePopover()
      button.focus()
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    panel.addEventListener('keydown', (event) => {
      if (event.key === 'Tab') {
        // Return to the form's normal tab order when leaving the menu.
        closePopover()
        button.focus()
        return
      }
      const options = Array.from(
        results.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
      )
      const index = options.indexOf(document.activeElement as HTMLButtonElement)
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const next =
          event.key === 'ArrowDown'
            ? (index + 1) % options.length
            : index < 1
              ? options.length - 1
              : index - 1
        options[next]?.focus()
      } else if (event.key === 'Enter' && event.target === search) {
        event.preventDefault()
        options[0]?.click()
      } else if (event.key === 'Home' && event.target !== search) {
        event.preventDefault()
        options[0]?.focus()
      } else if (event.key === 'End' && event.target !== search) {
        event.preventDefault()
        options.at(-1)?.focus()
      }
    })
    render()
  })
  select.addEventListener('change', sync)
  select.addEventListener('picker-sync', sync)
  const observer = new MutationObserver(sync)
  observer.observe(select, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['disabled', 'selected', 'label']
  })
  enhanced.set(select, sync)
  sync()
  return sync
}
