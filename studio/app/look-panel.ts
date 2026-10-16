// The look, beside the wireframes (review 5, borrowed from Open Slide's
// themes and design panel): named looks with a sample, then three colours
// and two font menus (the site's own open faces among them), and the logo
// the site shows, to use in videos or not. Drawn wireframes change as you
// choose, and nothing is saved until Apply. It replaces the brand dialog.
import {
  FONT_CHOICES,
  cssFamily,
  filesFor,
  fontName,
  loadableFont,
  LOOKS,
  NEUTRAL_LOOK,
  recolourLook,
  type Look,
  type LookPalette
} from '../shared/looks'
import { api } from './api'
import type { AppContext } from './app-context'
import { syncBrandFonts } from './brand-fonts'
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
    description:
      named?.description ||
      branding.look?.note ||
      (branding.look?.id === 'site' && branding.site?.look?.description) ||
      '',
    palette: { ...branding.palette, accent: branding.accent },
    fonts: branding.fonts || NEUTRAL_LOOK.fonts,
    ...(branding.fontFiles ? { fontFiles: branding.fontFiles } : {})
  }
}

/** The faces the notebook can show beyond the built-in ones: its site's
 * open fonts and the files its look already carries. */
export const offeredFaces = (app: AppContext) => {
  const branding = app.snapshot?.project.branding
  return [...(branding?.site?.fontFiles || []), ...(branding?.fontFiles || [])]
}

/** A small title page in a look: the notebook's title over a little diagram. */
export const lookSample = (title: string, look: Look) =>
  `<span class="look-sample" style="--look-ground:${escape(look.palette.ground)};--look-text:${escape(look.palette.text)};--look-accent:${escape(look.palette.accent)};--look-secondary:${escape(look.palette.secondary)};--look-display:${escape(cssFamily(look.fonts.display))}" aria-hidden="true"><b>${escape(title)}</b><i><em></em><em></em><em></em></i></span>`

const tile = (title: string, look: Look, pressed: boolean) =>
  `<button type="button" class="look-tile" data-look-id="${escape(look.id)}" aria-pressed="${pressed}">${lookSample(title, look)}<span class="look-name">${escape(look.name)}</span><small>${escape(look.description)}</small></button>`

const fontMenu = (
  key: 'display' | 'body',
  value: string,
  offered: string[]
) => {
  // The site's own faces come first; a font that can't load says what
  // shows instead.
  const font = loadableFont(value)
  const choices = [
    ...offered
      .filter((family) => !FONT_CHOICES.some((c) => c.value === family))
      .map((family) => ({ value: family, label: family })),
    ...FONT_CHOICES
  ]
  const options = choices.some((choice) => choice.value === value)
    ? choices
    : [
        {
          value,
          label: font.replaced
            ? `${value} (shows as ${fontName(font.value)})`
            : value
        },
        ...choices
      ]
  return `<select data-look-font="${key}">${options
    .map(
      (choice) =>
        `<option value="${escape(choice.value)}" ${choice.value === value ? 'selected' : ''}>${escape(choice.label)}</option>`
    )
    .join('')}</select>`
}

/** The look read from the notebook's site, offered whatever look it wears. */
const siteTile = (app: AppContext): Look | null => {
  const site = app.snapshot?.project.branding?.site
  if (!site?.look) return null
  return {
    id: 'site',
    ...site.look,
    fontFiles: filesFor(site.look.fonts, site.fontFiles)
  }
}

const looksFor = (app: AppContext, from: Look) => {
  const list = [...LOOKS]
  const site = siteTile(app)
  if (site && from.id !== 'site') list.unshift(site)
  if (!LOOKS.some((look) => look.id === from.id)) list.unshift(from)
  return list
}

/** How much of a logo's ink stands out from a ground: the share of its
 * opaque pixels unlike the ground's colour, measured as the brand reader
 * measures a logo (review 7: a dark logo vanished on a dark chip). */
export const logoContrast = (data: ArrayLike<number>, ground: string) => {
  const rgb = [1, 3, 5].map((at) => parseInt(ground.slice(at, at + 2), 16))
  let opaque = 0
  let shown = 0
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] <= 40) continue
    opaque++
    const apart =
      Math.abs(data[i] - rgb[0]) +
      Math.abs(data[i + 1] - rgb[1]) +
      Math.abs(data[i + 2] - rgb[2])
    if (apart > 90) shown++
  }
  return opaque ? shown / opaque : 1
}

