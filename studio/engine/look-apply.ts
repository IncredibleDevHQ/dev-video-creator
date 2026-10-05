import { recolourLook } from '../shared/looks'
import { addEvent } from './activity'
import { paletteOf, validateLook, withLook } from './looks'
import { changeProject } from './projects'
import { refreshVideoKeys, scenePlanKey } from './scene-model'

/**
 * Change a notebook's look. Drawn wireframes are re-coloured in place; later
 * pages are drawn from a spec the engine writes from the new look.
 */
export const applyLook = (id: string, raw: unknown) => {
  const look = validateLook(raw)
  return changeProject(id, async (current) => {
    const from = paletteOf(current.project.branding)
    const fonts = current.project.branding?.fonts
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
    for (const scene of current.project.video?.scenes || [])
      scene.planKey = scenePlanKey(current.project, scene)
    refreshVideoKeys(current.project)
    addEvent(current, 'slide', `Look: ${look.name}`)
  })
}
