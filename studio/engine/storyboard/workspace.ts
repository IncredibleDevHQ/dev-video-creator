// One Hyperframes project per episode, on disk: created by the pinned CLI,
// given the episode's source and the notebook's look, and its frame.md made
// by the workflow's own build-frame script from the preset nearest the look.
// The look carries the brand (palette, fonts) into every episode the same way.
import { existsSync } from 'node:fs'
import { copyFile, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { BrandFontFile, Branding } from '../../shared/settings'
import { dataRoot, readAsset } from '../persistence'
import { cliTail, presetDir, runCli, runScript } from './hyperframes'

export const storyboardsRoot = () => join(dataRoot, 'storyboards')
export const productionDir = (projectId: string, productionId: string) =>
  join(storyboardsRoot(), projectId, productionId)

/** The studio's named looks, each with the preset whose design suits it. */
const LOOK_PRESETS: Record<string, string> = {
  paper: 'blue-professional',
  ink: 'code-editorial',
  blueprint: 'cobalt-grid',
  mint: 'editorial-forest',
  ember: 'cartesian'
}

const luminance = (hex: string) => {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return 255
  const n = parseInt(match[1], 16)
  return (
    0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)
  )
}

/** The frame preset for a look: its own, else by its ground. Every preset
 * is light; build-frame turns a dark brand's ground dark. */
export const presetFor = (branding?: Branding) => {
  const id = branding?.look?.id || ''
  if (LOOK_PRESETS[id]) return LOOK_PRESETS[id]
  const ground = branding?.palette?.ground || '#ffffff'
  return luminance(ground) < 96 ? 'code-editorial' : 'blue-professional'
}

