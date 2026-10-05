import { RefreshCw, createElement } from 'lucide'
import { themeChoices, titlePreview, type ThemeColours } from './brand-theme'
import { api } from './api'
import type { AppContext } from './app-context'
import type { Branding } from '../shared/settings'
import { escape } from './ui'

export const reviewBrand = async (
  app: AppContext,
  id: string
): Promise<boolean> => {
  const [initialSource, settings] = await Promise.all([
    api.detectedBrand(id),
    api.settings()
  ])
  if (app.snapshot?.project.id !== id) return false
  let source = initialSource
  const library = settings.brandLibrary || []
  let domain: string | null = null
  try {
    domain = new URL(source.url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {}
  const match = library.find((entry) => entry.domain === domain && domain)
  const title = app.snapshot.project.title.replace(/ \| [^|]+$/, '')
  const detected = (): Branding => ({
    name: source.site || 'My brand',
    tagline: '',
    logoKey: null,
    useAccent: true,
    accent: source.palette.accent,
    palette: {
      ground: source.palette.ground,
      text: source.palette.text,
      secondary: source.palette.secondary
    },
    fonts: {
      display: source.fonts.display,
      body: source.fonts.body,
      mono: source.fonts.mono
    }
  })
  let selectedEntry = match
  let base = match?.brand || detected()
  let dirty = false
  let pending = false
  const refreshIcon = createElement(RefreshCw, {
    'aria-hidden': 'true',
    'stroke-width': 1.75
  }).outerHTML
  app.showDialog(`<h2>Choose your wireframe theme</h2>
    <p>${match ? `Your saved brand for ${escape(domain!)} is ready. Use it, choose another, or refresh from the website.` : 'Review the suggested brand, or choose one you have saved.'}</p>
    <form data-confirm id="brand-review" class="settings-card">
    <fieldset data-brand-fields>
    <div class="brand-source-row">
    <label>Brand source<select name="brandSource">
      ${match ? `<option value="${escape(match.id)}">Restore ${escape(match.brand.name)} · ${escape(domain!)}</option>` : ''}
      <option value="detected">Suggested website brand</option>
      ${library
        .filter((entry) => entry.id !== match?.id)
        .map(
          (entry) =>
            `<option value="${escape(entry.id)}">${escape(entry.brand.name)}${entry.domain ? ` · ${escape(entry.domain)}` : ''}</option>`
        )
        .join('')}
      ${settings.branding.name ? '<option value="current">Current Branding settings</option>' : ''}
    </select></label>
    ${domain ? `<button type="button" class="brand-refresh" data-redetect aria-busy="false" title="Refresh colours and fonts from ${escape(domain)}">${refreshIcon}<span>Refresh brand</span></button>` : ''}
    </div>
    <p role="status" data-brand-status>${match ? 'Saved brand restored. No overwrite is needed.' : `Suggestion from ${escape(source.site || 'your notes')}.`}</p>
    <div data-theme-options class="theme-options" role="group" aria-label="Brand colour combinations"></div>
    <p>The same title wireframe, with different colour combinations. Select a theme or customise it below.</p>
    <label>Brand name<input name="name" maxlength="100" required></label>
    <div class="brand-review-colours">${(['ground', 'text', 'accent', 'secondary'] as const).map((key) => `<label>${key}<input type="color" name="${key}"></label>`).join('')}</div>
    ${(['display', 'body', 'mono'] as const).map((key) => `<label>${key === 'display' ? 'Heading font' : key === 'body' ? 'Body font' : 'Code font'}<input name="${key}" maxlength="100" required></label>`).join('')}
    <label class="consent" data-overwrite-label hidden><input type="checkbox" name="overwrite"> <span data-overwrite-text></span></label>
    <p>Your choice is saved in Settings → Branding and applied to this notebook.</p>
    <p role="alert" data-brand-error></p>
    <button class="primary" type="submit">Save theme and continue →</button>
    </fieldset></form>`)
  const revision = app.dialogRevision
  const isCurrent = () =>
    app.dialog.open &&
    revision === app.dialogRevision &&
    app.snapshot?.project.id === id
  return new Promise((resolve) => {
    let completed = false
    app.dialog.addEventListener(
      'close',
      () => {
        if (!completed) resolve(false)
      },
      { once: true }
    )
    const form = app.dialog.querySelector<HTMLFormElement>('#brand-review')!
    const field = (key: string) =>
      form.elements.namedItem(key) as HTMLInputElement
    const fields = form.querySelector<HTMLFieldSetElement>('fieldset')!
    const error = form.querySelector<HTMLElement>('[data-brand-error]')!
    const status = form.querySelector<HTMLElement>('[data-brand-status]')!
    const colours = (): ThemeColours => ({
      ground: field('ground').value,
      text: field('text').value,
      accent: field('accent').value,
      secondary: field('secondary').value
    })
    let variants = themeChoices({ ...base.palette!, accent: base.accent })
    let selected = 0
    const options = form.querySelector<HTMLElement>('[data-theme-options]')!
    const overwriteTarget = () =>
      selectedEntry ? (dirty ? selectedEntry : undefined) : match
    const draw = () => {
      options.innerHTML = variants
        .map(
          (theme, i) =>
            `<button type="button" data-theme-option="${i}" aria-pressed="${selected === i}" aria-label="${theme.name} theme">${titlePreview(title, field('name').value, theme)}<span>${theme.name}${selected === i ? ' · Selected' : ''}</span></button>`
        )
        .join('')
      options
        .querySelectorAll<HTMLElement>('.theme-title-slide')
        .forEach((el) => {
          el.style.fontFamily = `${field('display').value}, sans-serif`
        })
      const target = overwriteTarget()
      form.querySelector<HTMLElement>('[data-overwrite-label]')!.hidden =
        !target
      form.querySelector<HTMLElement>('[data-overwrite-text]')!.textContent =
        target
          ? `Overwrite saved brand “${target.brand.name}”${target.domain ? ` for ${target.domain}` : ''}`
          : ''
      form.querySelector<HTMLButtonElement>(
        'button[type=submit]'
      )!.textContent =
        selectedEntry && !dirty
          ? 'Use saved brand and continue →'
          : 'Save theme and continue →'
    }
    const fill = () => {
      field('name').value = base.name
      for (const key of ['ground', 'text', 'secondary'] as const)
        field(key).value = base.palette?.[key] || detected().palette![key]
      field('accent').value = base.accent
      for (const key of ['display', 'body', 'mono'] as const)
        field(key).value = base.fonts?.[key] || source.fonts[key]
      variants = themeChoices(colours())
      selected = 0
      dirty = false
      field('overwrite').checked = false
      error.textContent = ''
      draw()
    }
    fill()
    field('brandSource').addEventListener('change', () => {
      selectedEntry = library.find(
        (entry) => entry.id === field('brandSource').value
      )
      base =
        selectedEntry?.brand ||
        (field('brandSource').value === 'current'
          ? settings.branding
          : detected())
      status.textContent = selectedEntry
        ? 'Saved brand restored. No overwrite is needed.'
        : 'Review this suggestion before saving.'
      fill()
    })
    const refresh = form.querySelector<HTMLButtonElement>('[data-redetect]')
    refresh?.addEventListener('click', async () => {
      if (pending) return
      pending = true
      fields.disabled = true
      refresh.setAttribute('aria-busy', 'true')
      refresh.querySelector('span')!.textContent = 'Refreshing…'
      status.textContent = 'Refreshing colours and fonts from the website…'
      try {
        const refreshed = await api.redetectBrand(id)
        if (!isCurrent()) return
        source = refreshed
        selectedEntry = undefined
        base = detected()
        field('brandSource').value = 'detected'
        fill()
        status.textContent =
          'Brand refreshed. Review the new suggestion before saving.'
      } catch (reason) {
        error.textContent =
          reason instanceof Error ? reason.message : 'Could not refresh brand'
        status.textContent = 'Your saved brand has been kept.'
      } finally {
        pending = false
        fields.disabled = false
        refresh.setAttribute('aria-busy', 'false')
        refresh.querySelector('span')!.textContent = 'Refresh brand'
      }
    })
    options.addEventListener('click', (event) => {
      const target = (event.target as Element).closest<HTMLElement>(
        '[data-theme-option]'
      )
      if (!target) return
      selected = Number(target.dataset.themeOption)
      for (const key of ['ground', 'text', 'accent', 'secondary'] as const)
        field(key).value = variants[selected][key]
      dirty = true
      draw()
    })
    form.addEventListener('input', (event) => {
      if (
        ['brandSource', 'overwrite'].includes(
          (event.target as HTMLInputElement).name
        )
      )
        return
      dirty = true
      variants = themeChoices(colours())
      selected = 0
      draw()
    })
    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      if (pending) return
      const target = overwriteTarget()
      if (target && !field('overwrite').checked) {
        error.textContent =
          'Confirm the overwrite, or restore a saved brand to keep it unchanged.'
        return
      }
      pending = true
      fields.disabled = true
      error.textContent = ''
      const brand: Branding =
        selectedEntry && !dirty
          ? selectedEntry.brand
          : {
              ...base,
              name: field('name').value,
              accent: field('accent').value,
              useAccent: true,
              palette: {
                ground: field('ground').value,
                text: field('text').value,
                secondary: field('secondary').value
              },
              fonts: {
                display: field('display').value,
                body: field('body').value,
                mono: field('mono').value
              }
            }
      try {
        if (!selectedEntry || dirty) {
          selectedEntry = await api.saveLibraryBrand({
            brand,
            domain: target ? target.domain : domain,
            ...(target
              ? { overwriteId: target.id, expectedUpdatedAt: target.updatedAt }
              : {})
          })
          dirty = false
        }
        await api.saveSettings({ projectId: id, branding: brand })
        const snapshot = await api.load(id)
        if (!isCurrent()) return
        app.snapshot = snapshot
        completed = true
        app.dialog.close()
        resolve(true)
      } catch (reason) {
        error.textContent =
          reason instanceof Error ? reason.message : 'Could not save brand'
      } finally {
        pending = false
        fields.disabled = false
      }
    })
  })
}
