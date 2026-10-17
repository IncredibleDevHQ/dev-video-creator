import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

// The pinned Hyperframes bundles are upstream's files, byte for byte: each is
// listed in its manifest.json with its git blob id, and nothing else is there.
// The planner's bundle is the September commit; storyboard production's is
// the release the studio drives through the CLI.
const bundleAt = (path: string) => fileURLToPath(new URL(path, import.meta.url))
const bundle = bundleAt('../skills/video-planner/hyperframes')
type Manifest = {
  commit: string
  files: Array<{ path: string; blob: string; bytes: number }>
}
const manifestOf = (dir: string) =>
  JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as Manifest
const manifest = manifestOf(bundle)
const blobId = (data: Buffer) =>
  createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex')
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })

for (const dir of [bundle, bundleAt('../skills/storyboard-master/hyperframes')])
  it(`holds the pinned upstream files, unchanged, and nothing unlisted: ${relative(bundleAt('..'), dir)}`, () => {
    const { files } = manifestOf(dir)
    const changed = files.filter((file) => {
      const path = join(dir, file.path)
      if (!existsSync(path)) return true
      const data = readFileSync(path)
      return data.length !== file.bytes || blobId(data) !== file.blob
    })
    expect(changed.map((file) => file.path)).toEqual([])
    const listed = new Set(files.map((file) => file.path))
    const unlisted = walk(dir)
      .map((path) => relative(dir, path))
      .filter(
        (path) =>
          !listed.has(path) &&
          !['PROVENANCE.md', 'manifest.json'].includes(path)
      )
    expect(unlisted).toEqual([])
  })

it('holds every recipe and blueprint body the catalog names', () => {
  const catalog = JSON.parse(
    readFileSync(join(bundle, '..', 'capabilities.json'), 'utf8')
  ) as {
    upstreamCommit: string
    entries: Array<{ id: string; source: string; bodyVendored: boolean }>
  }
  expect(catalog.upstreamCommit).toBe(manifest.commit)
  // A body said to be here is here; one said to be missing is missing.
  const wrong = catalog.entries.filter(
    (entry) =>
      entry.bodyVendored !==
      (entry.source.includes('#') ||
        existsSync(join(bundle, entry.source.split('#')[0])))
  )
  expect(wrong.map((entry) => entry.id)).toEqual([])
  expect(
    catalog.entries.filter((entry) => !entry.bodyVendored).map((e) => e.id)
  ).toEqual([])
})
