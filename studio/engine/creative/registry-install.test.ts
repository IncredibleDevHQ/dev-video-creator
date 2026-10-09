import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { compositionProblems } from './sketch-bundle'
import { offline, planBlocks, registryInstall } from './registry-install'
import type { CapabilityCatalog } from './capability-catalog'

const catalog = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL('../../skills/video-planner/capabilities.json', import.meta.url)
    ),
    'utf8'
  )
) as CapabilityCatalog
const text = (file: string | Buffer) =>
  typeof file === 'string' ? file : file.toString('utf8')

it('installs a named component at its registry target, offline', async () => {
  const { seed, docs, installed, missing } = await registryInstall([
    { id: 'count-up', catalog: 'component' },
    { id: 'hw-pipeline', catalog: 'block' },
    { id: 'not-a-component', catalog: 'component' }
  ])
  expect(installed).toEqual(['count-up', 'hw-pipeline'])
  expect(missing).toEqual(['not-a-component'])
  const count = text(seed['production/compositions/components/count-up.html'])
  expect(count).toContain('src="/runtime/gsap.min.js"')
  expect(count).not.toContain('cdn.jsdelivr.net')
  // A block brings its own assets (the hand-drawn font) to their targets.
  expect(Object.keys(seed)).toContain(
    'production/compositions/hw-pipeline.html'
  )
  expect(
    Object.keys(seed).some((name) => name.startsWith('production/assets/'))
  ).toBe(true)
  const doc = docs['packet/recipes/count-up.md']
  expect(doc).toContain(
    'data-composition-src="./compositions/components/count-up.html"'
  )
  expect(doc).toContain('`end` (number, default 100)')
})

it('keeps every catalogued component and block within the build’s rules', async () => {
  const entries = catalog.entries.filter(
    (entry) => entry.kind === 'component' || entry.kind === 'block'
  )
  expect(entries.length).toBeGreaterThan(100)
  const { seed, missing } = await registryInstall(
    entries.map((entry) => ({ id: entry.id, catalog: entry.kind }))
  )
  expect(missing).toEqual([])
  const files = Object.fromEntries(
    Object.entries(seed)
      .filter(([name]) => /\.(html|css|js|svg)$/.test(name))
      .map(([name, file]) => [name.replace(/^production\//, ''), text(file)])
  )
  const html = `<div data-composition-id="s" data-duration="4"></div><script>window.__timelines = window.__timelines || {}; window.__timelines["s"] = 1</script>`
  // Nothing fetched, random, clocked or outside the build.
  expect(
    compositionProblems(
      { ...files, 'index.html': html },
      html,
      's',
      4,
      'production'
    )
  ).toEqual([])
})

it('makes a vendored file run offline', () => {
  expect(
    offline(
      '<link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet">\n<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/CustomEase.min.js"></script><!-- after https://github.com/x/y --> // no Math.random() here'
    )
  ).toBe(
    '<script src="/runtime/CustomEase.min.js"></script><!-- after (link removed) --> // no random numbers here'
  )
})

it('lists only the components and blocks a plan names', () => {
  expect(
    planBlocks({
      moments: [
        {
          recipes: [
            { id: 'svg-path-draw', catalog: 'rule' },
            { id: 'count-up', catalog: 'component' },
            { id: 'flowchart', catalog: 'block' }
          ]
        }
      ]
    })
  ).toEqual([
    { id: 'count-up', catalog: 'component' },
    { id: 'flowchart', catalog: 'block' }
  ])
})

it('lets a plan name a catalogued component as a recipe, and no other', async () => {
  const { validateTreatment } = await import('./scene-treatment')
  const problems = (id: string) =>
    validateTreatment(
      {
        moments: [
          {
            id: 'm1',
            purpose: 'p',
            observation: 'o',
            attention: 'a',
            objects: null,
            recipes: [
              {
                id,
                catalog: 'component',
                purpose: 'the count lands',
                channel: 'objects',
                controls: []
              }
            ]
          }
        ]
      },
      {
        brief: {
          purpose: {},
          units: [],
          evidence: [],
          coverage: [],
          entities: []
        },
        scene: 's',
        originScenes: [],
        videoScenes: [],
        catalog,
        bundleSkills: [],
        bundleReferences: [],
        delivery: null,
        assetKeys: []
      } as never
    ).problems.filter((problem) => problem.includes('pinned catalog'))
  expect(problems('count-up')).toEqual([])
  expect(problems('count-down')).toEqual([
    'moment m1 recipe "count-down" is not a component in the pinned catalog — name a catalogued one, or mark it adapted and describe it'
  ])
})
