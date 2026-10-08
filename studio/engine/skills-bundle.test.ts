import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

// The pinned Hyperframes bundle is upstream's files, byte for byte: each is
// listed in manifest.json with its git blob id, and nothing else is here.
const bundle = fileURLToPath(
  new URL('../skills/video-planner/hyperframes', import.meta.url)
)
const manifest = JSON.parse(
  readFileSync(join(bundle, 'manifest.json'), 'utf8')
) as {
  commit: string
  files: Array<{ path: string; blob: string; bytes: number }>
}
const blobId = (data: Buffer) =>
  createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex')
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })

it('holds the pinned upstream files, unchanged, and nothing unlisted', () => {
  const changed = manifest.files.filter((file) => {
    const path = join(bundle, file.path)
    if (!existsSync(path)) return true
    const data = readFileSync(path)
    return data.length !== file.bytes || blobId(data) !== file.blob
  })
  expect(changed.map((file) => file.path)).toEqual([])
  const listed = new Set(manifest.files.map((file) => file.path))
  const unlisted = walk(bundle)
    .map((path) => relative(bundle, path))
    .filter(
      (path) =>
        !listed.has(path) && !['PROVENANCE.md', 'manifest.json'].includes(path)
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
