// Accounts and numbers: the creator's apps, signing in, reading back.
import type { AccountsView } from '../shared/accounts'
import type { AppContext } from './app-context'
import { accountsDialog } from './accounts-view'
import { showRelease } from './release-controller'
import { studioApi } from './studio-api'
import { busy } from './ui'

const accountsApi = {
  view: () => studioApi.request<AccountsView>('/accounts'),
  saveApp: (provider: string, body: unknown) =>
    studioApi.request<AccountsView>(`/accounts/${provider}/app`, 'POST', body),
  connect: (provider: string) =>
    studioApi.request<{ url: string }>(
      `/accounts/${provider}/connect`,
      'POST',
      {}
    ),
  disconnect: (provider: string) =>
    studioApi.request<AccountsView>(
      `/accounts/${provider}/disconnect`,
      'POST',
      {}
    ),
  prices: (body: unknown) =>
    studioApi.request<AccountsView>('/accounts/prices', 'POST', body)
}

const showAccounts = (app: AppContext, view: AccountsView) => {
  app.showDialog(accountsDialog(view))
  delete app.dialog.dataset.release
  app.dialog.dataset.accounts = 'yes'
}

export const clickAccounts = async (
  app: AppContext,
  target: HTMLButtonElement,
  action: string | undefined
) => {
  const provider = target.dataset.provider || ''
  if (action === 'accounts') {
    showAccounts(app, await accountsApi.view())
    return true
  }
  if (action === 'connect-account') {
    const { url } = await accountsApi.connect(provider)
    // The provider's page opens in the browser; it comes back to the engine.
    window.open(url, '_blank', 'noopener')
    target.textContent = 'Waiting for the sign-in…'
    const started = Date.now()
    const check = async () => {
      if (!app.dialog.open || Date.now() - started > 5 * 60_000) return
      const view = await accountsApi.view()
      const account = view.accounts.find((item) => item.provider === provider)
      if (
        account?.connected &&
        Date.parse(account.connected.at) >= started - 1000
      )
        showAccounts(app, view)
      else setTimeout(() => void check().catch(() => {}), 2000)
    }
    setTimeout(() => void check().catch(() => {}), 2000)
    return true
  }
  if (action === 'disconnect-account') {
    showAccounts(app, await accountsApi.disconnect(provider))
    return true
  }
  if (action === 'read-numbers' && app.snapshot) {
    const id = app.snapshot.project.id
    await busy(target, async () => {
      app.snapshot = await studioApi.notebook(id, 'numbers', { action: 'read' })
    })
    showRelease(app)
    return true
  }

  return false
}

export const submitAccounts = async (
  app: AppContext,
  form: HTMLFormElement,
  values: FormData
) => {
  if (form.matches('.account-app') && form.dataset.provider)
    showAccounts(
      app,
      await accountsApi.saveApp(form.dataset.provider, {
        clientId: values.get('clientId'),
        clientSecret: values.get('clientSecret')
      })
    )
  if (form.id === 'x-prices')
    showAccounts(
      app,
      await accountsApi.prices({
        post: values.get('post'),
        postWithLink: values.get('postWithLink')
      })
    )
  if (!app.snapshot) return
  const id = app.snapshot.project.id
  if (form.id === 'youtube-video-form') {
    app.snapshot = await studioApi.notebook(id, 'numbers', {
      action: 'video',
      video: values.get('video')
    })
    showRelease(app)
  }
  if (form.id === 'hand-numbers') {
    app.snapshot = await studioApi.notebook(id, 'numbers', {
      action: 'enter',
      impressions: values.get('impressions') || undefined,
      likes: values.get('likes') || undefined,
      reposts: values.get('reposts') || undefined,
      replies: values.get('replies') || undefined
    })
    showRelease(app)
  }
}
