// Fonts never stop an episode, and the film keeps the faces the stills
// showed. Hyperframes' lint names a family a composition uses that the
// renderer can't resolve (a preset's Space Grotesk under a look of system
// faces, in a frame or in captions.html, which no frame round can rebuild:
// the Jev series run stopped on it); each is set in the studio's own Inter,
// declared in the file that uses it. And Inter itself is pinned: frame
// rounds had declared it as local("Inter"), which this computer doesn't
// have, so the renderer skipped its own copy and Inter fell back to a
// system face in the film (a serif where no fallback was named) while the
// stills showed Inter. Those faces go; Inter comes from the studio's file,
// once, for the whole episode. Faces are data URIs: they load wherever the
// renderer reads the page from.
import { readFile, readdir, realpath, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Finding } from './check'
import { cliJson, runCli } from './hyperframes'
import { INTER } from './workspace'

/** A lint finding names its file as `file`; the check's, as `sourceFile`. */
type LintFinding = Finding & { file?: string }
type Lint = (dir: string) => Promise<LintFinding[]>

/** `hyperframes lint` on a project: no browser, its findings. */
export const lintProject: Lint = async (dir) =>
  cliJson<{ findings?: LintFinding[] }>(
    await runCli(['lint', '--json', '.'], dir, 120_000)
  )?.findings || []

const UNSUPPLIED = /declaration: ([^.]+)\./
const FACE = /@font-face\s*\{[^}]*\}/gi
const familyOf = (face: string) =>
  /font-family\s*:\s*["']?([^"';]+)/i.exec(face)?.[1].trim().toLowerCase()

// Faces a computer ships, which local() may rightly name (Hyperframes'
// own advice for them).
const SYSTEM_FACE =
  /^(hiragino|pingfang|microsoft yahei|noto sans cjk|apple|sf |sf$|segoe|helvetica|arial|georgia|times|menlo|monaco|consolas|courier)/

/** A face that names a web font only by local(), or fetches it from the
 * web: neither is sure to be there when the film is rendered. */
const unsure = (face: string) => {
  const src = /src\s*:([^;]*)/i.exec(face)?.[1] || ''
  const family = familyOf(face) || ''
  return (
    /https?:\/\//i.test(src) ||
    (!/url\(/i.test(src) && !SYSTEM_FACE.test(family))
  )
}

/** An @font-face over the studio's Inter, for any family name. */
export const interFace = (family: string, data: string) =>
  `@font-face { font-family: "${family.replace(/"/g, '')}"; src: url(data:font/woff2;base64,${data}) format("woff2"); font-weight: 100 900; font-style: normal; }`

/** The compositions of a project: its frames and the captions. */
const compositions = async (dir: string) => {
  const found: string[] = []
  const walk = async (folder: string) => {
    for (const entry of await readdir(folder, { withFileTypes: true }).catch(
      () => []
    ))
      if (entry.isDirectory()) await walk(join(folder, entry.name))
      else if (entry.name.endsWith('.html'))
        found.push(join(folder, entry.name))
  }
  await walk(join(dir, 'compositions'))
  return found
}

/** Into a page's first style (or head), before what uses it. */
const prepend = (html: string, faces: string) =>
  /<style[^>]*>/.test(html)
    ? html.replace(/<style([^>]*)>/, `<style$1>\n${faces}\n`)
    : /<head[^>]*>/.test(html)
      ? html.replace(/<head([^>]*)>/, `<head$1>\n<style>\n${faces}\n</style>`)
      : `<style>\n${faces}\n</style>\n${html}`

const PINNED = /<style data-studio-inter>[\s\S]*?<\/style>\n?/

/** Inter from the studio's file for the whole episode: unsure faces leave
 * every composition (the lint then names a web font left undeclared, to be
 * set in Inter), and one face of Inter goes in the index. */
export const pinInter = async (dir: string, data: string) => {
  const used: string[] = []
  for (const file of await compositions(dir)) {
    const html = await readFile(file, 'utf8')
    const next = html.replace(FACE, (face) => (unsure(face) ? '' : face))
    if (/font-family\s*:\s*["']?inter\b/i.test(next)) used.push(file)
    if (next !== html) await writeFile(file, next)
  }
  const index = join(dir, 'index.html')
  const html = await readFile(index, 'utf8').catch(() => '')
  if (!used.length || !html) return used
  const pinned = `<style data-studio-inter>${interFace('Inter', data)}</style>\n`
  await writeFile(
    index,
    PINNED.test(html)
      ? html.replace(PINNED, pinned)
      : /<head[^>]*>/.test(html)
        ? html.replace(/<head([^>]*)>/, `<head$1>\n${pinned}`)
        : `${pinned}${html}`
  )
  return used
}

/** Pins Inter, then sets in it each family the lint finds no way to supply;
 * the families set so. */
export const supplyFonts = async (
  dir: string,
  lint: Lint = lintProject,
  font = INTER
) => {
  const data = (await readFile(font).catch(() => null))?.toString('base64')
  if (!data) return []
  await pinInter(dir, data)
  const findings = (await lint(dir)).filter(
    (finding) => finding.code === 'font_family_without_font_face'
  )
  const root = await realpath(dir)
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
    const faces = names.map((name) => interFace(name, data)).join('\n')
    await writeFile(source, prepend(html, faces))
    supplied.push(...names)
  }
  return supplied
}
