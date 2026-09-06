// Skills install check (spec §5): fresh project → install → files + lock;
// hand-edit → second install keeps the edit and marks modifiedLocally.
// Compiles src/harness/skills-install.ts on the fly — no Electron needed.
import { build } from 'esbuild'
import { mkdtemp, readFile, rm, writeFile, appendFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const appDir = fileURLToPath(new URL('..', import.meta.url))
const root = await mkdtemp(join(tmpdir(), 'studio-skills-install-'))
const modulePath = join(root, 'skills-install.mjs')
await build({
  entryPoints: [join(appDir, 'src/harness/skills-install.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: modulePath,
  logLevel: 'silent',
})
const { installSkills } = await import(modulePath)
const vendored = join(appDir, 'skills')

const results = []
const check = (name, ok, detail = '') => results.push([name, ok ? 'PASS' : 'FAIL', detail])

const projectDir = join(root, 'project')
await mkdirSafe(projectDir)
async function mkdirSafe(dir) {
  const { mkdir } = await import('node:fs/promises')
  await mkdir(dir, { recursive: true })
}

const first = await installSkills(vendored, projectDir)
check(
  'installs skill folders',
  existsSync(join(projectDir, '.claude/skills/motion-master/SKILL.md')),
  first.installed.join(','),
)
const agents = await readFile(join(projectDir, 'AGENTS.md'), 'utf8')
check(
  'AGENTS.md pointer written',
  agents.includes('Before any motion, stage, speaker or publish task read `.claude/skills/motion-master/SKILL.md`'),
)
const lock1 = JSON.parse(await readFile(join(projectDir, 'skills.lock'), 'utf8'))
const entry1 = lock1.skills['motion-master']
check(
  'lock has version + sha256',
  Boolean(entry1?.version && /^[0-9a-f]{64}$/.test(entry1.sha256 || '')),
  `version ${entry1?.version}`,
)
check(
  'all five vendored skills installed',
  first.installed.sort().join(',') === 'motion-master,page-master,speaker-crew,stage-director,video-producer',
  first.installed.join(','),
)

// Second install with no changes: everything skipped, no duplication.
const second = await installSkills(vendored, projectDir)
check('unchanged re-install skips', second.installed.length === 0 && second.modifiedLocally.length === 0)
const agents2 = await readFile(join(projectDir, 'AGENTS.md'), 'utf8')
check(
  'AGENTS.md pointer not duplicated',
  agents2.split('incredible-studio:skills').length === 2,
)

// Pre-existing AGENTS.md without the pointer: appended once, content kept.
const otherDir = join(root, 'other')
await mkdirSafe(otherDir)
await writeFile(join(otherDir, 'AGENTS.md'), '# My notes\n\nDo not lose this.\n')
await installSkills(vendored, otherDir)
const otherAgents = await readFile(join(otherDir, 'AGENTS.md'), 'utf8')
check(
  'existing AGENTS.md appended, not clobbered',
  otherAgents.includes('Do not lose this.') && otherAgents.includes('incredible-studio:skills'),
)

// Hand-edit the installed skill: re-install must keep it and mark the lock.
await appendFile(join(projectDir, '.claude/skills/motion-master/SKILL.md'), '\nLocal tweak.\n')
const third = await installSkills(vendored, projectDir)
const edited = await readFile(join(projectDir, '.claude/skills/motion-master/SKILL.md'), 'utf8')
check('local edit kept', edited.includes('Local tweak.'))
const lock3 = JSON.parse(await readFile(join(projectDir, 'skills.lock'), 'utf8'))
check(
  'lock marks modifiedLocally',
  lock3.skills['motion-master']?.modifiedLocally === true,
  third.modifiedLocally.join(','),
)
check(
  'vendored copy untouched',
  !(await readFile(join(vendored, 'motion-master/SKILL.md'), 'utf8')).includes('Local tweak.'),
)

await rm(root, { recursive: true, force: true })
for (const [name, status, detail] of results) console.log(`${status}  ${name}  ${detail}`)
const failures = results.filter(result => result[1] === 'FAIL').length
console.log(failures ? `SKILLS INSTALL FAIL (${failures})` : 'SKILLS INSTALL PASS')
process.exit(failures ? 1 : 0)
