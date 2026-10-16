import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, expect, it } from 'vitest'
import { supplyFonts } from './fonts'

const work = await mkdtemp(join(tmpdir(), 'studio-fonts-'))
afterAll(() => rm(work, { recursive: true, force: true }))
// A stand-in for the studio's Inter: its bytes, as the faces carry them.
const font = join(work, 'inter.woff2')
await writeFile(font, 'abc')
const DATA = 'url(data:font/woff2;base64,YWJj) format("woff2")'

/** A project: an index, and compositions by name. */
const project = async (name: string, files: Record<string, string>) => {
  const dir = join(work, name)
  await mkdir(join(dir, 'compositions', 'frames'), { recursive: true })
  await writeFile(
    join(dir, 'index.html'),
    '<html><head></head><body></body></html>'
  )
  for (const [file, html] of Object.entries(files))
    await writeFile(join(dir, 'compositions', file), html)
  return dir
}
const read = (dir: string, file: string) => readFile(join(dir, file), 'utf8')
const unsupplied = (file: string) => ({
  code: 'font_family_without_font_face',
  severity: 'error' as const,
  message:
    'Font family used without @font-face declaration: space grotesk. These are not in the auto-resolved font list, so the renderer cannot supply them automatically.',
  file
})

it('sets a face nothing supplies in the studio’s Inter, in the file that names it', async () => {
  // The preset's skin under a look of system faces (the Jev series run).
  const dir = await project('captions', {
    'captions.html':
      '<template><style>.cap { font-family: "Space Grotesk", system-ui, sans-serif; }</style></template>'
  })
  const captions = join(dir, 'compositions', 'captions.html')
  expect(
    await supplyFonts(dir, async () => [unsupplied(captions)], font)
  ).toEqual(['space grotesk'])
  const html = await read(dir, 'compositions/captions.html')
  expect(html).toContain(
    `@font-face { font-family: "space grotesk"; src: ${DATA}; font-weight: 100 900;`
  )
  expect(html.indexOf('@font-face')).toBeLessThan(html.indexOf('.cap {'))
})

it('pins Inter for the episode: unsure faces go, one face of Inter in the index', async () => {
  // As frame rounds left them: Inter by local() and from a CDN, Space
  // Grotesk by local(); a face the computer ships stays.
  const dir = await project('pinned', {
    'frames/f17-quote.html':
      '<style>@font-face { font-family: "Inter"; src: local("Inter"), local("Inter-Regular"); font-weight: 100 900; }\n@font-face { font-family: "Inter"; src: url("https://cdn.jsdelivr.net/npm/@fontsource/inter/400.woff2"); }\n@font-face { font-family: "Space Grotesk"; src: local("Space Grotesk"); }\n@font-face { font-family: "Hiragino Sans"; src: local("Hiragino Sans"); }\n.q { font-family: "Inter"; }</style>'
  })
  await supplyFonts(dir, async () => [], font)
  const frame = await read(dir, 'compositions/frames/f17-quote.html')
  expect(frame).not.toContain('local("Inter")')
  expect(frame).not.toContain('jsdelivr')
  expect(frame).not.toContain('local("Space Grotesk")')
  expect(frame).toContain('local("Hiragino Sans")')
  const index = await read(dir, 'index.html')
  expect(index).toContain(
    `<style data-studio-inter>@font-face { font-family: "Inter"; src: ${DATA};`
  )
  // Again: still one face of Inter in the index.
  await supplyFonts(dir, async () => [], font)
  expect(
    (await read(dir, 'index.html')).split('data-studio-inter').length
  ).toBe(2)
})

it('leaves a file outside the project, and a project with nothing to do, alone', async () => {
  const dir = await project('clean', {})
  const elsewhere = await project('elsewhere', {
    'captions.html': '<style>.cap { font-family: "Space Grotesk"; }</style>'
  })
  const outside = join(elsewhere, 'compositions', 'captions.html')
  expect(
    await supplyFonts(dir, async () => [unsupplied(outside)], font)
  ).toEqual([])
  expect(await readFile(outside, 'utf8')).not.toContain('@font-face')
  expect(await read(dir, 'index.html')).not.toContain('data-studio-inter')
})
