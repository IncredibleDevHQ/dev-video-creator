import { recolourLook } from '../shared/looks'
import { addEvent } from './activity'
import { paletteOf, validateLook, withLook } from './looks'
import { readRow, writeRow } from './persistence'
import { changeProject } from './projects'
import { refreshVideoKeys, scenePlanKey } from './scene-model'

/**
 * Change a notebook's look. Drawn wireframes are re-coloured in place, and
 * so is the deck's design spec, so later changes keep the new look.
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
    const style = await readRow<Record<string, string>>(
      'creative-deck-style',
      id
    )
    if (style && from)
      await writeRow(
        'creative-deck-style',
        id,
        Object.fromEntries(
          Object.entries(style).map(([name, text]) => [
            name,
            typeof text === 'string' && name.endsWith('.md')
              ? recolourLook(text, from, look.palette)
              : text
          ])
        )
      )
    current.project.branding = withLook(current.project.branding, look)
    for (const scene of current.project.video?.scenes || [])
      scene.planKey = scenePlanKey(current.project, scene)
    refreshVideoKeys(current.project)
    addEvent(current, 'slide', `Look: ${look.name}`)
  })
}
