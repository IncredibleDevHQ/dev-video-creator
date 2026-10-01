import { api } from './api'
import type { AppContext } from './app-context'
import incredibleLogo from './assets/incredible-logo.svg'
import { aiLabel, chooseAiDialog } from './choose-ai'
import { replacePlayerView } from './player-view'
import { button, escape } from './ui'

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
    const hint = document.querySelector('#source-hint')
    if (hint) hint.textContent = app.sourceHint(field.value)
  }

export const createRenderStartScreen = (app: AppContext) => () => {
  const previousPlayer = app.root.querySelector<HTMLMediaElement>(
    '[data-scene-player]'
  )
  const recent = app.showAllRecent ? app.notebooks : app.notebooks.slice(0, 5)
  replacePlayerView(
    app.root,
    `<header class="home">
<a class="brand" href="/" aria-label="Incredible Studio">
<img src="${incredibleLogo}" alt="">Incredible</a>
${button('Settings', 'settings')}</header>
<main class="start${app.notebooks.length ? ' has-recent' : ''}">
<h1>Turn a blog into slides and a video.</h1>
<form id="source">
<label class="sr" for="source-input">Link or text</label>
<div class="source-row">
<textarea id="source-input" name="source" rows="1" placeholder="Paste a blog link or your text…" required>
</textarea>
<button class="primary" ${app.pending ? 'disabled' : ''}>${
      app.pending ? 'Starting…' : 'Make the video →'
    }</button>
</div>
<div class="source-meta">
${
  app.aiChoices?.selected
    ? `<span class="start-ai">Create with ${escape({ kimi: 'Kimi', codex: 'Codex', 'claude-code': 'Claude Code' }[app.aiChoices.selected.adapter])} · <button type="button" class="quiet" data-action="choose-ai">Change</button>
</span>`
    : ''
}
<button type="button" data-action="slides-only" class="quiet slides-only">Only want slides?</button>
<small id="source-hint" class="source-hint" aria-live="polite">
</small>
</div>
</form>

${
  app.notebooks.length
    ? `<section class="saved-notebooks" aria-labelledby="recent-heading">
<h2 id="recent-heading">Recent</h2>
${recent
  .map(
    (item) =>
      `<button data-notebook="${escape(item.id)}">
<span class="recent-title">
${escape(item.title)}<small>
${escape(item.site || 'Your text')}${
        item.updatedAt ? ` · ${escape(app.ago(item.updatedAt))}` : ''
      }</small>
</span>
<small class="recent-state">
${
  item.status === 'failed'
    ? 'Needs another try'
    : item.status === 'building'
      ? 'Slides in progress'
      : item.hasVideo
        ? 'Video in progress'
        : 'Slides ready'
} →</small>
</button>`
  )
  .join('')}${
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
<h2>Your video starts as slides.</h2>
<div class="explain-picture">
<span>▤<small>A slide</small>
</span>
<b>→</b>
<span>▷<small>A scene</small>
</span>
<b>→</b>
<span>▶<small>Your video</small>
</span>
</div>
<p>Fixing a slide takes seconds.<br>A finished video takes minutes.</p>
${button('Show me the slides', 'understood', true)}`
  )
  app.dialog.dataset.explainer = 'yes'
}
export const installStartController = (app: AppContext) => {
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
      app.aiChoices = await api.harnesses()
      if (aiLabel(app.aiChoices) && app.aiChoices.selected) {
        const created = await api.create({
          source: app.pendingSource,
          harness: app.aiChoices.selected
        })
        app.pendingSource = ''
        app.stage = 'presentation'
        app.attach(created)
      } else app.showDialog(chooseAiDialog(app.aiChoices))
    } finally {
      app.pending = false
      app.render()
    }
  }
  if (form.id === 'choose-ai') {
    if (app.pending) return
    const adapter = String(
      values.get('harness')
    ) as import('../shared/model').HarnessSelection['adapter']
    if (
      !app.aiChoices?.available.some(
        (choice) => choice.id === adapter && choice.ok
      )
    )
      throw new Error('Choose an available AI harness')
    const model = String(values.get('model') || ''),
      harness = { adapter, ...(model ? { model } : {}) }
    if (!app.pendingSource) {
      await api.saveSettings({ harness })
      app.aiChoices = { ...app.aiChoices, selected: harness }
      app.dialog.close()
      app.render()
      return
    }
    app.pending = true
    const submit = form.querySelector<HTMLButtonElement>(
      'button[type=submit],button.primary'
    )
    if (submit) submit.disabled = true
    try {
      await api.saveSettings({ harness })
      const created = await api.create({ source: app.pendingSource, harness })
      app.pendingSource = ''
      app.dialog.close()
      app.stage = 'presentation'
      app.attach(created)
    } finally {
      app.pending = false
      if (submit) submit.disabled = false
    }
  }
  if (form.id === 'source-recovery' && app.snapshot) {
    app.snapshot = await api.replaceSource(
      app.snapshot.project.id,
      String(values.get('text') || '')
    )
    app.dialog.close()
    app.stage = 'presentation'
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
