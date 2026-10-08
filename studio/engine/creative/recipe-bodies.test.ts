import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, expect, it } from 'vitest'

// A synthetic pinned bundle: one rule body, one blueprint only in the index.
const root = await mkdtemp(join(tmpdir(), 'studio-recipe-bodies-'))
process.env.MINIMAL_STUDIO_SKILLS_DIR = root
afterAll(() => {
  delete process.env.MINIMAL_STUDIO_SKILLS_DIR
  return rm(root, { recursive: true, force: true })
})
const animation = join(
  root,
  'video-planner',
  'hyperframes',
  'skills',
  'hyperframes-animation'
)
await mkdir(join(animation, 'rules'), { recursive: true })
await writeFile(
  join(animation, 'rules-index.md'),
  `# Rules Index

## The contract — every rule assumes this

- runs on ONE paused GSAP timeline.

## Text

<rules>
<spring-pop-entrance path="rules/spring-pop-entrance.md">The canonical entrance pop.</spring-pop-entrance>
</rules>
`
)
await writeFile(
  join(animation, 'blueprints-index.md'),
  '<blueprints>\n<blueprint id="comparison-split" roles="Benefits">Two sides, one axis.</blueprint>\n</blueprints>\n'
)
await writeFile(
  join(animation, 'rules', 'spring-pop-entrance.md'),
  '# Spring pop entrance\n\nfromTo scale 0 → 1 with back.out.\n'
)
await writeFile(
  join(animation, 'techniques.md'),
  '# Techniques\n\n## Contents\n\n- one\n\n## 9. GSAP MotionPathPlugin\n\nAnimate along a path with motionPath.\n\n## 10. Velocity-Matched Transitions\n\nMatch the velocity.\n'
)
const { indexEntry, planRecipes, recipeBodies } =
  await import('./recipe-bodies')

it('puts the bodies of the recipes a plan names in front of the producer', async () => {
  const ids = planRecipes({
    moments: [
      {
        recipes: [
          { id: 'spring-pop-entrance' },
          { id: 'comparison-split' },
          { id: 'gsap-motionpathplugin' }
        ]
      },
      {
        recipes: [
          { id: 'spring-pop-entrance' },
          { id: '../escape' },
          { id: 'made-up' }
        ]
      }
    ]
  })
  const { files, bodies, missing } = await recipeBodies(ids)
  expect(bodies).toEqual(['spring-pop-entrance', 'gsap-motionpathplugin'])
  // A technique's body is its section of techniques.md.
  expect(files['packet/recipes/gsap-motionpathplugin.md']).toBe(
    '## 9. GSAP MotionPathPlugin\n\nAnimate along a path with motionPath.'
  )
  expect(missing).toEqual(['comparison-split'])
  expect(files['packet/recipes/spring-pop-entrance.md']).toContain('back.out')
  expect(files['packet/recipes/comparison-split.md']).toContain(
    'index entry only'
  )
  expect(files['packet/recipes/comparison-split.md']).toContain(
    'Two sides, one axis.'
  )
  expect(files['packet/recipes/CONTRACT.md']).toContain(
    'ONE paused GSAP timeline'
  )
  expect(Object.keys(files)).toHaveLength(4)
  expect(indexEntry('<x path="a">X does</x>', 'x')).toBe('X does')
})
