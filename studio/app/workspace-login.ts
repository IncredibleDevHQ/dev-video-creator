import { html } from '../shared/html'
import incredibleLogo from './assets/incredible-logo.svg'
import './styles/workspace-login.css'
export type WorkspaceSession = {
  mode: 'local' | 'password'
  user: { name: string; email?: string } | null
}
const authRequest = async (
  path: string,
  body?: unknown
): Promise<WorkspaceSession> => {
  const response = await fetch(
    `/api/auth/${path}`,
    body === undefined
      ? { cache: 'no-store' }
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }
  )
  const result = await response.json()
  if (!response.ok)
    throw new Error(result.error || 'Could not sign in. Try again.')
  return result
}
export const signOutWorkspace = async () => {
  await authRequest('logout', {})
  location.reload()
}
/** Authentication is resolved before mounting the workspace or loading its data. */
export const requireWorkspaceSession = async (
  root: HTMLElement,
  returning = false
): Promise<WorkspaceSession> => {
  root.innerHTML =
    '<div class="workspace-auth-loading" role="status">Opening your workspace…</div>'
  let session: WorkspaceSession
  try {
    session = await authRequest('session')
  } catch {
    root.innerHTML =
      '<div class="workspace-auth-loading" role="alert">Studio is unavailable. Start the local server, then try again.<button>Try again</button></div>'
    await new Promise<void>((resolve) =>
      root
        .querySelector('button')!
        .addEventListener('click', () => resolve(), { once: true })
    )
    return requireWorkspaceSession(root, returning)
  }
  if (session.user) return session
  root.innerHTML = html`<main class="workspace-welcome">
    <section class="workspace-welcome-story">
      <a href="/" class="workspace-login-brand"
        ><img src="${incredibleLogo}" alt="" />Incredible</a
      >
      <div>
        <span>A HOME FOR YOUR IDEAS</span>
        <h1>Learn something.<br />Make it something.</h1>
        <p>
          Notes, conversations and your next story.<br />One workspace to keep
          them together.
        </p>
      </div>
      <small>Capture → Explore → Create</small>
    </section>
    <section class="workspace-signin">
      <form id="workspace-login-form">
        <h2>${returning ? 'Sign in again' : 'Welcome to your workspace'}</h2>
        <p>
          ${returning
            ? 'Your session ended. Sign in to return to your open work.'
            : session.mode === 'local'
              ? 'Start here. No account or password needed.'
              : 'Sign in to continue your research and creative work.'}
        </p>
        ${session.mode === 'password'
          ? '<label for="workspace-email">Email</label><input id="workspace-email" name="email" type="email" autocomplete="username" required /><label for="workspace-password">Password</label><input id="workspace-password" name="password" type="password" autocomplete="current-password" required />'
          : ''}
        <button class="workspace-login-submit">
          ${session.mode === 'local' ? 'Continue locally →' : 'Sign in →'}
        </button>
        <p class="workspace-login-error" role="alert"></p>
        <small
          >${returning
            ? 'Your session ended. Sign in to return to your open work.'
            : session.mode === 'local'
              ? 'Local development · Your projects stay in this Studio instance.'
              : 'Use the owner credentials configured for this Studio instance.'}</small
        >
      </form>
    </section>
  </main>`
  root.querySelector<HTMLElement>('input, .workspace-login-submit')?.focus()
  return new Promise((resolve) => {
    root.querySelector('form')!.addEventListener('submit', async (event) => {
      event.preventDefault()
      const form = event.target as HTMLFormElement
      const button = form.querySelector<HTMLButtonElement>('button')!
      const error = form.querySelector('.workspace-login-error')!
      if (button.disabled) return
      button.disabled = true
      error.textContent = ''
      try {
        const fields = new FormData(form)
        const authenticated = await authRequest(
          'login',
          session.mode === 'local'
            ? {}
            : { email: fields.get('email'), password: fields.get('password') }
        )
        if (!authenticated.user)
          throw new Error('Sign-in did not complete. Try again.')
        resolve(authenticated)
      } catch (cause) {
        error.textContent =
          cause instanceof Error ? cause.message : 'Could not sign in.'
        button.disabled = false
      }
    })
  })
}
