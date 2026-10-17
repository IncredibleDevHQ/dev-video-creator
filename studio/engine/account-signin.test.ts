import { afterEach, expect, it, vi } from 'vitest'
import { parseHTML } from 'linkedom'

// The sign-in button as the creator presses it: the provider's page opens,
// and the dialog waits for how it ended (review 6, REL-6).
const { request } = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('../app/studio-api', () => ({ studioApi: { request } }))
vi.mock('../app/release-controller', () => ({ showRelease: vi.fn() }))
vi.mock('../app/accounts-view', () => ({
  accountsDialog: () => '<p>Accounts</p>'
}))
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  request.mockReset()
})

const press = async (agent: string, opened: Window | null) => {
  const { document } = parseHTML(
    '<dialog open><button data-provider="x">Connect X</button></dialog>'
  )
  vi.stubGlobal('navigator', { userAgent: agent })
  vi.stubGlobal('window', { open: () => opened })
  const dialog = document.querySelector('dialog')!
  const app = { dialog: { open: true, dataset: {} }, showDialog: vi.fn() }
  const target = document.querySelector('button')!
  const { clickAccounts } = await import('../app/accounts-controller')
  await clickAccounts(app as never, target as never, 'connect-account')
  return { app, target, dialog }
}

it('waits for the sign-in when the desktop app opened it in the browser', async () => {
  vi.useFakeTimers()
  request.mockResolvedValueOnce({ url: 'https://x.com/i/oauth2/authorize' })
  const { app, target, dialog } = await press(
    'Mozilla/5.0 Chrome/130 Electron/33.0.0 Safari/537.36',
    null
  )
  expect(target.textContent).toBe('Waiting for the sign-in…')
  expect(dialog.innerHTML).not.toContain('blocked')
  // A check that fails is tried again; the next one sees the account.
  request.mockRejectedValueOnce(new Error('The studio is restarting'))
  await vi.advanceTimersByTimeAsync(2000)
  request.mockResolvedValueOnce({
    accounts: [
      { provider: 'x', connected: { at: new Date(Date.now()).toISOString() } }
    ]
  })
  await vi.advanceTimersByTimeAsync(2000)
  expect(app.showDialog).toHaveBeenCalledTimes(1)
})

it('says a browser blocked the sign-in window', async () => {
  request.mockResolvedValueOnce({ url: 'https://x.com/i/oauth2/authorize' })
  const { target, dialog } = await press(
    'Mozilla/5.0 Chrome/130 Safari/537.36',
    null
  )
  expect(dialog.innerHTML).toContain('The browser blocked the sign-in window')
  expect(target.textContent).toBe('Connect X')
})
