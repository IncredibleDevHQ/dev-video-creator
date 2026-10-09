// The registry's components and blocks a plan names, installed into its
// build as `hyperframes add` would: each file at its registry target, made
// to run offline on the pinned runtime. Seen live (8 Oct): with no visual
// material the producer hand-built every scene from divs, and every scene
// came out as cards; Hyperframes' own motion graphics are built by mounting
// these, not by rebuilding them.
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { skillsRoot } from './stage'

type RegistryItem = {
  name: string
  type: string
  title?: string
  description?: string
  duration?: number
  files: Array<{ path: string; target: string; type: string }>
  variables?: Array<{
    id: string
    type?: string
    default?: unknown
    description?: string
    options?: Array<{ value: unknown }>
  }>
}

const registry = () =>
  join(skillsRoot(), 'video-planner', 'hyperframes', 'registry')

/**
 * A vendored file made to run offline: GSAP from the pinned runtime, the
 * bundled fonts instead of Google's, and no address left in a comment (a
 * build refers to nothing outside itself).
 */
export const offline = (text: string) =>
  text
    .replace(
      /https:\/\/cdn\.jsdelivr\.net\/npm\/gsap@[\d.]+\/dist\/([A-Za-z]+)\.min\.js/g,
      '/runtime/$1.min.js'
    )
    .replace(
      /<link\b[^>]*href=["']https:\/\/fonts\.(?:googleapis|gstatic)\.com[^>]*>\s*/g,
      ''
    )
    .replace(/https?:\/\/(?!www\.w3\.org\/)[^\s"'<>)]+/g, '(link removed)')
    .replace(/(\/\/[^\n]*)Math\.random\(\)/g, '$1random numbers')

/** The mount in an item's demo: the element that loads it. */
const mountOf = (demo: string) =>
  /<div\b[^>]*data-composition-src=[\s\S]*?<\/div>/.exec(demo)?.[0] || ''

const describe = (item: RegistryItem, kind: string, targets: string[]) => {
  const variables = (item.variables || [])
    .map(
      (variable) =>
        `- \`${variable.id}\` (${variable.type || 'value'}${
          variable.options
            ? `: ${variable.options.map((option) => option.value).join(' | ')}`
            : ''
        }, default ${JSON.stringify(variable.default)}): ${variable.description || ''}`
    )
    .join('\n')
  return [
    `# ${item.name} (${kind}, installed)`,
    '',
    item.description || '',
    '',
    [
      `The app installed it at ${targets.map((target) => `\`production/${target}\``).join(', ')}.`,
      `Mount it, do not rebuild it: a \`class="clip"\` element with \`data-composition-src="./${targets[0]}"\`, \`data-composition-id="${item.name}"\`,`,
      `\`data-start\`, \`data-duration\` (cover how long it shows: its own timeline ends at its length${item.duration ? `, ${item.duration} s` : ''}),`,
      `\`data-track-index\`, its size, and \`data-variable-values\` with only what you change.`,
      'Theme it with the scene’s tokens on the mount (--bg, --fg, --muted, --surface, --border, --accent, --brand, --accent-2, --font-display, --font-body, --font-mono).'
    ].join(' '),
    variables ? `\n## Variables\n\n${variables}` : ''
  ].join('\n')
}

/** Installs the named components and blocks; says which it could not. */
export const registryInstall = async (
  recipes: Array<{ id: string; catalog: string }>
) => {
  const seed: Record<string, string | Buffer> = {}
  const docs: Record<string, string> = {}
  const installed: string[] = []
  const missing: string[] = []
  for (const { id, catalog } of recipes) {
    if (!/^[a-z0-9][a-z0-9-]{0,80}$/.test(id) || installed.includes(id))
      continue
    const folder = join(
      registry(),
      catalog === 'block' ? 'blocks' : 'components',
      id
    )
    const item = await readFile(join(folder, 'registry-item.json'), 'utf8')
      .then((text) => JSON.parse(text) as RegistryItem)
      .catch(() => null)
    if (!item) {
      missing.push(id)
      continue
    }
    const targets: string[] = []
    for (const file of item.files) {
      if (!/^[a-z0-9][a-z0-9._\-/]*$/i.test(file.target)) continue
      if (file.target.split('/').includes('..')) continue
      const bytes = await readFile(join(folder, file.path))
      seed[`production/${file.target}`] = /\.(html|css|js|svg)$/i.test(
        file.path
      )
        ? offline(bytes.toString('utf8'))
        : bytes
      if (file.type !== 'hyperframes:asset') targets.push(file.target)
    }
    const demo = await readFile(join(folder, 'demo.html'), 'utf8').catch(
      () => ''
    )
    const readme = await readFile(join(folder, 'README.md'), 'utf8').catch(
      () => ''
    )
    const mount = offline(mountOf(demo))
    docs[`packet/recipes/${id}.md`] = [
      describe(item, catalog, targets),
      mount ? `\n## Its demo's mount\n\n\`\`\`html\n${mount}\n\`\`\`` : '',
      readme ? `\n## README\n\n${offline(readme)}` : ''
    ].join('\n')
    installed.push(id)
  }
  return { seed, docs, installed, missing }
}

/** The components and blocks a plan's moments name. */
export const planBlocks = (plan: {
  moments?: Array<{ recipes?: Array<{ id?: string; catalog?: string }> }>
}) =>
  (plan.moments || []).flatMap((moment) =>
    (moment.recipes || [])
      .filter(
        (recipe) =>
          recipe.id &&
          (recipe.catalog === 'component' || recipe.catalog === 'block')
      )
      .map((recipe) => ({ id: recipe.id!, catalog: recipe.catalog! }))
  )
