import './style.css'
import { installAppearance } from './appearance'
import { requireWorkspaceSession } from './workspace-login'
installAppearance()
const root = document.querySelector<HTMLElement>('#app')!
void requireWorkspaceSession(root).then(async (session) => {
  document.documentElement.dataset.workspaceUser = session.user!.name
  document.documentElement.dataset.workspaceMode = session.mode
  await import('./main')
})
let renewing = false
document.addEventListener('studio:session-expired', () => {
  if (renewing) return
  renewing = true
  document
    .querySelectorAll<HTMLDialogElement>('dialog[open]')
    .forEach((dialog) => dialog.close())
  const overlay = document.createElement('div')
  overlay.className = 'workspace-auth-overlay'
  document.body.append(overlay)
  root.inert = true
  void requireWorkspaceSession(overlay, true).then(() => {
    overlay.remove()
    root.inert = false
    renewing = false
  })
})