/** Says so beside the logo when most of it blends into the look's ground. */
const checkLogo = async (element: HTMLElement, ground: string) => {
  const img = element.querySelector<HTMLImageElement>('.look-logo img')
  const note = element.querySelector<HTMLElement>('[data-look-logo-note]')
  if (!img || !note) return
  try {
    await img.decode()
    const scale = Math.min(1, 240 / (img.naturalWidth || 1))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) return
    context.drawImage(img, 0, 0, canvas.width, canvas.height)
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
    note.hidden = logoContrast(data, ground) >= 0.5
  } catch {
    // Not decoded (or no canvas): no warning rather than a wrong one.
  }
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
    const preview = recolourLook(
      originals.get(host)!,
      from.palette,
      draft.palette,
      {
        from: from.fonts,
        to: draft.fonts
      }
    )
    if (host.innerHTML !== preview) host.innerHTML = preview
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
  const branding = app.snapshot.project.branding
  const siteLogo = branding?.site?.logo
  const logoUsed = Boolean(siteLogo && branding?.logoKey === siteLogo.pngKey)
  let useLogo = logoUsed
  const offered = [...new Set(offeredFaces(app).map((file) => file.family))]
  syncBrandFonts(offeredFaces(app))
  const element = document.createElement('aside')
  element.className = 'look-panel'
  element.setAttribute('aria-label', 'Look')
  open = { element, draft: from, from, originals: new WeakMap() }
  const draw = () => {
    const { draft } = open!
    element.innerHTML = `<div class="look-head"><h2>Look</h2><button type="button" class="icon-button" data-look-close aria-label="Close the look panel">×</button></div><div class="look-body">
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
          `<label><input type="color" data-look-colour="${key}" value="${escape(draft.palette[key])}"><span>${label}</span></label>`
      )
      .join('')}</div>
<h3>Fonts</h3>
<div class="look-fonts"><label>Headings${fontMenu('display', draft.fonts.display, offered)}</label><label>Text${fontMenu('body', draft.fonts.body, offered)}</label></div>
${siteLogo ? `<h3>Logo</h3><label class="look-logo"><input type="checkbox" data-look-logo ${useLogo ? 'checked' : ''}><img style="background:${escape(draft.palette.ground)}" src="/objects/${escape(siteLogo.pngKey)}" alt="${escape(siteLogo.from)} logo"><span>Use ${escape(siteLogo.from)}’s logo in videos<small data-look-logo-note hidden>Hard to see on this background</small></span></label>` : ''}
<p class="popover-error" role="alert" data-look-error></p></div>
<div class="look-actions">${domain ? `<label class="look-remember"><input type="checkbox" data-look-remember> Save for ${escape(domain)}</label>` : ''}<button type="button" data-look-cancel>Cancel</button><button type="button" class="primary" data-look-apply ${draft === from && useLogo === logoUsed ? 'disabled' : ''}>${drawn ? 'Apply to all wireframes' : 'Use this look'}</button></div>`
    syncLookPreview(app.root)
    void checkLogo(element, draft.palette.ground)
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
      const snapshot = await api.applyLook(
        id,
        draft,
        useLogo === logoUsed ? undefined : useLogo
      )
      if (remember && domain) {
        const saved = (await api.settings()).brandLibrary?.find(
          (entry) => entry.domain === domain
        )
        // What the engine made of the look (its font files, the site's
        // logo when chosen) is what's saved; the creator's own name isn't.
        const applied = snapshot.project.branding
        const site = applied?.site?.logo
        await api.saveLibraryBrand({
          domain,
          brand: {
            name: draft.name,
            tagline: '',
            logoKey:
              site && applied?.logoKey === site.pngKey ? site.pngKey : null,
            accent: draft.palette.accent,
            useAccent: true,
            palette: {
              ground: draft.palette.ground,
              text: draft.palette.text,
              secondary: draft.palette.secondary
            },
            fonts: draft.fonts,
            look: { id: draft.id, name: draft.name },
            ...(applied?.fontFiles ? { fontFiles: applied.fontFiles } : {}),
            ...(applied?.site ? { site: applied.site } : {})
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
    if ('lookLogo' in input.dataset) {
      useLogo = (input as HTMLInputElement).checked
      element.querySelector<HTMLButtonElement>('[data-look-apply]')!.disabled =
        open!.draft === from && useLogo === logoUsed
      return
    }
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
    // The logo stays on the ground it will be seen on (review 7).
    if (colour === 'ground') {
      const logo = element.querySelector<HTMLElement>('.look-logo img')
      if (logo) logo.style.background = input.value
      void checkLogo(element, input.value)
    }
    syncLookPreview(app.root)
  })
  draw()
  document.body.append(element)
  document.body.classList.add('has-look-panel')
  element.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus()
}
