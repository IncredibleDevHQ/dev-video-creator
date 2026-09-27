// Dialogs (the component audit): a modal dialog opens with the keyboard on
// its first field — else on its first control past the heading — not on its
// close button or a link in its heading, where the browser puts it for being
// the first thing in it. An opener that has placed the keyboard in the body
// itself is left as it chose; and a dialog that draws part of itself after it
// opens is looked at again, in case the drawing took the keyboard away.
const FIELDS = [
  '[autofocus]',
  'input:not([type="hidden"]):not([disabled])',
  'select:not([disabled]):not(.ui-select-native)',
  'textarea:not([disabled])',
  '.ui-select-trigger:not(:disabled)',
  '[role="radio"][aria-checked="true"]',
  '[role="tab"][aria-selected="true"]',
].join(', ')
const CONTROLS = 'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
const HEADS = '.modal-heading, .explainer-header, .planning-header'
// Headings that hold only the title and its tools, never a field.
const TITLES = '.modal-heading, .explainer-header'

const shown = (element: Element) => element.getClientRects().length > 0
const closes = (element: Element) =>
  element.matches('.icon-button, [data-icon="x"]') && (/^close/i.test(element.getAttribute('aria-label') || '') || element.getAttribute('value') === 'cancel' || (element as HTMLElement).dataset.icon === 'x')

export const firstFieldOf = (dialog: HTMLElement) => {
  const heads = [...dialog.querySelectorAll(HEADS)]
  const inBody = (element: Element) => !heads.some(head => head.contains(element))
  let field = [...dialog.querySelectorAll<HTMLElement>(FIELDS)].find(element => shown(element) && inBody(element))
  // A radio's group is reached at its chosen one.
  if (field instanceof HTMLInputElement && field.type === 'radio' && !field.checked && field.name) {
    field = [...dialog.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(field.name)}"]`)].find(radio => radio.checked && shown(radio)) || field
  }
  return field || [...dialog.querySelectorAll<HTMLElement>(CONTROLS)].find(element => shown(element) && inBody(element) && !closes(element)) || null
}

export const settleDialogFocus = (dialog: HTMLDialogElement) => {
  const active = document.activeElement
  const placed = active instanceof HTMLElement && active !== dialog && dialog.contains(active) && !closes(active) && !active.closest(TITLES)
  if (placed) return
  const target = firstFieldOf(dialog)
  if (!target) return
  // A field far down a long dialog (the AI settings open on their table):
  // the keyboard waits at the top, on the dialog, and Tab reaches the field —
  // nothing scrolls away from what the dialog shows first.
  const frame = dialog.getBoundingClientRect()
  const box = target.getBoundingClientRect()
  if (frame.height > 0 && (box.top > frame.bottom - 24 || box.bottom < frame.top)) {
    if (!dialog.hasAttribute('tabindex')) dialog.setAttribute('tabindex', '-1')
    dialog.focus({ preventScroll: true })
    return
  }
  target.focus({ preventScroll: true })
}

const modal = (dialog: HTMLDialogElement) => {
  try {
    return dialog.matches(':modal')
  } catch {
    return false
  }
}

export const watchDialogs = (root: Node = document.documentElement) => {
  const observer = new MutationObserver(records => {
    for (const record of records) {
      const dialog = record.target
      if (!(dialog instanceof HTMLDialogElement) || record.oldValue !== null || !dialog.open || !modal(dialog)) continue
      settleDialogFocus(dialog)
      // A dialog that draws part of itself after it opens (the harnesses in
      // the AI settings) can take the keyboard away with what it replaces:
      // for its first seconds, the keyboard is put back.
      const guard = new MutationObserver(() => {
        const active = document.activeElement
        if (dialog.open && (!active || active === document.body)) settleDialogFocus(dialog)
      })
      guard.observe(dialog, { childList: true, subtree: true })
      window.setTimeout(() => guard.disconnect(), 3000)
      dialog.addEventListener('close', () => guard.disconnect(), { once: true })
    }
  })
  observer.observe(root, { subtree: true, attributes: true, attributeFilter: ['open'], attributeOldValue: true })
  return observer
}
