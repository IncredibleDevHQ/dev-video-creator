import { reviewBrand } from './brand-review'
import { brandStory, installBrandStory } from './brand-story'
import { themeControl } from './appearance'
import { api } from './api'
import type { AppContext } from './app-context'
import type { NotebookSummary } from '../shared/api'
import incredibleLogo from './assets/incredible-logo.svg'
import { AgentSetup } from './agent-setup'
import { sourceComposer, updateSourceComposer } from './source-composer'
import { rollingHeadline } from './rolling-headline'
import { replacePlayerView } from './player-view'
import { button, escape } from './ui'
import { installNotebookEditor, flushNotebookEdits } from './notebook-editor'

export const createRefreshNotebooks = (app: AppContext) => async () => {
  app.notebooks = await api.notebooks()
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
  if (/^(https?:\/\/|www\.)\S+$/i.test(text))
    return 'Link · we’ll read the article'
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
    ? 'Reading source'
    : item.status === 'draft'
      ? 'Ready to create wireframes'
      : item.status === 'failed'
        ? 'Needs another try'
        : item.status === 'building'
          ? 'Wireframes in progress'
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
  const recent = app.showAllRecent ? app.notebooks : app.notebooks.slice(0, 6)
  replacePlayerView(
    app.root,
    `<header class="home">
<a class="brand" href="/" aria-label="Incredible Studio">
<img src="${incredibleLogo}" alt="">Incredible</a>
<div class="header-actions">${themeControl()}${button('Settings', 'settings')}</div></header>
<main class="start has-story${app.notebooks.length ? ' has-recent' : ''}">
${rollingHeadline()}
<form id="source">
<label class="sr" for="source-input">Blog link or Markdown</label>
${sourceComposer(app.pending)}
<div class="source-meta">
<small id="source-hint" class="source-hint" aria-live="polite"></small>
</div>
</form>
${brandStory()}

${
  app.notebooks.length
    ? `<section class="saved-notebooks" aria-labelledby="recent-heading">
<h2 id="recent-heading">Recent</h2>
<div class="notebook-tiles">
${recent.map((item) => notebookTile(app, item)).join('')}
</div>${
        app.notebooks.length > recent.length
          ? `<button type="button" class="quiet show-all" data-action="all-recent">Show all ${app.notebooks.length}</button>`
          : ''
      }</section>`
    : ''
}</main>`,
    previousPlayer
  )
}

export const createShowExplainer = (app: AppContext) => () => {
  app.showDialog(
    `<p class="eyebrow">THE FIRST STEP</p>
<h2>Your video starts with wireframes.</h2>
<div class="explain-picture">
<span>▤<small>A wireframe</small>
</span>
<b>→</b>
<span>▷<small>A scene</small>
</span>
<b>→</b>
<span>▶<small>Your video</small>
</span>
</div>
<p>Refine your wireframes before bringing them to life.<br>A finished video takes minutes.</p>
${button('Show me the wireframes', 'understood', true)}`
  )
  app.dialog.dataset.explainer = 'yes'
}
export const installStartController = (app: AppContext) => {
  installNotebookEditor(app)
  installBrandStory(app.root)
  app.root.addEventListener('input', (event) => {
    const field = event.target as HTMLTextAreaElement
    if (field.id === 'source-input') app.fitSource(field)
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
  if (action === 'review-brand') {
    await reviewBrand(app, id)
    app.render()
    return
  }
  if (action === 'create-presentation') {
    await createPresentation(app)
    return
  }
  if (action === 'refresh-source') {
    target.disabled = true
    try {
      await flushNotebookEdits(app)
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

export const createPresentation = async (app: AppContext) => {
  if (!app.snapshot || app.pending || app.snapshot.status !== 'draft') return
  await flushNotebookEdits(app)
  const id = app.snapshot.project.id
  if (!(await reviewBrand(app, id))) return
  const begin = async () => {
    const snapshot = await api.createPresentation(id)
    if (app.snapshot?.project.id !== id) return
    app.stage = 'presentation'
    app.attach(snapshot)
  }
  if (app.snapshot.project.harness) {
    app.pending = true
    try {
      await begin()
      return
    } catch (error) {
      app.error(error)
    } finally {
      app.pending = false
    }
  }
  if (app.snapshot?.project.id !== id) return
  app.showDialog('<h2>Choose your local agent</h2><div data-agent-setup></div>')
  const revision = app.dialogRevision
  const setup = new AgentSetup(
    app.dialog.querySelector<HTMLElement>('[data-agent-setup]')!,
    app.snapshot.project.harness || null,
    async (harness) => {
      await api.saveSettings({ harness, projectId: id })
      if (
        !app.dialog.open ||
        revision !== app.dialogRevision ||
        app.snapshot?.project.id !== id
      )
        return
      const saved = await api.load(id)
      if (
        !app.dialog.open ||
        revision !== app.dialogRevision ||
        app.snapshot?.project.id !== id
      )
        return
      app.snapshot = saved
      await begin()
      app.dialog.close()
    },
    'Save and create wireframes →'
  )
  app.dialog.addEventListener('close', () => setup.dispose(), { once: true })
}
