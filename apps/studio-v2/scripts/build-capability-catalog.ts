// Regenerates the planner skill's capabilities.json from the pinned
// Hyperframes indexes it vendors. Run after re-vendoring:
//   node_modules/.bin/tsx apps/studio-v2/scripts/build-capability-catalog.ts
// The studio test suite checks that the committed file matches.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildCapabilityCatalog } from '../src/planning/capability-catalog'

export const PLANNER_SKILL_DIR = fileURLToPath(new URL('../../studio-desktop/skills/video-planner/', import.meta.url))

export const catalogFromBundle = () => {
  const bundle = `${PLANNER_SKILL_DIR}hyperframes/`
  const manifest = JSON.parse(readFileSync(`${bundle}manifest.json`, 'utf8')) as { commit: string }
  const read = (path: string) => readFileSync(`${bundle}${path}`, 'utf8')
  return buildCapabilityCatalog({
    upstreamCommit: manifest.commit,
    runtime: { '@hyperframes/core': '0.7.106', '@hyperframes/player': '0.7.106', '@hyperframes/producer': '0.7.106' },
    rulesIndex: read('skills/hyperframes-animation/rules-index.md'),
    blueprintsIndex: read('skills/hyperframes-animation/blueprints-index.md'),
    techniques: read('skills/hyperframes-animation/techniques.md'),
  })
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const catalog = catalogFromBundle()
  writeFileSync(`${PLANNER_SKILL_DIR}capabilities.json`, `${JSON.stringify(catalog, null, 2)}\n`)
  console.log(`${catalog.entries.length} capabilities catalogued from ${catalog.upstreamCommit}`)
}
