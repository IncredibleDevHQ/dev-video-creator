// The look, beside the wireframes (review 5, borrowed from Open Slide's
// themes and design panel): named looks with a sample, then three colours
// and two font menus. Drawn wireframes change colour as you choose, and
// nothing is saved until Apply. It replaces the brand dialog before Create.
import {
  FONT_CHOICES,
  LOOKS,
  NEUTRAL_LOOK,
  recolourLook,
  type Look,
  type LookPalette
} from '../shared/looks'
import { api } from './api'
import type { AppContext } from './app-context'
import { escape } from './ui'

type Panel = {
  element: HTMLElement
  draft: Look
  from: Look
  originals: WeakMap<Element, string>
}
let open: Panel | null = null

/** The notebook's look as a Look, whatever older notebooks saved. */
export const currentLook = (app: AppContext): Look => {
  const branding = app.snapshot?.project.branding
  if (!branding?.palette) return NEUTRAL_LOOK
  const named = LOOKS.find((look) => look.id === branding.look?.id)
  return {
    id: branding.look?.id || 'custom',
    name: branding.look?.name || named?.name || 'Your look',
    description: named?.description || '',
    palette: { ...branding.palette, accent: branding.accent },
    fonts: branding.fonts || NEUTRAL_LOOK.fonts
  }
}

/** A small title page in a look: the notebook's title over a little diagram. */
export const lookSample = (title: string, look: Look) =>
  `<span class="look-sample" style="--look-ground:${look.palette.ground};--look-text:${look.palette.text};--look-accent:${look.palette.accent};--look-secondary:${look.palette.secondary};--look-display:${escape(look.fonts.display)}" aria-hidden="true"><b>${escape(title)}</b><i><em></em><em></em><em></em></i></span>`

const tile = (title: string, look: Look, pressed: boolean) =>
  `<button type="button" class="look-tile" data-look-id="${escape(look.id)}" aria-pressed="${pressed}">${lookSample(title, look)}<span class="look-name">${escape(look.name)}</span><small>${escape(look.description)}</small></button>`

const fontMenu = (key: 'display' | 'body', value: string) => {
  const options = FONT_CHOICES.some((choice) => choice.value === value)
    ? FONT_CHOICES
    : [{ value, label: value }, ...FONT_CHOICES]
  return `<select data-look-font="${key}">${options
    .map(
      (choice) =>
        `<option value="${escape(choice.value)}" ${choice.value === value ? 'selected' : ''}>${escape(choice.label)}</option>`
    )
    .join('')}</select>`
}

const looksFor = (app: AppContext, from: Look) => {
  const list = [...LOOKS]
  if (!LOOKS.some((look) => look.id === from.id)) list.unshift(from)
  return list
}

/** Re-colour the drawn wireframes on screen to the draft look (no save). */
export const syncLookPreview = (root: HTMLElement) => {
  if (!open) return
  const { from, draft, originals } = open
  for (const svg of root.querySelectorAll<SVGElement>(
    '.stage > svg, .thumbnail svg'
  )) {
    const host = svg.parentElement!
    if (!originals.has(host)) originals.set(host, host.innerHTML)
    host.innerHTML = recolourLook(
      originals.get(host)!,
      from.palette,
      draft.palette,
      {
        from: from.fonts,
        to: draft.fonts
      }
    )
  }
}

const restore = (root: HTMLElement) => {
  if (!open) return
  for (const host of root.querySelectorAll('.stage, .thumbnail > div')) {
    const original = open.originals.get(host)
    if (original !== undefined) host.innerHTML = original
  }
}

export const closeLookPanel = (app: AppContext, keep = false) => {
  if (!open) return
  if (!keep) restore(app.root)
  open.element.remove()
  open = null
  document.body.classList.remove('has-look-panel')
}

