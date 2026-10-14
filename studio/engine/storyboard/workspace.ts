// One Hyperframes project per episode, on disk: created by the pinned CLI,
// given the episode's source and the notebook's look, and its frame.md made
// by the workflow's own build-frame script from the preset nearest the look.
// The look carries the brand (palette, fonts) into every episode the same way.
import { existsSync } from 'node:fs'
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Branding } from '../../shared/settings'
import { dataRoot } from '../persistence'
import { cliTail, runCli, runScript } from './hyperframes'

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
  const preset = presetFor(input.branding)
  if (!PRESET_NAME.test(preset)) throw new Error('Unknown frame preset')
  await runScript(
    'build-frame',
    ['--preset', preset, '--hyperframes', dir],
    dir
  )
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
