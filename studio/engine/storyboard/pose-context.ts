import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

/** Static layout workers do not need the animation worker's full manual. */
export const poseRole = `# Static frame contract
Produce one polished 1920×1080 static composition, not a slide of narration.
Use exactly one <template>, with styles, scripts and one root inside it.
The root has the assigned data-composition-id and data-duration. Prefix every
id and class with the frame id. Register a paused, empty GSAP timeline at
window.__timelines[frameId]; no tweens. Load GSAP inside the template.
Use the supplied brand, fonts, logo and media; preserve factual qualifiers,
units, source attribution and the creator's correction. Never invent evidence.
Keep all content within the canvas and above the caption keep-out band in the
dispatch. Use a clear hierarchy, legible labels, balanced spacing, a substantial
hero, and varied framing across neighbours. Give editable elements stable ids.
No audio, network, package installation, new dependencies or orchestration.
Studio owns rendering and validation. Read the complete design and assigned
frame below, write the composition, try it, inspect the returned image, correct
all failures, then submit. Never weaken checks or accept a known visual defect.
For unusual composition constraints, packet/FULL_ROLE.md remains available.
`

const rgb = (hex: string) => {
  const h = hex.slice(1)
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
}
const luminance = (hex: string) =>
  rgb(hex)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0)

/** Advice only: never recolour a creator's design or weaken runtime checks. */
export const contrastGuide = (design: string) => {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(design)?.[1] || design
  const colors = [
    ...new Set(frontmatter.match(/#[\da-fA-F]{6}\b|#[\da-fA-F]{3}\b/g) || [])
  ]
  const pairs: string[] = []
  for (let i = 0; i < colors.length; i++)
    for (let j = i + 1; j < colors.length; j++) {
      const a = luminance(colors[i]),
        b = luminance(colors[j])
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
      if (ratio >= 4.5)
        pairs.push(`${colors[i]} / ${colors[j]}: ${ratio.toFixed(2)}:1`)
    }
  return `# Calculated text contrast\n${pairs.join('\n') || 'No opaque palette pair reaches 4.5:1. Choose an accessible text foreground explicitly.'}\nThese pairs pass 4.5:1 only at full opacity on these exact solid backgrounds.
Do not use a faint brand accent as small text just because it is a brand color.
Keep brand accents in non-text decoration when needed; choose a listed text pair.
Alpha, gradients and tinted surfaces change contrast: calculate the actual
composited colors before writing, and still pass the rendered contrast check.
Fix all reported contrast failures together; do not guess successive shades.\n`
}

/** Include actual render dependencies, not only the submitted HTML. */
export const poseFingerprint = async (dir: string, html: string) => {
  const hash = createHash('sha256').update(html)
  hash.update(await readFile(join(dir, 'frame.md')))
  const walk = async (folder: string) => {
    const entries = await readdir(join(dir, folder), {
      withFileTypes: true
    }).catch((error) => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    })
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(folder, entry.name)
      if (entry.isDirectory()) await walk(path)
      else if (entry.isFile())
        hash.update(path).update(await readFile(join(dir, path)))
    }
  }
  await walk('assets')
  return hash.digest('hex')
}
