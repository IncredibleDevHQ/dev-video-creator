import { brandStory, controlIcon, installBrandStory } from './brand-story'
import { animateBrandStory } from './brand-story-timeline'
import { openAgentMenu } from './agent-menu'
import { themeControl } from './appearance'
import { api } from './api'
import type { AppContext } from './app-context'
import type { NotebookSummary } from '../shared/api'
import { gear } from './camera-settings'
import { sourceLink } from '../shared/source-link'
import incredibleLogo from './assets/incredible-logo.svg'
import { sourceComposer, updateSourceComposer } from './source-composer'
import { rollingHeadline } from './rolling-headline'
import { replacePlayerView } from './player-view'
import { button, escape } from './ui'
import { seriesApi } from './series-controller'
import { seriesSection } from './series-view'
import { installNotebookEditor, saveBeforeLeaving } from './notebook-editor'
import { confirmAction } from './confirm-action'

export const createRefreshNotebooks = (app: AppContext) => async () => {
  ;[app.notebooks, app.series] = await Promise.all([
    api.notebooks(),
    seriesApi.list().catch(() => app.series)
  ])
  if (!app.snapshot && !app.settingsScreen.isOpen) app.render()
}

export const createAgo = (app: AppContext) => (iso: string) => {
  const seconds = (Date.parse(iso) - Date.now()) / 1000
  if (!Number.isFinite(seconds)) return ''
  const format = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  for (const [unit, size] of [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60]
  ] as const)
    if (Math.abs(seconds) >= size)
      return format.format(Math.round(seconds / size), unit)
  return 'just now'
}

export const createSourceHint = (app: AppContext) => (value: string) => {
  const text = value.trim()
  if (!text) return ''
  if (sourceLink(text)) return 'Link · we’ll read the article'
  const words = text.split(/\s+/).length
  return `Your text · ${words.toLocaleString()} ${
    words === 1 ? 'word' : 'words'
  }`
}

export const createFitSource =
  (app: AppContext) => (field: HTMLTextAreaElement) => {
    field.style.height = 'auto'
    field.style.height = `${Math.min(field.scrollHeight + 2, 220)}px`
    updateSourceComposer(field, app.pending)
    const hint = field.form?.querySelector('#source-hint')
    if (hint) hint.textContent = app.sourceHint(field.value)
  }

const notebookState = (item: NotebookSummary) =>
  item.status === 'reading'
    ? 'Reading the source'
    : item.status === 'draft'
      ? 'Ready to create wireframes'
      : item.status === 'failed'
        ? 'Needs another try'
        : item.status === 'building'
          ? 'Wireframes in progress'
          : item.videoReady
            ? 'Video ready'
            : item.hasVideo
              ? 'Video in progress'
              : 'Wireframes ready'

/** One tile: the first slide as its picture, then the title and where it came from. */
const notebookTile = (
  app: AppContext,
  item: NotebookSummary
) => `<button class="notebook-tile" data-notebook="${escape(item.id)}">
<span class="tile-picture ${item.status === 'building' ? 'is-building' : ''}" aria-hidden="true">
${item.preview || `<span class="tile-empty">${item.status === 'building' ? 'Designing…' : 'No wireframes yet'}</span>`}
</span>
<span class="tile-title">${escape(item.title)}</span>
<span class="tile-meta">${escape(item.site || 'Your text')}${
  item.updatedAt ? ` · ${escape(app.ago(item.updatedAt))}` : ''
}</span>
<span class="tile-state ${item.status === 'failed' ? 'is-failed' : ''}">${notebookState(item)}</span>
</button>`

