import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, expect, it } from 'vitest'
import { LOOKS } from '../shared/looks'
import type { BrandFontFile } from '../shared/settings'
const { siteLook, startingLook, withLook } = await import('./looks')
const { lookExtras } = await import('./look-apply')
const { validateBranding } = await import('./branding')
const { readSourceNarrative } = await import('./source-document')
const { storeAsset } = await import('./persistence')
const { keepFaceNames, stageBrandFonts, stagedNames, tokensFor } =
  await import('./storyboard/workspace')
const { presetDir, runScript } = await import('./storyboard/hyperframes')
const work = await mkdtemp(join(tmpdir(), 'studio-brand-look-'))
afterAll(() => rm(work, { recursive: true, force: true }))

const font = async (family: string, weight: BrandFontFile['weight']) => {
  const stored = await storeAsset({
    body: Buffer.concat([Buffer.from('wOF2'), Buffer.alloc(64)]),
    contentType: 'font/woff2',
    kind: 'brand-font',
    extension: '.woff2'
  })
  return {
    family,
    weight,
    style: 'normal' as const,
    objectKey: stored.objectKey,
    format: 'woff2' as const
  }
}
const logo = async () => {
  const png = await storeAsset({
    body: Buffer.from('\x89PNG\r\n'),
    contentType: 'image/png',
    kind: 'brand-logo',
    extension: '.png'
  })
  return {
    pngKey: png.objectKey,
    width: 120,
    height: 30,
    label: 'fixture home',
    from: 'fixture.example'
  }
}

const sourceWith = async () => {
  const notes = readSourceNarrative('A post about payments.')
  return {
    ...notes,
    url: 'https://fixture.example/blog/payments',
    site: 'Fixture',
    palette: {
      ...notes.palette,
      ground: '#ffffff',
      text: '#0a2540',
      accent: '#533afd',
      secondary: '#00d66f',
      provenance: 'extracted' as const,
      from: 'fixture.example'
    },
    fonts: {
      display: 'Fixture Grotesk',
      body: 'Inter',
      mono: 'JetBrains Mono',
      seen: []
    },
    brand: {
      logo: await logo(),
      fontFiles: [await font('Inter', [100, 900]), await font('Manrope', 700)]
    }
  }
}

it('starts a notebook in its site’s look: open faces by name with their files, the logo on offer', async () => {
  const source = await sourceWith()
  const look = siteLook(source)!
  // Inter ships as a file and keeps its name; the foundry face stands in.
  expect(look.fonts).toEqual({
    display: 'Inter',
    body: 'Inter',
    mono: 'ui-monospace'
  })
  expect(look.description).toMatch(/One of its fonts can’t be loaded here/)
  expect(look.fontFiles?.map((file) => file.family)).toEqual(['Inter'])
  // Offered whichever look it wears: the logo and every open face.
  expect(look.site?.logo?.label).toBe('fixture home')
  expect(look.site?.fontFiles.map((file) => file.family)).toEqual([
    'Inter',
    'Manrope'
  ])
  expect((await startingLook(source)).id).toBe('site')
  const branding = withLook(undefined, look)
  expect(branding.fontFiles?.length).toBe(1)
  expect(branding.site?.from).toBe('fixture.example')
  // The logo is offered, not used: the notebook keeps the creator's.
  expect(branding.logoKey).toBeNull()
  // A built-in look carries no files, and the site's offer stays.
  const paper = withLook(branding, LOOKS[0])
  expect(paper.fontFiles).toBeUndefined()
  expect(paper.site?.logo).toBeTruthy()
})

it('takes a look’s files from what the studio read, never from the request', async () => {
  const source = await sourceWith()
  const branding = withLook(undefined, siteLook(source)!)
  const site = lookExtras(
    {
      ...LOOKS[0],
      id: 'site',
      fonts: { display: 'Inter', body: 'Inter', mono: 'x' }
    },
    branding,
    source,
    []
  )
  expect(site.fontFiles?.map((file) => file.family)).toEqual(['Inter'])
  // Its words are the studio's own, kept as the look's note.
  expect(site.description).toMatch(/^Colours read from Fixture\./)
  expect(
    withLook(branding, { ...LOOKS[0], id: 'site', ...site }).look?.note
  ).toBe(site.description)
  // The creator's own change keeps the files of the faces still in use,
  // including a face of the site's they chose from the menu.
  const custom = lookExtras(
    {
      ...LOOKS[0],
      id: 'custom',
      fonts: { display: 'Manrope', body: 'Georgia', mono: 'x' }
    },
    branding,
    source,
    []
  )
  expect(custom.fontFiles?.map((file) => file.family)).toEqual(['Manrope'])
  // A built-in look needs no files; the site's offer goes with any look.
  const ink = lookExtras(LOOKS[1], branding, source, [])
  expect(ink.fontFiles).toBeUndefined()
  expect(ink.site?.from).toBe('fixture.example')
})