const GENERIC = /^(ui-|system-ui|sans-serif|serif|monospace|-apple-system)/i
const family = (value?: string) =>
  String(value || '')
    .split(',')[0]
    .replace(/['"]/g, '')
    .trim()

/** tokens.json for build-frame: the look's colours by the job each does on
 * a page (ground, text, accent), and its fonts by name. */
export const tokensFor = (
  title: string,
  description: string,
  branding?: Branding
) => {
  const palette = branding?.palette
  const accent = branding?.accent
  const colors = palette
    ? [
        palette.ground,
        palette.text,
        accent || palette.secondary,
        palette.secondary
      ]
    : []
  const colorStats = palette
    ? [
        { hex: palette.ground, areaBg: 1000, maxArea: 1000, bgCount: 40 },
        { hex: palette.text, textCount: 400 },
        ...(accent ? [{ hex: accent, interactiveBg: 12, textCount: 20 }] : []),
        { hex: palette.secondary, textCount: 60 }
      ].filter((stat) => /^#[0-9a-f]{6}$/i.test(stat.hex))
    : []
  // The code face too: build-frame gives a monospaced brand face the
  // preset's code role.
  const names = [
    branding?.fonts?.display,
    branding?.fonts?.body,
    branding?.fonts?.mono
  ]
    .map(family)
    .filter(
      (name, index, all) =>
        name && !GENERIC.test(name) && all.indexOf(name) === index
    )
  // A look of system faces only names none the renderer can supply: it is
  // set in the studio's own Inter, never the preset's face (the Jev series
  // run stopped on Space Grotesk, which nothing shipped).
  if (!names.length) names.push('Inter')
  // build-frame sets every heading and every line of text in its text face
  // and caps each weight to the weights it is told: those of the files of
  // the faces it sets, so a heading never asks for a bold the face lacks.
  const { text, code } = buildFaces(names)
  const fonts = names.map((name) => {
    const weights =
      name === text || name === code
        ? weightsOf(
            (branding?.fontFiles || []).filter((file) => file.family === name)
          )
        : []
    return { family: name, ...(weights.length ? { weights } : {}) }
  })
  return { title, description, colors, colorStats, fonts }
}

// build-frame's code faces, by name (its own rule).
const MONO_FACE =
  /(?:^|[\s_-])mono(?:[\s_-]|$)|monospace|consol|courier|menlo|monaco|jetbrains|berkeley|space\s*mono|ibm\s*plex\s*mono|sf\s*mono|roboto\s*mono|source\s*code|fira\s*code|geist\s*mono|dm\s*mono/i

/** The brand faces build-frame sets: the first face not a code face for
 * headings and text alike, the first code face for code. */
const buildFaces = (names: string[]) => ({
  text: names.find((name) => !MONO_FACE.test(name)) ?? names[0],
  code: names.find((name) => MONO_FACE.test(name))
})

/** The weights a face's files cover: a variable file every hundred. */
const weightsOf = (files: BrandFontFile[]) =>
  [
    ...new Set(
      files.flatMap((file) =>
        Array.isArray(file.weight)
          ? [100, 200, 300, 400, 500, 600, 700, 800, 900].filter(
              (weight) =>
                weight >= (file.weight as number[])[0] &&
                weight <= (file.weight as number[])[1]
            )
          : [file.weight]
      )
    )
  ].sort((a, b) => a - b)

const PRESET_NAME = /^[a-z0-9-]+$/

/**
 * Creates the episode's project folder (once) and its design. Returns the
 * folder. A folder already made is kept, so a resumed production keeps its
 * built frames.
 */
const COLOR_LINE = /^(\s+)([\w-]+):\s*"?(#[0-9a-fA-F]{6})"?(.*)$/
const GROUND_KEY = /^(bg|background|canvas|paper|ground|surface)$/

/** The `colors:` block of a frame.md: each key's hex. */
const colorsOf = (md: string) => {
  const found = new Map<string, string>()
  let inside = false
  for (const line of md.split(/\r?\n/)) {
    if (/^colors:\s*$/.test(line)) inside = true
    else if (inside && /^\S/.test(line)) break
    else if (inside) {
      const match = COLOR_LINE.exec(line)
      if (match) found.set(match[2], match[3].toLowerCase())
    }
  }
  return found
}
const channels = (hex: string) =>
  [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16))
const chroma = (hex: string) =>
  Math.max(...channels(hex)) - Math.min(...channels(hex))
const isDark = (hex: string) => {
  const [r, g, b] = channels(hex)
  return 0.299 * r + 0.587 * g + 0.114 * b < 128
}

/**
 * Greys stay grey. With a preset of one accent, build-frame (upstream)
 * takes one of its greys for the second accent and paints it with the
 * brand's second colour: the muted text of a white Cloudflare look came out
 * mint. A preset's neutral colour that came back coloured gets the preset's
 * own grey again, mirrored when the brand's ground is dark and the preset's
 * light.
 */
export const keepGreys = (frame: string, preset: string) => {
  const before = colorsOf(preset)
  const after = colorsOf(frame)
  const ground = [...before.keys()].find((key) => GROUND_KEY.test(key))
  const flipped =
    ground !== undefined &&
    after.has(ground) &&
    isDark(before.get(ground)!) !== isDark(after.get(ground)!)
  const greys = new Map<string, string>()
  for (const [key, hex] of before)
    if (chroma(hex) < 16 && after.has(key) && chroma(after.get(key)!) >= 16)
      greys.set(
        key,
        flipped
          ? `#${channels(hex)
              .map((value) => (255 - value).toString(16).padStart(2, '0'))
              .join('')}`
          : hex
      )
  if (!greys.size) return frame
  let inside = false
  return frame
    .split('\n')
    .map((line) => {
      if (/^colors:\s*$/.test(line)) inside = true
      else if (inside && /^\S/.test(line)) inside = false
      else if (inside) {
        const match = COLOR_LINE.exec(line)
        if (match && greys.has(match[2]))
          return `${match[1]}${match[2]}: "${greys.get(match[2])}"${match[4]}`
      }
      return line
    })
    .join('\n')
}

// The studio's own Inter, one variable file for every weight.
const INTER = fileURLToPath(
  new URL('../../app/assets/inter.woff2', import.meta.url)
)
const INTER_WEIGHTS = [400, 500, 600, 700, 800]

const EXTENSIONS: Record<BrandFontFile['format'], string> = {
  woff2: 'woff2',
  woff: 'woff',
  truetype: 'ttf',
  opentype: 'otf'
}

/** A face's staged names: build-frame reads the family, the weight and the
 * style back out of them, one name per weight a variable file covers. */
export const stagedNames = (file: BrandFontFile) => {
  const stem = file.family.replace(/[^A-Za-z0-9]/g, '')
  const weights = Array.isArray(file.weight)
    ? INTER_WEIGHTS.filter(
        (weight) =>
          weight >= (file.weight as number[])[0] &&
          weight <= (file.weight as number[])[1]
      )
    : [file.weight]
  return weights.map(
    (weight) =>
      `${stem}-${weight}${file.style === 'italic' ? '-Italic' : ''}.${EXTENSIONS[file.format]}`
  )
}

/** The look's font as files the episode carries: build-frame stages what is
 * under capture/assets/fonts and writes its @font-face into frame.md, which
 * every frame and the captions use. A site's open faces travel as the look
 * read them; the studio's own Inter otherwise. Fonts a computer has
 * (Georgia, the system faces) need no file. */
export const stageBrandFonts = async (dir: string, branding?: Branding) => {
  const families = [
    branding?.fonts?.display,
    branding?.fonts?.body,
    branding?.fonts?.mono
  ]
  const fonts = join(dir, 'capture', 'assets', 'fonts')
  const files = (branding?.fontFiles || []).filter((file) =>
    families.includes(file.family)
  )
  if (files.length) await mkdir(fonts, { recursive: true })
  for (const file of files) {
    let bytes: Buffer
    try {
      bytes = await readAsset(file.objectKey)
    } catch {
      continue
    }
    for (const name of stagedNames(file))
      await writeFile(join(fonts, name), bytes)
  }
  // The studio's Inter, for a look that names it or names only system
  // faces (tokensFor sets those in Inter).
  const named = families
    .map(family)
    .filter((name) => name && !GENERIC.test(name))
  if (
    (named.length && !named.includes('Inter')) ||
    files.some((file) => file.family === 'Inter')
  )
    return
  await stageInter(dir)
}

/** The studio's Inter under capture/assets/fonts, a file per weight, as
 * build-frame and the captions read them; the names of its files. */
export const stageInter = async (dir: string) => {
  if (!existsSync(INTER)) return []
  const fonts = join(dir, 'capture', 'assets', 'fonts')
  await mkdir(fonts, { recursive: true })
  const names = INTER_WEIGHTS.map((weight) => `Inter-${weight}.woff2`)
  for (const name of names)
    if (!existsSync(join(fonts, name))) await copyFile(INTER, join(fonts, name))
  return names
}

export const createWorkspace = async (input: {
  projectId: string
  productionId: string
  title: string
  source: string
  branding?: Branding
}) => {
  const dir = productionDir(input.projectId, input.productionId)
  if (existsSync(join(dir, 'frame.md'))) return dir
  await mkdir(dirname(dir), { recursive: true })
  if (!existsSync(join(dir, 'hyperframes.json'))) {
    await rm(dir, { recursive: true, force: true })
    const made = await runCli(
      ['init', input.productionId, '--non-interactive', '--example=blank'],
      dirname(dir),
      120_000
    )
    if (made.code !== 0 || !existsSync(join(dir, 'hyperframes.json')))
      throw new Error(
        `Hyperframes could not start the project: ${cliTail(made)}`
      )
  }
  await mkdir(join(dir, 'capture', 'extracted'), { recursive: true })
  await writeFile(
    join(dir, 'capture', 'extracted', 'visible-text.txt'),
    input.source
  )
  const tokens = tokensFor(
    input.title,
    input.source.slice(0, 280),
    input.branding
  )
  await writeFile(
    join(dir, 'capture', 'extracted', 'tokens.json'),
    JSON.stringify(tokens, null, 2)
  )
  await stageBrandFonts(dir, input.branding)
  const preset = presetFor(input.branding)
  if (!PRESET_NAME.test(preset)) throw new Error('Unknown frame preset')
  await runScript(
    'build-frame',
    ['--preset', preset, '--hyperframes', dir],
    dir
  )
  const made = await readFile(join(dir, 'frame.md'), 'utf8')
  const presetFrame = await readFile(
    join(presetDir(), preset, 'FRAME.md'),
    'utf8'
  )
  const kept = keepFaceNames(
    keepGreys(made, presetFrame),
    presetFrame,
    tokens.fonts.map((font) => font.family)
  )
  if (kept !== made) await writeFile(join(dir, 'frame.md'), kept)
  return dir
}

/** A preset's faces by role, as build-frame reads them from its
 * typography block (its own order of keys). */
const presetFaces = (preset: string) => {
  const roles: Record<string, string> = {}
  let inside = false
  for (const line of preset.split(/\r?\n/)) {
    if (/^typography:\s*$/.test(line)) inside = true
    else if (inside && /^\S/.test(line)) break
    else if (inside) {
      const match = /^\s+([\w-]+):\s*\{[^}]*fontFamily:\s*"([^"]+)"/.exec(line)
      if (match) roles[match[1]] = match[2]
    }
  }
  const pick = (...keys: string[]) =>
    keys.map((key) => roles[key]).find(Boolean)
  const body = pick('body', 'subtitle') ?? Object.values(roles)[0]
  const display =
    pick(
      'display',
      'headline',
      'card-headline',
      'section-headline',
      'quote-display',
      'h1',
      'h2',
      'title',
      'hero'
    ) ?? body
  const mono = pick(
    'mono',
    'mono-tag',
    'mono-chrome',
    'mono-tick',
    'code',
    'data',
    'pagenum'
  )
  return { display, body, mono }
}