export const createRenderStartScreen = (app: AppContext) => () => {
  const previousPlayer = app.root.querySelector<HTMLMediaElement>(
    '[data-scene-player]'
  )
  const recent = app.showAllRecent ? app.notebooks : app.notebooks.slice(0, 8)
  // Your work is the home page: the notebooks sit straight under the field,
  // and the demo shows only until there is a notebook (review 5).
  const firstVisit = !app.notebooks.length
  replacePlayerView(
    app.root,
    `<header class="home">
<a class="brand" href="/" aria-label="Incredible Studio">
<img src="${incredibleLogo}" alt="">Incredible</a>
<div class="header-actions">${themeControl()}${button('Templates', 'open-templates')}<button type="button" data-action="settings" class="icon-button" aria-label="Settings" title="Settings">${gear}</button></div></header>
<main class="start has-story${firstVisit ? '' : ' has-recent'}">
${rollingHeadline()}
<form id="source">
<label class="sr" for="source-input">Blog link or Markdown</label>
${sourceComposer(app.pending)}
<div class="source-meta">
<small id="source-hint" class="source-hint" aria-live="polite"></small>
</div>
</form>
${
  firstVisit
    ? brandStory()
    : `<section class="saved-notebooks" aria-labelledby="recent-heading">
<div class="saved-notebooks-heading"><h2 id="recent-heading">Your notebooks</h2><span><button type="button" class="quiet how-it-works" data-action="new-series">Start a series</button><button type="button" class="quiet how-it-works" data-action="how-it-works">How it works</button></span></div>
<div class="notebook-tiles">
${recent.map((item) => notebookTile(app, item)).join('')}
</div>${
        app.notebooks.length > recent.length
          ? `<button type="button" class="quiet show-all" data-action="all-recent">Show all ${app.notebooks.length}</button>`
          : ''
      }</section>`
}${seriesSection(app.series)}</main>`,
    previousPlayer
  )
}

/** The demo, on request, once the home page shows the creator's notebooks. */
export const showHowItWorks = (app: AppContext) => {
  app.showDialog(brandStory())
  app.dialog.dataset.story = 'yes'
  const story = app.dialog.querySelector<HTMLElement>('.brand-story')
  const dispose = story ? animateBrandStory(story, controlIcon) : undefined
  app.dialog.addEventListener(
    'close',
    () => {
      dispose?.()
      delete app.dialog.dataset.story
    },
    { once: true }
  )
}
/** Whether the creator edited the notes since the article was last read. */
const notesEdited = (snapshot: import('../shared/api').Snapshot) => {
  const said = snapshot.events
    .filter((event) => event.kind === 'slide')
    .map((event) => event.message)
  const edited = said.lastIndexOf('Notebook notes edited')
  const read = said.reduce(
    (last, message, index) =>
      message.startsWith('Source ready') ? index : last,
    -1
  )
  return edited > read
}

export const installStartController = (app: AppContext) => {
  installNotebookEditor(app)
  installBrandStory(app.root)
  app.root.addEventListener('input', (event) => {
    const field = event.target as HTMLTextAreaElement
    if (field.id === 'source-input') app.fitSource(field)
  })
  // A link dragged from another tab becomes the field's text.
  app.root.addEventListener('dragover', (event) => {
    if ((event.target as Element).closest?.('#source-input'))
      event.preventDefault()
  })
  app.root.addEventListener('drop', (event) => {
    const field = (event.target as Element).closest?.<HTMLTextAreaElement>(
      '#source-input'
    )
    const data = event.dataTransfer
    if (!field || !data || field.readOnly) return
    const link = data
      .getData('text/uri-list')
      .split(/\r?\n/)
      .find((line) => line && !line.startsWith('#'))
    const text = link || data.getData('text/plain')
    if (!text.trim()) return
    event.preventDefault()
    field.value = text.trim()
    field.focus()
    app.fitSource(field)
  })
  app.root.addEventListener('keydown', (event) => {
    const field = event.target as HTMLTextAreaElement
    if (
      field.id === 'source-input' &&
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.isComposing
    ) {
      event.preventDefault()
      field.form?.requestSubmit()
    }
  })
}

