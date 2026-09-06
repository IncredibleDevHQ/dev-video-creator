// Per-project skill install (spec §5): copies the vendored skills into
// <projectDir>/.claude/skills/*, adds the AGENTS.md pointer (once, never
// clobbering an existing file), and keeps <projectDir>/skills.lock with
// versions and content hashes. Re-installs only when the vendored hash
// differs; a locally modified skill is marked `modifiedLocally` and skipped.
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

export type SkillLockEntry = {
  version: string
  sha256: string
  installedAt: string
  modifiedLocally?: boolean
}

export type SkillsLock = {
  version: 1
  skills: Record<string, SkillLockEntry>
}

export type InstallReport = {
  projectDir: string
  installed: string[]
  skipped: string[]
  modifiedLocally: string[]
  lock: SkillsLock
}

const AGENTS_MARKER = '<!-- incredible-studio:skills -->'

const skillVersion = async (skillDir: string): Promise<string> => {
  try {
    const head = (await readFile(join(skillDir, 'SKILL.md'), 'utf8')).slice(0, 4_000)
    const match = head.match(/^\s*version:\s*["']?([0-9][\w.-]*)["']?\s*$/m)
    return match ? match[1] : '0.0.0'
  } catch {
    return '0.0.0'
  }
}

// sha256 over the sorted relative paths + file contents of a folder.
const hashFolder = async (dir: string): Promise<string> => {
  const hash = createHash('sha256')
  const walk = async (current: string): Promise<void> => {
    const entries = (await readdir(current, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name),
    )
    for (const entry of entries) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) {
        await walk(path)
      } else if (entry.isFile()) {
        hash.update(relative(dir, path))
        hash.update('\0')
        hash.update(await readFile(path))
        hash.update('\0')
      }
    }
  }
  await walk(dir)
  return hash.digest('hex')
}

const readLock = async (projectDir: string): Promise<SkillsLock> => {
  try {
    const parsed = JSON.parse(await readFile(join(projectDir, 'skills.lock'), 'utf8'))
    if (parsed && typeof parsed === 'object' && parsed.skills) return parsed as SkillsLock
  } catch {
    // Missing or unreadable lock — start fresh.
  }
  return { version: 1, skills: {} }
}

const ensureAgentsPointer = async (projectDir: string, skillNames: string[]) => {
  const path = join(projectDir, 'AGENTS.md')
  const pointer = [
    '',
    AGENTS_MARKER,
    '## Skills',
    '',
    ...skillNames.map(
      name =>
        `- Before any motion, stage, speaker or publish task read \`.claude/skills/${name}/SKILL.md\`.`,
    ),
    '',
  ].join('\n')
  if (!existsSync(path)) {
    await writeFile(path, `# Project notes\n${pointer}`)
    return
  }
  const existing = await readFile(path, 'utf8')
  if (existing.includes(AGENTS_MARKER)) return
  await writeFile(path, `${existing.replace(/\s*$/, '')}\n${pointer}`)
}

// Installs (or refreshes) the vendored skills in a project directory.
export const installSkills = async (
  vendoredSkillsDir: string,
  projectDir: string,
): Promise<InstallReport> => {
  const report: InstallReport = {
    projectDir,
    installed: [],
    skipped: [],
    modifiedLocally: [],
    lock: await readLock(projectDir),
  }
  const entries = await readdir(vendoredSkillsDir, { withFileTypes: true })
  const skillNames: string[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const name = entry.name
    skillNames.push(name)
    const vendoredDir = join(vendoredSkillsDir, name)
    const targetDir = join(projectDir, '.claude', 'skills', name)
    const vendoredHash = await hashFolder(vendoredDir)
    const version = await skillVersion(vendoredDir)
    const locked = report.lock.skills[name]
    if (existsSync(targetDir)) {
      const installedHash = await hashFolder(targetDir)
      if (installedHash === vendoredHash) {
        // Already current.
        report.skipped.push(name)
        report.lock.skills[name] = {
          version,
          sha256: vendoredHash,
          installedAt: locked?.installedAt || new Date().toISOString(),
        }
        continue
      }
      if (locked?.sha256 && installedHash !== locked.sha256) {
        // The project edited its copy since we installed it — keep their
        // changes and say so in the lock.
        report.modifiedLocally.push(name)
        report.lock.skills[name] = {
          version: locked.version,
          sha256: installedHash,
          installedAt: locked.installedAt,
          modifiedLocally: true,
        }
        continue
      }
    }
    await rm(targetDir, { recursive: true, force: true })
    await mkdir(join(projectDir, '.claude', 'skills'), { recursive: true })
    await cp(vendoredDir, targetDir, { recursive: true })
    report.installed.push(name)
    report.lock.skills[name] = {
      version,
      sha256: vendoredHash,
      installedAt: new Date().toISOString(),
    }
  }
  await ensureAgentsPointer(projectDir, skillNames)
  await writeFile(
    join(projectDir, 'skills.lock'),
    JSON.stringify(report.lock, null, 2),
  )
  return report
}

// The run's SKILL_DIR: the installed copy when present, else the vendored one.
export const resolveSkillDir = (
  vendoredSkillsDir: string,
  projectDir: string,
  skill: string,
): string => {
  const installed = join(projectDir, '.claude', 'skills', skill)
  return existsSync(join(installed, 'SKILL.md'))
    ? installed
    : join(vendoredSkillsDir, skill)
}