const wholeName = (name: string) =>
  new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')

/**
 * Face names as build-frame meant them. It swaps the preset's display face,
 * then its body face, each by whole name across frame.md, and both to the
 * brand's text face: a text face holding the preset body's name ("Inter
 * Tight" over "Inter") comes out doubled ("Inter Tight Tight") everywhere
 * the first swap put it, so headings fall back to another font. Its swaps
 * are replayed on the preset's own names to find what they garbled.
 */
export const keepFaceNames = (
  frame: string,
  preset: string,
  names: string[]
) => {
  const { text, code } = buildFaces(names)
  if (!text) return frame
  const faces = presetFaces(preset)
  const swaps: [string | undefined, string][] = [[faces.display, text]]
  if (faces.body !== faces.display) swaps.push([faces.body, text])
  if (code && faces.mono !== faces.body && faces.mono !== faces.display)
    swaps.push([faces.mono, code])
  const replay = (name: string) =>
    swaps.reduce(
      (value, [from, to]) =>
        from && from !== to ? value.replace(wholeName(from), to) : value,
      name
    )
  let kept = frame
  for (const [from, to] of swaps) {
    const garbled = from ? replay(from) : to
    if (garbled !== to) kept = kept.split(garbled).join(to)
  }
  return kept
}

/** The brand's logo, put into the project as it was given (SVG, PNG or
 * JPEG, by its bytes); null when the brand has none. */
export const stageLogo = async (dir: string, logo: Buffer | null) => {
  if (!logo) return null
  const head = logo.subarray(0, 512).toString('utf8').trimStart()
  const extension = /^(<\?xml|<svg)/i.test(head)
    ? 'svg'
    : logo[0] === 0x89 && logo[1] === 0x50
      ? 'png'
      : logo[0] === 0xff && logo[1] === 0xd8
        ? 'jpg'
        : null
  if (!extension) return null
  await mkdir(join(dir, 'assets', 'brand'), { recursive: true })
  const path = `assets/brand/logo.${extension}`
  await writeFile(join(dir, path), logo)
  return path
}

/** The design truth the frames are built from. */
export const readFrameDesign = (dir: string) =>
  readFile(join(dir, 'frame.md'), 'utf8')
