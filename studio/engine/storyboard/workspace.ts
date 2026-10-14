// One Hyperframes project per episode, on disk: created by the pinned CLI,
// given the episode's source and the notebook's look, and its frame.md made
// by the workflow's own build-frame script from the preset nearest the look.
// The look carries the brand (palette, fonts) into every episode the same way.
import { existsSync } from 'node:fs'
import { copyFile, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Branding } from '../../shared/settings'
import { dataRoot } from '../persistence'
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
  const fonts = [branding?.fonts?.display, branding?.fonts?.body]
    .map(family)
    .filter(
      (name, index, all) =>
        name && !GENERIC.test(name) && all.indexOf(name) === index
    )
    .map((name) => ({ family: name }))
  return { title, description, colors, colorStats, fonts }
}

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

/** The look's font as files the episode carries: build-frame stages what is
 * under capture/assets/fonts and writes its @font-face into frame.md, which
 * every frame and the captions use. Fonts a computer has (Georgia, the
 * system faces) need no file. */
const stageBrandFonts = async (dir: string, branding?: Branding) => {
  const families = [branding?.fonts?.display, branding?.fonts?.body]
  if (!families.includes('Inter') || !existsSync(INTER)) return
  const fonts = join(dir, 'capture', 'assets', 'fonts')
  await mkdir(fonts, { recursive: true })
  for (const weight of INTER_WEIGHTS)
    await copyFile(INTER, join(fonts, `Inter-${weight}.woff2`))
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
  await writeFile(
    join(dir, 'capture', 'extracted', 'tokens.json'),
    JSON.stringify(
      tokensFor(input.title, input.source.slice(0, 280), input.branding),
      null,
      2
    )
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
  const kept = keepGreys(
    made,
    await readFile(join(presetDir(), preset, 'FRAME.md'), 'utf8')
  )
  if (kept !== made) await writeFile(join(dir, 'frame.md'), kept)
  return dir
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
