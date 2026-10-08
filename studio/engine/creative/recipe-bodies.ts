// The recipe and blueprint bodies a plan names, put in front of the scene's
// producer. The planner picks recipes by name from the pinned Hyperframes
// indexes; building one well needs its body (the time-coded template, the
// mechanism, the constraints), not a guess from its name. A body the bundle
// does not hold yet comes as its index entry, said to be only that.
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { skillsRoot } from './stage'

const KINDS = ['rules', 'blueprints', 'transitions', 'adapters']

const animation = () =>
  join(
    skillsRoot(),
    'video-planner',
    'hyperframes',
    'skills',
    'hyperframes-animation'
  )

/** An index's entry for one recipe: its line in rules-index or blueprints. */
export const indexEntry = (index: string, id: string) => {
  const rule = new RegExp(`<${id}\\b[^>]*>([\\s\\S]*?)</${id}>`).exec(index)
  const blueprint = new RegExp(
    `<blueprint id="${id}"[^>]*>([\\s\\S]*?)</blueprint>`
  ).exec(index)
  return (rule || blueprint)?.[1].trim() || ''
}

/** The rules' shared contract: what every recipe body assumes. */
const contractOf = (rulesIndex: string) => {
  const start = rulesIndex.indexOf('## The contract')
  if (start < 0) return ''
  const end = rulesIndex.indexOf('\n## ', start + 4)
  return rulesIndex.slice(start, end < 0 ? undefined : end).trim()
}

export const recipeBodies = async (ids: string[]) => {
  const root = animation()
  const rulesIndex = await readFile(join(root, 'rules-index.md'), 'utf8').catch(
    () => ''
  )
  const blueprintsIndex = await readFile(
    join(root, 'blueprints-index.md'),
    'utf8'
  ).catch(() => '')
  const files: Record<string, string> = {}
  const bodies: string[] = []
  const missing: string[] = []
  for (const id of [...new Set(ids)]) {
    if (!/^[a-z0-9][a-z0-9-]{0,80}$/.test(id)) continue
    let body = ''
    for (const kind of KINDS) {
      body = await readFile(join(root, kind, `${id}.md`), 'utf8').catch(
        () => ''
      )
      if (body) break
    }
    if (body) {
      files[`packet/recipes/${id}.md`] = body
      bodies.push(id)
      continue
    }
    const entry = indexEntry(`${rulesIndex}\n${blueprintsIndex}`, id)
    if (!entry) continue
    missing.push(id)
    files[`packet/recipes/${id}.md`] =
      `# ${id} (index entry only)\n\nThe pinned bundle does not hold this recipe's body yet. Build it from this description and the contract, and say so in manifest.unmet if a part cannot be built.\n\n${entry}\n`
  }
  const contract = contractOf(rulesIndex)
  if (Object.keys(files).length && contract)
    files['packet/recipes/CONTRACT.md'] = contract
  return { files, bodies, missing }
}

/** Every recipe id the plan's moments name. */
export const planRecipes = (plan: {
  moments?: Array<{ recipes?: Array<{ id?: string }> }>
}) =>
  (plan.moments || []).flatMap((moment) =>
    (moment.recipes || []).map((recipe) => recipe.id || '').filter(Boolean)
  )
