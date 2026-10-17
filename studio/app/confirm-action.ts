import { escape, html } from './ui'
/** Keep destructive confirmations in the app's dialog and keyboard conventions. */
export const confirmAction = (options: {
  title: string
  detail: string
  action: string
}) =>
  new Promise<boolean>((resolve) => {
    const dialog = document.createElement('dialog')
    dialog.dataset.confirm = ''
    dialog.innerHTML = html`<form method="dialog" class="dialog-body">
      <h2>${escape(options.title)}</h2>
      <p>${escape(options.detail)}</p>
      <div class="moment-action-list">
        <button value="cancel" autofocus>Cancel</button>
        <button value="confirm" class="danger">
          ${escape(options.action)}
        </button>
      </div>
    </form>`
    dialog.addEventListener(
      'close',
      () => {
        resolve(dialog.returnValue === 'confirm')
        dialog.remove()
      },
      { once: true }
    )
    document.body.append(dialog)
    dialog.showModal()
  })
