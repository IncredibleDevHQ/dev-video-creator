// The release dialog: teasers, words, the bundle, and what follows it.
import type { Snapshot } from '../shared/api'
import type { AppContext } from './app-context'
import { campaignSection } from './campaign-view'
import { confirmAction } from './confirm-action'
import { numbersSection } from './numbers-view'
import { releaseBusy, releaseDialog } from './release-view'
import { studioApi } from './studio-api'
import { busy, typingIn } from './ui'
import type { AccountsView } from '../shared/accounts'

/** The sections after the bundle: the campaign, then the numbers. */
const extras: Array<(snapshot: Snapshot) => string> = [
  campaignSection,
  numbersSection
]

let following: ReturnType<typeof setTimeout> | null = null
let shown = ''
/** What the follow loop watches: whatever is still being made. */
const progress = (snapshot: Snapshot) => {
  const release = snapshot.project.release
  return JSON.stringify([
    release?.teasers.map((item) => [item.id, item.state]),
    release?.drafting?.state,
    release?.youtube?.state,
    release?.campaign.map((item) => item.state)
  ])
}
/** Shows the release, and follows it while a teaser or the words are made. */
export const showRelease = (app: AppContext) => {
  const snapshot = app.snapshot
  if (!snapshot) return
  const scroll = app.dialog.open ? app.dialog.scrollTop : 0
  app.showDialog(
    releaseDialog(snapshot, extras.map((section) => section(snapshot)).join(''))
  )
  app.dialog.dataset.release = snapshot.project.id
  app.dialog.scrollTop = scroll
  shown = progress(snapshot)
  if (following) clearTimeout(following)
  if (releaseBusy(snapshot)) follow(app)
}

// Refreshes while something is made: only when it changed, never under the
// creator's typing, and never over another dialog opened from this one.
const follow = (app: AppContext) => {
  following = setTimeout(() => {
    following = null
    const snapshot = app.snapshot
    if (
      !snapshot ||
      !app.dialog.open ||
      !app.dialog.querySelector('#release-form') ||
      app.dialog.dataset.release !== snapshot.project.id
    )
      return
    if (typingIn(app.dialog) || progress(snapshot) === shown) follow(app)
    else showRelease(app)
  }, 2000)
}

/** With a publish time the upload is private until then: the privacy
 * choice is disabled and says so. */
export const syncPublishForm = (form: Element | null | undefined) => {
  const at = form?.querySelector<HTMLInputElement>('[name="publishAt"]')
  const privacy = form?.querySelector<HTMLSelectElement>('[name="privacy"]')
  if (!at || !privacy) return
  privacy.disabled = Boolean(at.value)
  if (at.value) privacy.value = 'private'
}

/** The words typed in an item's row, when its form is open. */
const typedWords = (target: HTMLElement) => {
  const row = target.closest('.campaign-item')
  const field = row?.querySelector<HTMLTextAreaElement>(
    'form.campaign-edit textarea[name="words"]'
  )
  return field ? field.value : null
}

const update = (app: AppContext, snapshot: Snapshot) => {
  app.snapshot = snapshot
  showRelease(app)
}

