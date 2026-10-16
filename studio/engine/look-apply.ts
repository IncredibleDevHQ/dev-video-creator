import { filesFor, recolourLook, type Look } from '../shared/looks'
import type { Branding, SavedBrand } from '../shared/settings'
import { addEvent } from './activity'
import { paletteOf, siteLook, siteOffer, validateLook, withLook } from './looks'
import { changeProject } from './projects'
import { keepingPlans, refreshVideoKeys } from './scene-model'
import { makingVideo } from './autopilot'
import { loadBranding } from './branding'
import { loadBrandLibrary } from './brand-library'
import { readRow } from './persistence'
import type { SourceRead } from './source-document'
import { Refusal } from './refusal'

/**
 * What a chosen look carries beyond its colours and fonts, taken from what
 * the studio itself read or saved, never from the request: the site's look
 * its faces' files, a saved look the files it was saved with, the creator's
 * own changes the files of the faces they kept.
 */
export const lookExtras = (
  look: Look,
  branding: Branding | undefined,
  source: SourceRead | null,
  library: SavedBrand[]
): Partial<Look> => {
  // What the notebook's site offers goes with every look (a notebook made
  // before the studio read it gets it now).
  const offer = siteOffer(source)
  return {
    ...(offer ? { site: offer } : {}),
    ...filesOf(look, branding, source, library)
  }
}

const filesOf = (
  look: Look,
  branding: Branding | undefined,
  source: SourceRead | null,
  library: SavedBrand[]
): Partial<Look> => {
  if (look.id === 'site') {
    const read = siteLook(source)
    return read ? { fontFiles: filesFor(look.fonts, read.fontFiles) } : {}
  }
  if (look.id.startsWith('saved:')) {
    const saved = library.find((entry) => `saved:${entry.id}` === look.id)
    return saved
      ? { fontFiles: filesFor(look.fonts, saved.brand.fontFiles) }
      : {}
  }
  if (look.id === 'custom')
    return {
      fontFiles: filesFor(look.fonts, [
        ...(branding?.site?.fontFiles || []),
        ...(branding?.fontFiles || [])
      ])
    }
  return {}
}

/**
 * Change a notebook's look. Drawn wireframes are re-coloured in place; later
 * pages are drawn from a spec the engine writes from the new look. With
 * `useLogo`, the logo the notebook's site shows is used in its videos, or
 * set aside for the creator's own.
 */
export const applyLook = async (
  id: string,
  raw: unknown,
  useLogo?: unknown
) => {
  const look = validateLook(raw)
  const source = await readRow<SourceRead>('sources', id)
  const library = look.id.startsWith('saved:') ? await loadBrandLibrary() : []
  const ownLogo = useLogo === false ? (await loadBranding()).logoKey : null
  return changeProject(id, async (current) => {
    if (makingVideo(current.project))
      throw new Refusal(
        'Wait for the scenes being made to finish before changing the look'
      )
    const from = paletteOf(current.project.branding)
    const fonts = current.project.branding?.fonts
    const extras = lookExtras(look, current.project.branding, source, library)
    // The pages change colour, not what the scenes say: each scene keeps its
    // plan, never written again for a look (its stored plan went stale).
    keepingPlans(current.project, () => {
      if (from)
        for (const slide of current.project.slides)
          if (slide.svg)
            slide.svg = recolourLook(
              slide.svg,
              from,
              look.palette,
              fonts ? { from: fonts, to: look.fonts } : undefined
            )
      const branding = withLook(current.project.branding, {
        ...look,
        ...extras
      })
      const logo = branding.site?.logo
      if (useLogo === true && logo) branding.logoKey = logo.pngKey
      if (useLogo === false && logo && branding.logoKey === logo.pngKey)
        branding.logoKey = ownLogo ?? null
      current.project.branding = branding
    })
    refreshVideoKeys(current.project)
    addEvent(current, 'slide', `Look: ${look.name}`)
  })
}
