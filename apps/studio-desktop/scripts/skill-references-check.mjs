// Skill instruction dependency check (D4): the files a skill's instructions
// SHIP WITH and point at must exist — a fresh installed run must never meet a
// missing required file. Checked: `${SKILL_DIR}/…` paths (skill root),
// skill-root-relative references (references/ workflows/ scripts/ templates/
// vendor/), and ./ ../ links. Not checked: run-directory artifacts the agent
// writes (motion/, pages/, explainer/, bare filenames) and repo documentation
// paths (apps/, packages/, server/). No app needed.
import { readdir, readFile, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const skillsDir = fileURLToPath(new URL('../skills/', import.meta.url))

const markdownFiles = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  const out = []
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...await markdownFiles(path))
    else if (entry.name.endsWith('.md')) out.push(path)
  }
  return out
}

let checked = 0
const missing = []

for (const skill of await readdir(skillsDir)) {
  const root = join(skillsDir, skill)
  if (!(await stat(root)).isDirectory()) continue
  for (const file of await markdownFiles(root)) {
    // Upstream vendor trees are partial by design (see VENDORING.md): their
    // internal doc web is reference material, and our routes never load it as
    // instructions. References FROM our files INTO vendor/ are still checked.
    if (file.slice(root.length).startsWith('/vendor/')) continue
    const text = await readFile(file, 'utf8')
    const refs = []
    for (const match of text.matchAll(/\$\{SKILL_DIR\}\/([\w./-]+\.(?:md|json|py|ts|js|svg))/g)) {
      refs.push({ ref: match[1], base: root })
    }
    for (const match of text.matchAll(/`((?:references|workflows|scripts|templates|vendor)\/[\w./-]+\.(?:md|json|py|ts|js|svg))`/g)) {
      refs.push({ ref: match[1], base: root })
    }
    for (const match of text.matchAll(/`(\.{1,2}\/[\w./-]+\.(?:md|json|py|ts|js|svg))`/g)) {
      refs.push({ ref: match[1], base: dirname(file) })
    }
    for (const { ref, base } of refs) {
      checked += 1
      const target = resolve(base, ref)
      const found = await stat(target).then(s => s.isFile()).catch(() => false)
      if (!found) missing.push(`${skill}/${file.slice(root.length + 1)} → ${ref}`)
    }
  }
}

for (const entry of missing) console.log(`FAIL  ${entry}`)
console.log(`${checked} shipped instruction references checked`)
console.log(missing.length ? `SKILL REFERENCES CHECK FAIL (${missing.length})` : 'SKILL REFERENCES CHECK PASS')
process.exitCode = missing.length ? 1 : 0

