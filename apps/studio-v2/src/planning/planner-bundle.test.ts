import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { catalogFromBundle } from '../../scripts/build-capability-catalog'

const SKILL = fileURLToPath(new URL('../../../studio-desktop/skills/video-planner/', import.meta.url))
const BUNDLE = `${SKILL}hyperframes/`

describe('the pinned Hyperframes planning bundle', () => {
  const manifest = JSON.parse(readFileSync(`${BUNDLE}manifest.json`, 'utf8')) as {
    commit: string
    files: Array<{ path: string; blob: string; bytes: number }>
  }

  it('is byte-identical to the upstream files at the pinned commit', () => {
    expect(manifest.commit).toBe('99221c50a5e5927ca243454b4e4f02f9adf7cfc6')
    expect(manifest.files.length).toBeGreaterThan(40)
    for (const file of manifest.files) {
      const data = readFileSync(`${BUNDLE}${file.path}`)
      // A git blob id: the file bytes as git stores them.
      const blob = createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex')
      expect(blob, file.path).toBe(file.blob)
    }
    expect(manifest.files.some(file => file.path === 'LICENSE')).toBe(true)
  })

  it('lists exactly the capabilities its indexes catalogue, none proven yet', () => {
    const committed = JSON.parse(readFileSync(`${SKILL}capabilities.json`, 'utf8'))
    expect(committed).toEqual(catalogFromBundle())
    expect(committed.entries.filter((entry: { kind: string }) => entry.kind === 'blueprint')).toHaveLength(22)
    expect(committed.entries.every((entry: { verifiedInInstalledRuntime: boolean }) => entry.verifiedInInstalledRuntime === false)).toBe(true)
  })

  it('names only files the bundle actually ships', () => {
    const skill = readFileSync(`${SKILL}SKILL.md`, 'utf8')
    // A path with a <placeholder> names a family of files; the route files are checked below.
    const referenced = [...skill.matchAll(/`((?:skills\/)[^`]+?\.md)`/g)].map(match => match[1]).filter(path => !path.includes('<'))
    for (const route of ['general-video', 'faceless-explainer', 'motion-graphics', 'talking-head-recut']) {
      expect(existsSync(`${BUNDLE}skills/hyperframes/references/routes/${route}.md`), route).toBe(true)
    }
    expect(referenced.length).toBeGreaterThan(5)
    for (const path of referenced) expect(existsSync(`${BUNDLE}${path}`), path).toBe(true)
    // Bare names in a list continue the directory of the path before them.
    for (const name of ['beat-direction.md', 'composition-patterns.md', 'typography.md', 'narration.md', 'video-composition.md', 'house-style.md']) {
      expect(existsSync(`${BUNDLE}skills/hyperframes-creative/references/${name}`), name).toBe(true)
    }
    for (const name of ['rules-index.md', 'blueprints-index.md', 'techniques.md']) {
      expect(existsSync(`${BUNDLE}skills/hyperframes-animation/${name}`), name).toBe(true)
    }
    for (const reference of ['planning-boundary.md', 'product-overrides.md', 'brief-contract.md', 'treatment-contract.md']) {
      expect(existsSync(`${SKILL}references/${reference}`), reference).toBe(true)
    }
  })
})