export const clickRelease = async (
  app: AppContext,
  target: HTMLButtonElement,
  action: string | undefined
) => {
  if (!app.snapshot) return
  const id = app.snapshot.project.id
  if (action === 'release-dialog') showRelease(app)
  if (action === 'plan-campaign')
    update(app, await studioApi.notebook(id, 'campaign', { action: 'plan' }))
  if (action === 'campaign-state')
    update(
      app,
      await studioApi.notebook(id, 'campaign', {
        action: 'change',
        item: target.dataset.item,
        state: target.dataset.state,
        // Approving keeps what was typed (review 6: it wiped it).
        ...(typedWords(target) !== null ? { words: typedWords(target) } : {})
      })
    )
  if (action === 'campaign-post') {
    const x = target.dataset.channel === 'x'
    const item = app.snapshot.project.release?.campaign.find(
      (entry) => entry.id === target.dataset.item
    )
    // The words on screen, as typed, are the ones confirmed and posted.
    const words = typedWords(target) ?? item?.words ?? ''
    // Posting is public and, on X, charged: the creator sees the words and
    // the price, and says yes first.
    const prices = x
      ? (await studioApi.request<AccountsView>('/accounts')).xPrices
      : null
    const cost = prices
      ? /https?:\/\/|\{link\}/.test(words)
        ? prices.postWithLink
        : prices.post
      : 0
    const again = Boolean(target.dataset.again)
    const sure = await confirmAction({
      title: again ? 'Post it again?' : `Post on ${x ? 'X' : 'LinkedIn'} now?`,
      detail: `${again ? `No answer came back last time, so it may already be on ${x ? 'X' : 'LinkedIn'}: check your feed first, or it could show twice. ` : ''}“${words.length > 160 ? `${words.slice(0, 160)}…` : words}” ${
        x
          ? `It goes out from your X app, which is charged about $${cost.toFixed(3).replace(/0$/, '')} for it.`
          : 'It goes out on LinkedIn as you.'
      }`,
      action: again ? 'Post again' : 'Post now'
    })
    if (!sure) return
    await busy(target, async () =>
      update(
        app,
        await studioApi.notebook(id, 'campaign', {
          action: 'post',
          item: target.dataset.item,
          words,
          ...(again ? { again: true } : {})
        })
      )
    )
  }

  // A publish time is chosen, never filled in: with one, YouTube keeps it
  // private until then, so the privacy choice steps aside (review 6).
  if (action === 'use-release-date') {
    const form = target.closest('form')
    const field = form?.querySelector<HTMLInputElement>('[name="publishAt"]')
    if (field) field.value = target.dataset.at || ''
    syncPublishForm(form)
    return
  }
  if (action === 'draft-posts')
    await busy(target, async () =>
      update(app, await studioApi.notebook(id, 'posts'))
    )
}

export const submitRelease = async (
  app: AppContext,
  form: HTMLFormElement,
  values: FormData
) => {
  if (!app.snapshot) return
  const id = app.snapshot.project.id
  if (form.id === 'teaser-form') {
    const [channel, aspect] = String(values.get('cut') || '').split(' ')
    const moment = String(values.get('moment') || '').trim()
    update(
      app,
      await studioApi.notebook(id, 'teasers', {
        channel,
        aspect,
        ...(moment ? { moment: Number(moment) } : {})
      })
    )
  }
  if (form.id === 'youtube-publish-form') {
    const at = String(values.get('publishAt') || '')
    const privacy = String(values.get('privacy') || 'private')
    const sure = await confirmAction({
      title: 'Upload to YouTube?',
      detail: at
        ? `It goes up private, and YouTube publishes it at ${new Date(at).toLocaleString()}.`
        : `It goes up ${privacy} on your channel.`,
      action: 'Upload'
    })
    if (!sure) return
    update(
      app,
      await studioApi.notebook(id, 'youtube', {
        privacy,
        ...(at ? { publishAt: new Date(at).toISOString() } : {})
      })
    )
  }
  if (form.matches('.campaign-edit'))
    update(
      app,
      await studioApi.notebook(id, 'campaign', {
        action: 'change',
        item: form.dataset.item,
        words: values.get('words'),
        time: values.get('time'),
        offsetDays: Number(values.get('offsetDays'))
      })
    )
  if (form.id === 'posts-form')
    update(
      app,
      await studioApi.notebook(id, 'release', {
        posts: {
          x: values.get('x'),
          linkedin: values.get('linkedin'),
          youtube: values.get('youtube')
        }
      })
    )
  if (form.id === 'release-form') {
    const at = String(values.get('at') || '')
    update(
      app,
      await studioApi.notebook(id, 'release', {
        at: at ? new Date(at).toISOString() : null
      })
    )
  }
}
