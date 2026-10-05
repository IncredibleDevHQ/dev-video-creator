// The deck's design system, written by the engine from the notebook's look,
// and the icon library the agent names rather than reads. A drawing call
// once read 83 KB of ppt-master manuals and wrote a 13 KB design spec before
// its first page; now every page call gets this short spec instead.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { mix, type PageBrand } from '../source-page'

const ICON_DIR = fileURLToPath(
  new URL('../../skills/page-master/templates/icons/', import.meta.url)
)
let iconNames: string[] | null = null
export const ICON_NAMES = () =>
  (iconNames ||= (
    JSON.parse(readFileSync(`${ICON_DIR}index.json`, 'utf8')) as {
      icons: string[]
    }
  ).icons)

const OBJECTS = fileURLToPath(
  new URL('../../skills/page-master/references/objects.json', import.meta.url)
)
let objectList: string | null = null
/** The drawable objects in one line each: name, size and named pieces. */
const objects = () =>
  (objectList ||= (
    JSON.parse(readFileSync(OBJECTS, 'utf8')) as {
      objects: Array<{
        entity: string
        size?: { width: number; height: number }
        parts?: Array<{ id: string }>
      }>
    }
  ).objects
    .map(
      (o) =>
        `- \`${o.entity}\` (${o.size ? `${o.size.width}×${o.size.height}` : 'any size'}): pieces ${(o.parts || []).map((p) => p.id).join(', ')}`
    )
    .join('\n'))

/** The page spec every drawing call receives (packet/SPEC.md). */
export const deckSpec = (input: {
  title: string
  site?: string
  brand: PageBrand
  total: number
}) => {
  const b = input.brand
  const surface = mix(b.ground, b.text, 0.04)
  const fill = mix(b.ground, b.accent, 0.1)
  const line = mix(b.accent, b.ground, 0.35)
  const muted = mix(b.text, b.ground, 0.4)
  return `# Page spec — ${input.title}

Every page of this deck follows this spec, so ${input.total} pages read as one deck.

## Canvas
1280 × 720, \`viewBox="0 0 1280 720"\`. Safe area x 80–1200, y 120–660; the ground and faint construction lines may reach the edges.

## Colours (exact hex; one accent, one meaning)
| Role | Hex | Use |
|---|---|---|
| ground | ${b.ground} | the page |
| surface | ${surface} | panels and containers |
| text | ${b.text} | titles and labels |
| muted | ${muted} | details and captions |
| accent | ${b.accent} | the one thing that matters on the page, connectors, artwork strokes |
| node fill | ${fill} | every node's shape (the accent at 10 % over the ground) |
| line | ${line} | node outlines (1.5 px) |
| secondary | ${b.secondary} | a second series, sparingly |
| warning | #d64545 | refusal, overload, failure only |

## Type
- Families: headings \`${b.display}\`, text \`${b.body}\`, code \`${b.mono}\`. Write them as \`font-family="${b.body}, Inter, Helvetica, Arial, sans-serif"\` (mono: \`${b.mono}, Menlo, monospace\`).
- Sizes: page title 40 (bold, headings face); node label 24 (600); detail 20; figure 64–96; nothing smaller than 20.

## Layout
- The page title at x 80, baseline y 104, inside the header group. Nothing else in the header: no section eyebrow, no sheet number, no site name or date in a footer.
- One hero per page: the thing the narration is about is the largest and gets the accent.
- Nodes: \`rx="12"\`, fill node fill, outline line. Connectors: 2 px accent at 60 % opacity with the page's arrow marker; a connector's label sits in clear space beside its line, never on a box, a label or another line, and lines run around boxes.

## Icons — name them, the studio draws them
Write \`<g data-icon="NAME" transform="translate(X Y) scale(1.8333)" fill="none" stroke="${b.accent}" stroke-width="2"/>\` for a 44 px icon at (X, Y). The studio puts the icon's paths inside when the page is submitted; do not read icon files. Names: ${ICON_NAMES().join(', ')}.

## Objects the studio can draw (\`data-object\` on a node, at least 110 px a side)
${objects()}
`
}

const iconCache = new Map<string, string>()
/** The drawable elements of one Tabler icon, without its <svg> wrapper. */
const iconBody = (name: string) => {
  if (!iconCache.has(name)) {
    let body = ''
    if (/^[a-z0-9-]+$/.test(name) && ICON_NAMES().includes(name))
      body = readFileSync(`${ICON_DIR}tabler-outline/${name}.svg`, 'utf8')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/^[\s\S]*?<svg[^>]*>/, '')
        .replace(/<\/svg>[\s\S]*$/, '')
        .replace(/<path stroke="none" d="M0 0h24v24H0z" fill="none"\s*\/>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    iconCache.set(name, body)
  }
  return iconCache.get(name)!
}

/**
 * Put each named icon's paths inside its `<g data-icon>` group. Unknown names
 * are reported, so the agent can choose another.
 */
export const expandIcons = (svg: string) => {
  const unknown = new Set<string>()
  const expanded = svg.replace(
    /<g\b([^>]*?)\bdata-icon="([^"]*)"([^>]*?)(\/>|>([\s\S]*?)<\/g>)/g,
    (whole, before: string, name: string, after: string) => {
      const body = iconBody(name)
      if (!body) {
        unknown.add(name)
        return whole
      }
      const attributes = `${before}data-icon="${name}"${after.replace(/\s*\/$/, '')}`
      // Tabler draws with round caps and joins on its own wrapper.
      const caps = /stroke-linecap/.test(attributes)
        ? ''
        : ' stroke-linecap="round" stroke-linejoin="round"'
      return `<g${attributes}${caps}>${body}</g>`
    }
  )
  return { svg: expanded, unknown: [...unknown] }
}