export const openLookPanel = (app: AppContext) => {
  if (open) {
    closeLookPanel(app)
    return
  }
  if (!app.snapshot) return
  const id = app.snapshot.project.id
  const title = app.snapshot.project.title.replace(/ \| [^|]+$/, '')
  const from = currentLook(app)
  const drawn = app.snapshot.project.slides.some((slide) => slide.svg)
  let domain = ''
  try {
    domain = app.snapshot.project.sourceUrl
      ? new URL(app.snapshot.project.sourceUrl).hostname
          .toLowerCase()
          .replace(/^www\./, '')
      : ''
  } catch {}
  const element = document.createElement('aside')
  element.className = 'look-panel'
  element.setAttribute('aria-label', 'Look')
  open = { element, draft: from, from, originals: new WeakMap() }
  const draw = () => {
    const { draft } = open!
    element.innerHTML = `<div class="look-head"><h2>Look</h2><button type="button" class="icon-button" data-look-close aria-label="Close the look panel">×</button></div>
<p class="look-note">${drawn ? 'Colours and fonts for every wireframe. Drawn wireframes change as you choose; nothing is saved until you apply.' : 'Colours and fonts for your wireframes. You can change them again once they are drawn.'}</p>
<div class="look-grid" role="group" aria-label="Named looks">${looksFor(
      app,
      from
    )
      .map((look) => tile(title, look, look.id === draft.id))
      .join('')}</div>
<h3>Colours</h3>
<div class="look-colours">${(
      [
        ['ground', 'Background'],
        ['text', 'Text'],
        ['accent', 'Accent']
      ] as Array<[keyof LookPalette, string]>
    )
      .map(
        ([key, label]) =>
          `<label><input type="color" data-look-colour="${key}" value="${draft.palette[key]}"><span>${label}</span></label>`
      )
      .join('')}</div>
<h3>Fonts</h3>
<div class="look-fonts"><label>Headings${fontMenu('display', draft.fonts.display)}</label><label>Text${fontMenu('body', draft.fonts.body)}</label></div>
<p class="popover-error" role="alert" data-look-error></p>
<div class="look-actions">${domain ? `<label class="look-remember"><input type="checkbox" data-look-remember> Save for ${escape(domain)}</label>` : ''}<button type="button" data-look-cancel>Cancel</button><button type="button" class="primary" data-look-apply ${draft === from ? 'disabled' : ''}>${drawn ? 'Apply to all wireframes' : 'Use this look'}</button></div>`
    syncLookPreview(app.root)
  }
  const change = (next: Look) => {
    open!.draft = next
    draw()
  }
  element.addEventListener('click', async (event) => {
    const target = event.target as Element
    const lookTile = target.closest<HTMLElement>('[data-look-id]')
    if (lookTile) {
      const look = looksFor(app, from).find(
        (item) => item.id === lookTile.dataset.lookId
      )
      if (look) change(look)
      return
    }
    if (target.closest('[data-look-close],[data-look-cancel]')) {
      closeLookPanel(app)
      return
    }
    const apply = target.closest<HTMLButtonElement>('[data-look-apply]')
    if (!apply || !open) return
    apply.disabled = true
    apply.textContent = 'Applying…'
    try {
      const draft = open.draft
      const remember = element.querySelector<HTMLInputElement>(
        '[data-look-remember]'
      )?.checked
      const snapshot = await api.applyLook(id, draft)
      if (remember && domain) {
        const saved = (await api.settings()).brandLibrary?.find(
          (entry) => entry.domain === domain
        )
        await api.saveLibraryBrand({
          domain,
          brand: {
            name: draft.name,
            tagline: '',
            logoKey: null,
            accent: draft.palette.accent,
            useAccent: true,
            palette: {
              ground: draft.palette.ground,
              text: draft.palette.text,
              secondary: draft.palette.secondary
            },
            fonts: draft.fonts,
            look: { id: draft.id, name: draft.name }
          },
          ...(saved
            ? { overwriteId: saved.id, expectedUpdatedAt: saved.updatedAt }
            : {})
        })
      }
      closeLookPanel(app, true)
      if (app.snapshot?.project.id === id) app.snapshot = snapshot
      app.render()
    } catch (reason) {
      element.querySelector('[data-look-error]')!.textContent =
        reason instanceof Error ? reason.message : 'Could not change the look'
      apply.disabled = false
      apply.textContent = drawn ? 'Apply to all wireframes' : 'Use this look'
    }
  })
  element.addEventListener('input', (event) => {
    const input = event.target as HTMLInputElement | HTMLSelectElement
    const draft = open!.draft
    const colour = input.dataset.lookColour as keyof LookPalette | undefined
    const font = input.dataset.lookFont as 'display' | 'body' | undefined
    if (!colour && !font) return
    open!.draft = {
      id: 'custom',
      name: 'Your look',
      description: '',
      palette: colour
        ? { ...draft.palette, [colour]: input.value }
        : draft.palette,
      fonts: font ? { ...draft.fonts, [font]: input.value } : draft.fonts
    }
    element
      .querySelectorAll('[data-look-id]')
      .forEach((item) => item.setAttribute('aria-pressed', 'false'))
    element.querySelector<HTMLButtonElement>('[data-look-apply]')!.disabled =
      false
    syncLookPreview(app.root)
  })
  draw()
  document.body.append(element)
  document.body.classList.add('has-look-panel')
  element.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus()
}
