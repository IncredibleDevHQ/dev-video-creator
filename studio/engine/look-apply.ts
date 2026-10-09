import { recolourLook } from '../shared/looks'
import { addEvent } from './activity'
import { paletteOf, validateLook, withLook } from './looks'
import { changeProject } from './projects'
import { keepingPlans, refreshVideoKeys } from './scene-model'

/**
 * Change a notebook's look. Drawn wireframes are re-coloured in place; later
 * pages are drawn from a spec the engine writes from the new look.
 */
export const applyLook = (id: string, raw: unknown) => {
  const look = validateLook(raw)
  return changeProject(id, async (current) => {
    const from = paletteOf(current.project.branding)
    const fonts = current.project.branding?.fonts
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
      current.project.branding = withLook(current.project.branding, look)
    })
    refreshVideoKeys(current.project)
    addEvent(current, 'slide', `Look: ${look.name}`)
  })
}
