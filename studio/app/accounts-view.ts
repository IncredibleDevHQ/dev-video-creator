// The creator's accounts: for each, their own app (client id, secret kept
// by the engine), the address to register, and who is signed in.
import {
  PROVIDER_CONSOLES,
  PROVIDER_LABELS,
  expiresSoon,
  type AccountView,
  type AccountsView
} from '../shared/accounts'
import { escape } from './ui'

const NOTES: Record<AccountView['provider'], string> = {
  google:
    'Reads your channel’s numbers. Publishing from the studio stays private until the app passes Google’s verification and YouTube’s audit; until then use the upload bundle.',
  x: 'Posts with video from your own X app. Each post is charged to the app’s owner.',
  linkedin:
    'Posts as you. Company pages and LinkedIn’s numbers need its vetted API; enter those numbers by hand. Sign in again every 60 days.'
}

const accountRow = (account: AccountView) => {
  const label = PROVIDER_LABELS[account.provider]
  const app = account.fromEnvironment
    ? '<p class="account-note">The app is set in the studio’s .env.</p>'
    : `<form class="account-app" data-provider="${account.provider}">
<label>Client id<input name="clientId" value="${escape(account.clientId || '')}" autocomplete="off" required></label>
<label>Client secret<input name="clientSecret" type="password" placeholder="${account.hasSecret ? 'Kept by the studio' : ''}" autocomplete="off"></label>
<button class="quiet">Keep</button></form>`
  return `<section class="account-row"><h3>${label}${account.connected ? ` <small>${escape(account.connected.name)}</small>` : ''}</h3>
<p class="account-note">${NOTES[account.provider]}</p>
${app}
<p class="account-note">Make the app at <a href="${PROVIDER_CONSOLES[account.provider]}" target="_blank" rel="noopener">${new URL(PROVIDER_CONSOLES[account.provider]).host}</a> and register <code>${escape(account.redirectUri)}</code> as its redirect.</p>
${expiresSoon(account) ? '<p class="account-warn">The connection ends within a week: sign in again.</p>' : ''}
<div class="account-actions">${
    account.connected
      ? `<button type="button" class="quiet" data-action="disconnect-account" data-provider="${account.provider}">Disconnect</button><button type="button" data-action="connect-account" data-provider="${account.provider}">Sign in again</button>`
      : `<button type="button" data-action="connect-account" data-provider="${account.provider}" ${account.clientId ? '' : 'disabled'}>Connect ${label}</button>`
  }</div></section>`
}

export const accountsDialog = (view: AccountsView) => `<h2>Accounts</h2>
<p>Sign-ins happen in your browser and come back to the studio on this computer. Tokens stay with the studio’s engine.</p>
${view.accounts.map(accountRow).join('')}
<form id="x-prices" class="x-prices"><h3>X prices <small>per post, in dollars</small></h3>
<label>Post<input name="post" type="number" step="0.001" min="0" value="${view.xPrices.post}"></label>
<label>With a link<input name="postWithLink" type="number" step="0.001" min="0" value="${view.xPrices.postWithLink}"></label>
<button class="quiet">Keep</button></form>
<div class="dialog-actions"><button type="button" class="quiet" data-action="close">Close</button></div>`
