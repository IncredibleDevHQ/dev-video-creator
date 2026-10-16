// Fonts an episode can't supply never stop it. Hyperframes' lint names a
// family a composition uses with no @font-face that the renderer can't
// resolve (a preset's Space Grotesk under a look of system faces, in a frame
// or in captions.html, which no frame round can rebuild: the Jev series run
// stopped on it). Each such family is set in the studio's own Inter, its
// files staged, through an @font-face of that name in the file that uses it.
import { readFile, realpath, writeFile } from 'node:fs/promises'
import type { Finding } from './check'
import { cliJson, runCli } from './hyperframes'
import { stageInter } from './workspace'

/** A lint finding names its file as `file`; the check's, as `sourceFile`. */
type LintFinding = Finding & { file?: string }
type Lint = (dir: string) => Promise<LintFinding[]>

/** `hyperframes lint` on a project: no browser, its findings. */
export const lintProject: Lint = async (dir) =>
  cliJson<{ findings?: LintFinding[] }>(
    await runCli(['lint', '--json', '.'], dir, 120_000)
  )?.findings || []

const UNSUPPLIED = /declaration: ([^.]+)\./

/** The faces given, for a family the episode can't supply. */
export const interFaces = (family: string, files: string[]) =>
  files
    .map((file) => {
      const weight = /-(\d00)\.woff2$/.exec(file)?.[1] || '400'
      return `@font-face { font-family: "${family.replace(/"/g, '')}"; src: url("capture/assets/fonts/${file}") format("woff2"); font-weight: ${weight}; font-style: normal; }`
    })
    .join('\n')

/** Sets in Inter each family the lint finds no way to supply; the families
 * set so. */
export const supplyFonts = async (dir: string, lint: Lint = lintProject) => {
  const findings = (await lint(dir)).filter(
    (finding) => finding.code === 'font_family_without_font_face'
  )
  if (!findings.length) return []
  const root = await realpath(dir)
  const files = await stageInter(dir)
  if (!files.length) return []
  const supplied: string[] = []
  for (const finding of findings) {
    const names = (UNSUPPLIED.exec(finding.message)?.[1] || '')
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean)
    const file = finding.file || finding.sourceFile
    const source = file ? await realpath(file).catch(() => '') : ''
    if (!names.length || !source.startsWith(`${root}/`)) continue
    const html = await readFile(source, 'utf8')
    const faces = names.map((name) => interFaces(name, files)).join('\n')
    await writeFile(
      source,
      /<style[^>]*>/.test(html)
        ? html.replace(/<style([^>]*)>/, `<style$1>\n${faces}\n`)
        : `<style>\n${faces}\n</style>\n${html}`
    )
    supplied.push(...names)
  }
  return supplied
}
