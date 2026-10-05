import { ArrowUp, LoaderCircle, createElement } from 'lucide'

/** A native input group with a single inline submit action. */
export const sourceComposer = (pending: boolean) => {
  const arrow = createElement(ArrowUp, {
    class: 'source-arrow',
    'aria-hidden': 'true',
    'stroke-width': 2
  }).outerHTML
  const spinner = createElement(LoaderCircle, {
    class: 'source-spinner',
    'aria-hidden': 'true',
    'stroke-width': 2
  }).outerHTML
  const label = pending ? 'Opening notebook' : 'Open notebook'
  return `<div class="source-composer" aria-busy="${pending}">
<textarea id="source-input" name="source" rows="1" placeholder="Paste your notes or blog link…" aria-describedby="source-hint" ${pending ? 'readonly' : ''} required></textarea>
<button class="source-submit" type="submit" aria-label="${label}" title="${label}${pending ? '…' : ' (Enter)'}" aria-keyshortcuts="Enter" disabled>${arrow}${spinner}</button>
</div>`
}

export const updateSourceComposer = (
  field: HTMLTextAreaElement,
  pending: boolean
) => {
  const submit = field.form?.querySelector<HTMLButtonElement>('.source-submit')
  if (submit) submit.disabled = pending || !field.value.trim()
}