it('saves a brand’s font files and site only as the studio’s own stored files', async () => {
  const source = await sourceWith()
  const branding = withLook(undefined, siteLook(source)!)
  const saved = await validateBranding(branding)
  expect(saved.fontFiles?.[0].family).toBe('Inter')
  expect(saved.site?.logo?.pngKey).toBe(branding.site!.logo!.pngKey)
  await expect(
    validateBranding({
      ...branding,
      fontFiles: [{ ...branding.fontFiles![0], objectKey: '../../etc/passwd' }]
    })
  ).rejects.toThrow(/font files/)
  await expect(
    validateBranding({
      ...branding,
      site: {
        ...branding.site!,
        logo: { ...branding.site!.logo!, pngKey: 'x.svg' }
      }
    })
  ).rejects.toThrow(/logo/)
})

it('carries the look’s faces into the episode: files by family and weight, the code face too', async () => {
  const source = await sourceWith()
  const branding = {
    ...withLook(undefined, siteLook(source)!),
    fonts: { display: 'Inter', body: 'Inter', mono: 'JetBrains Mono' }
  }
  expect(stagedNames(branding.fontFiles![0])).toEqual([
    'Inter-400.woff2',
    'Inter-500.woff2',
    'Inter-600.woff2',
    'Inter-700.woff2',
    'Inter-800.woff2'
  ])
  const tokens = tokensFor('T', 'D', branding)
  expect(tokens.fonts).toEqual([
    {
      family: 'Inter',
      weights: [100, 200, 300, 400, 500, 600, 700, 800, 900]
    },
    { family: 'JetBrains Mono' }
  ])
  await stageBrandFonts(work, branding)
  expect(
    (await readdir(join(work, 'capture', 'assets', 'fonts'))).sort()
  ).toEqual([
    'Inter-400.woff2',
    'Inter-500.woff2',
    'Inter-600.woff2',
    'Inter-700.woff2',
    'Inter-800.woff2'
  ])
})

it('names the brand’s faces whole in every preset’s frame, at weights they ship', async () => {
  const source = await sourceWith()
  const branding = {
    ...withLook(undefined, siteLook(source)!),
    fonts: { display: 'Inter Tight', body: 'Inter', mono: 'JetBrains Mono' },
    fontFiles: [
      await font('Inter Tight', 400),
      await font('Inter Tight', 500),
      await font('Inter Tight', 600),
      await font('Inter', [100, 900]),
      await font('JetBrains Mono', 400)
    ]
  }
  // build-frame sets headings and text in the first face, code in the code
  // face, and caps every weight to what those two ship.
  const tokens = tokensFor('T', 'D', branding)
  expect(tokens.fonts).toEqual([
    { family: 'Inter Tight', weights: [400, 500, 600] },
    { family: 'Inter' },
    { family: 'JetBrains Mono', weights: [400] }
  ])
  for (const preset of [
    'blue-professional',
    'code-editorial',
    'cobalt-grid',
    'editorial-forest',
    'cartesian'
  ]) {
    const dir = join(work, preset)
    await mkdir(join(dir, 'capture', 'extracted'), { recursive: true })
    await writeFile(
      join(dir, 'capture', 'extracted', 'tokens.json'),
      JSON.stringify(tokens)
    )
    await runScript(
      'build-frame',
      ['--preset', preset, '--hyperframes', dir],
      dir
    )
    const frame = keepFaceNames(
      await readFile(join(dir, 'frame.md'), 'utf8'),
      await readFile(join(presetDir(), preset, 'FRAME.md'), 'utf8'),
      tokens.fonts.map((entry) => entry.family)
    )
    // Where the preset's body face was Inter, build-frame wrote "Inter Tight
    // Tight" in the type ramp, the components and the prose alike.
    expect(frame, preset).not.toMatch(/Tight Tight/)
    const families = [...frame.matchAll(/fontFamily:\s*"([^"]+)"/g)].map(
      (match) => match[1]
    )
    expect(families.length, preset).toBeGreaterThan(5)
    for (const name of families)
      expect(['Inter Tight', 'JetBrains Mono'], preset).toContain(name)
    // The type ramp, up to the next block.
    const ramp = frame.split('\ntypography:\n')[1].split(/\n\S/)[0]
    expect(ramp, preset).toMatch(/weight:\s*[456]00/)
    expect(ramp, preset).not.toMatch(/weight:\s*[789]00/)
  }
}, 60_000)
