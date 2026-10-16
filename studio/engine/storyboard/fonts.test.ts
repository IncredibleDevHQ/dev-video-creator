import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, expect, it } from 'vitest'
import { supplyFonts } from './fonts'

const work = await mkdtemp(join(tmpdir(), 'studio-fonts-'))
afterAll(() => rm(work, { recursive: true, force: true }))

/** A project whose captions name a face nothing supplies, as the preset's
 * skin did under a look of system faces (the Jev series run). */
const project = async (name: string) => {
  const dir = join(work, name)
  await mkdir(join(dir, 'compositions'), { recursive: true })
  const captions = join(dir, 'compositions', 'captions.html')
  await writeFile(
    captions,
    '<template><style>.cap { font-family: "Space Grotesk", system-ui, sans-serif; }</style><div class="cap"></div></template>'
  )
  return { dir, captions }
}
const unsupplied = (file: string) => ({
  code: 'font_family_without_font_face',
  severity: 'error' as const,
  message:
    'Font family used without @font-face declaration: space grotesk. These are not in the auto-resolved font list, so the renderer cannot supply them automatically.',
  file
})

it('sets a face nothing supplies in the studio’s Inter, in the file that names it', async () => {
  const { dir, captions } = await project('captions')
  expect(await supplyFonts(dir, async () => [unsupplied(captions)])).toEqual([
    'space grotesk'
  ])
  const html = await readFile(captions, 'utf8')
  expect(html).toContain(
    '@font-face { font-family: "space grotesk"; src: url("capture/assets/fonts/Inter-700.woff2") format("woff2"); font-weight: 700;'
  )
  // Inside the file's own style, before what uses it.
  expect(html.indexOf('@font-face')).toBeLessThan(html.indexOf('.cap {'))
  expect(
    (await readdir(join(dir, 'capture', 'assets', 'fonts'))).sort()
  ).toEqual([
    'Inter-400.woff2',
    'Inter-500.woff2',
    'Inter-600.woff2',
    'Inter-700.woff2',
    'Inter-800.woff2'
  ])
})

it('leaves a file outside the project, and a project with nothing to supply, alone', async () => {
  const { dir } = await project('clean')
  const elsewhere = await project('elsewhere')
  expect(
    await supplyFonts(dir, async () => [unsupplied(elsewhere.captions)])
  ).toEqual([])
  expect(await readFile(elsewhere.captions, 'utf8')).not.toContain('@font-face')
  const quiet = await project('quiet')
  expect(await supplyFonts(quiet.dir, async () => [])).toEqual([])
  await expect(readdir(join(quiet.dir, 'capture'))).rejects.toThrow()
})