export const submitStart = async (
  app: AppContext,
  form: HTMLFormElement,
  values: FormData
) => {
  if (form.id === 'source') {
    if (app.pending) return
    app.pendingSource = String(values.get('source')).trim()
    if (!app.pendingSource) return
    app.pending = true
    app.render()
    try {
      const created = await api.create({
        source: app.pendingSource,
        sourceOnly: true
      })
      app.pendingSource = ''
      app.stage = 'notebook'
      app.attach(created)
    } finally {
      app.pending = false
      app.render()
    }
  }
  if (form.id === 'source-recovery' && app.snapshot) {
    app.snapshot = await api.replaceSource(
      app.snapshot.project.id,
      String(values.get('text') || '')
    )
    app.dialog.close()
    app.stage = app.snapshot.sourceOnly ? 'notebook' : 'presentation'
    app.render()
  }
}

export const clickStart = async (
  app: AppContext,
  target: HTMLButtonElement,
  action: string | undefined
) => {
  if (!app.snapshot) return
  const id = app.snapshot.project.id
  const slideId = app.snapshot.project.slides[app.selected]?.id
  if (action === 'create-presentation') {
    await createPresentation(app)
    return
  }
  if (action === 'refresh-source') {
    // Notes that can't be saved don't hold the re-read: it replaces them.
    // The button waits while they save.
    target.disabled = true
    const saved = await saveBeforeLeaving(app, {
      question: 'Re-read the article anyway? It replaces the notes.',
      action: 'Re-read the article'
    })
    // Edited notes are the creator's: re-reading replaces them, so ask, once
    // they are saved, so an edit just typed counts too (review 6). Agreed to
    // already, when they could not be saved, it is not asked twice.
    if (
      !saved ||
      !app.snapshot ||
      (saved === 'saved' &&
        notesEdited(app.snapshot) &&
        !(await confirmAction({
          title: 'Re-read the article?',
          detail:
            'Your edits to the notes will be replaced by the article as it reads now.',
          action: 'Re-read the article'
        })))
    ) {
      target.disabled = false
      return
    }
    try {
      const snapshot = await api.refreshSource(id)
      if (app.snapshot?.project.id === id) {
        app.stage = 'notebook'
        app.attach(snapshot)
      }
    } finally {
      target.disabled = false
    }
    return
  }
  if (action === 'paste-source')
    app.showDialog(
      `<h2>Paste the article text</h2>
<p>The site blocked automatic reading. Copy its article text here to continue this notebook.</p>
<form id="source-recovery">
<label for="article-text">Article text</label>
<textarea id="article-text" name="text" required minlength="40">
</textarea>
<button class="primary">Continue with this text →</button>

</form>`
    )
}

/**
 * Create starts straight away: with the notebook's agent, else the one found
 * on this computer, and the notebook's look. No agent page, brand dialog or
 * explainer stands before the first wireframe (review 5).
 */
export const createPresentation = async (app: AppContext) => {
  if (!app.snapshot || app.pending || app.snapshot.status !== 'draft') return
  const id = app.snapshot.project.id
  // The button answers at once: saving the notes and finding the agent can
  // take a moment (review 6).
  app.pending = true
  app.render()
  try {
    // Notes that can't be saved don't hold Create: it can go on from the
    // notes as last saved (review 6).
    const saved = await saveBeforeLeaving(app, {
      question: 'Create from the notes as last saved, without the edits since?',
      action: 'Create without the edits'
    })
    if (!saved) return
    const snapshot = await api.createPresentation(id)
    if (app.snapshot?.project.id !== id) return
    app.stage = 'presentation'
    app.attach(snapshot)
  } catch (error) {
    app.error(error)
    const pill = app.root.querySelector<HTMLElement>('.agent-pill')
    if (pill && /No agent was found/.test(String((error as Error)?.message)))
      openAgentMenu(app, pill)
  } finally {
    app.pending = false
    app.render()
  }
}
