import { html } from '../shared/html'
import { escape } from './ui'
export const researchNameDialog = (
  root: HTMLElement,
  title: string,
  label: string,
  value: string
): Promise<string | null> => {
  let dialog = root.querySelector<HTMLDialogElement>('#research-dialog')
  if (!dialog) {
    dialog = document.createElement('dialog')
    dialog.id = 'research-dialog'
    root.append(dialog)
  }
  dialog.innerHTML = html`<form method="dialog">
    <h2>${escape(title)}</h2>
    <label for="research-name">${escape(label)}</label
    ><input
      id="research-name"
      name="name"
      value="${escape(value)}"
      maxlength="160"
      required
    />
    <div>
      <button value="cancel" formnovalidate>Cancel</button
      ><button value="save" class="research-primary">Save</button>
    </div>
  </form>`
  const target = dialog
  return new Promise((resolve) => {
    target.addEventListener(
      'close',
      () =>
        resolve(
          target.returnValue === 'save'
            ? target.querySelector<HTMLInputElement>('input')!.value.trim() ||
                null
            : null
        ),
      { once: true }
    )
    target.showModal()
    target.querySelector<HTMLInputElement>('input')!.focus()
  })
}
