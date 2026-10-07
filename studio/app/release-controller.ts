// The release dialog: teasers, words, the bundle, and what follows it.
import type { Snapshot } from '../shared/api'
import type { AppContext } from './app-context'
import { campaignSection } from './campaign-view'
import { confirmAction } from './confirm-action'
import { numbersSection } from './numbers-view'
import { releaseBusy, releaseDialog } from './release-view'
import { studioApi } from './studio-api'

/** The sections after the bundle: the campaign, then the numbers. */
const extras: Array<(snapshot: Snapshot) => string> = [
  campaignSection,
  numbersSection
]

let following: ReturnType<typeof setTimeout> | null = null
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
  if (following) clearTimeout(following)
  if (releaseBusy(snapshot))
    following = setTimeout(() => {
      following = null
      if (
        app.dialog.open &&
        app.dialog.dataset.release === app.snapshot?.project.id
      )
        showRelease(app)
    }, 2000)
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
        state: target.dataset.state
      })
    )
  if (action === 'campaign-post') {
    const x = target.dataset.channel === 'x'
    // Posting is public and, on X, charged: the creator says yes first.
    const sure = await confirmAction({
      title: `Post on ${x ? 'X' : 'LinkedIn'} now?`,
      detail: x
        ? 'It goes out from your X app, which is charged for it (see Accounts for the prices).'
        : 'It goes out on LinkedIn as you.',
      action: 'Post now'
    })
    if (!sure) return
    target.disabled = true
    update(
      app,
      await studioApi.notebook(id, 'campaign', {
        action: 'post',
        item: target.dataset.item
      })
    )
  }
  if (action === 'draft-posts') {
    target.disabled = true
    update(app, await studioApi.notebook(id, 'posts'))
  }
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
