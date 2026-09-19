// Skill versions for the diagnostics bundle (§8): every installed skill's
// name, its declared version, and a content fingerprint — so a later skill
// change visibly invalidates the evidence a proof stands on. The skills root
// is set by the desktop host (STUDIO_SKILLS_DIR); a browser-only server has
// no skills and reports none.
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Hash } from 'node:crypto'

const hashDirectory = async (dir: string, prefix: string, hash: Hash): Promise<void> => {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(dir, entry.name)
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) await hashDirectory(path, relative, hash)
    else if (entry.isFile()) {
      hash.update(relative)
      hash.update(await readFile(path))
    }
  }
}

export const skillVersions = async (): Promise<Array<{ name: string; version: string; hash: string }>> => {
  const root = process.env.STUDIO_SKILLS_DIR
  if (!root) return []
  const entries = await readdir(root, { withFileTypes: true }).catch(() => [])
  const skills: Array<{ name: string; version: string; hash: string }> = []
  for (const entry of entries.filter(each => each.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const doc = await readFile(join(root, entry.name, 'SKILL.md'), 'utf8').catch(() => '')
    if (!doc) continue
    const version = /^ {2}version:\s*["']?([^"'\n]+)["']?/m.exec(doc)?.[1]?.trim() || /^version:\s*["']?([^"'\n]+)["']?/m.exec(doc)?.[1]?.trim() || 'unversioned'
    const hash = createHash('sha256')
    await hashDirectory(join(root, entry.name), '', hash)
    skills.push({ name: entry.name, version, hash: hash.digest('hex').slice(0, 16) })
  }
  return skills
}
