// Hyperframes' own checks, run by the studio: `check` (lint, runtime,
// layout, motion and contrast in one browser session) and `snapshot`. A
// frame is tried alone in a one-frame project, so its worker hears about its
// own frame and sees it; the episode is checked whole after assembly.
import { existsSync } from 'node:fs'
import { cp, mkdir, rm, symlink, writeFile, readdir } from 'node:fs/promises'
import { basename, join, relative } from 'node:path'
import { cliJson, cliTail, runCli, runScript } from './hyperframes'
import { runCommand } from '../voice'
import { frameFill } from './fill'

export type Finding = {
  code: string
  severity: 'error' | 'warning' | 'info'
  message: string
  fixHint?: string
  sourceFile?: string
  time?: number
  selector?: string
}
type Section = { ok?: boolean; findings?: Finding[] }
type CheckJson = Record<string, unknown> & {
  ok?: boolean
  browserSkipped?: boolean
}

const SECTIONS = ['lint', 'runtime', 'layout', 'motion', 'contrast'] as const

/** One line a worker can act on. */
export const findingLine = (finding: Finding) =>
  [
    `${finding.code}${typeof finding.time === 'number' && finding.time > 0 ? ` at ${finding.time.toFixed(2)} s` : ''}: ${finding.message}`,
    finding.selector && finding.selector !== '[data-composition-id]'
      ? ` (${finding.selector})`
      : '',
    finding.fixHint ? ` Fix: ${finding.fixHint}` : ''
  ].join('')

// What a check finding means, in the creator's words.
const PLAIN: Array<[RegExp, string]> = [
  [/^font_family_without_font_face|font/i, 'a font the video can’t load'],
  [/contrast/i, 'text too faint to read'],
  [
    /overflow|clip|off.?canvas|out.?of.?(frame|bounds)/i,
    'something running off its frame'
  ],
  [/runtime|script|exception|console/i, 'a frame that fails as it plays']
]

/** The check's findings said plainly in one line, the findings themselves
 * on the next: the page shows the line, the rest behind Details (the Jev
 * series run showed the raw finding as the reason). */
export const stoppedByCheck = (lines: string[]) => {
  const said = [
    ...new Set(
      lines.map(
        (line) =>
          PLAIN.find(([pattern]) => pattern.test(line))?.[1] ||
          'a problem in a frame'
      )
    )
  ]
  return `The finished check still finds ${said.slice(0, 2).join(' and ')}.\n${lines.slice(0, 3).join(' · ')}`
}

/** The frame a finding belongs to, from its source file. */
export const frameOfFinding = (finding: Finding) => {
  const match = /compositions\/frames\/([a-zA-Z0-9_-]+)\.html/.exec(
    finding.sourceFile || ''
  )
  return match ? match[1] : null
}

/** `hyperframes check` on a project: its errors and warnings. */
export const checkProject = async (
  dir: string,
  options: { samples?: number; at?: number[]; captions?: boolean } = {}
) => {
  const result = await runCli(
    [
      'check',
      '--json',
      ...(options.at?.length
        ? [`--at=${options.at.map((value) => value.toFixed(2)).join(',')}`]
        : [`--samples=${options.samples ?? 9}`]),
      ...(options.captions
        ? ['--caption-zone=x0=0;y0=.83;x1=1;y1=1;severity=warning']
        : []),
      '.'
    ],
    dir,
    10 * 60_000
  )
  const json = cliJson<CheckJson>(result)
  if (!json)
    throw new Error(`hyperframes check gave no answer: ${cliTail(result)}`)
  const findings = SECTIONS.flatMap(
    (name) => (json[name] as Section | undefined)?.findings || []
  )
  return {
    ok: json.ok === true,
    errors: findings.filter((finding) => finding.severity === 'error'),
    warnings: findings.filter((finding) => finding.severity === 'warning'),
    browserSkipped: json.browserSkipped === true
  }
}

/** PNG snapshots of a project at the given seconds, and its contact sheet. */
export const snapshotProject = async (
  dir: string,
  at: number[],
  outDir: string
) => {
  await rm(outDir, { recursive: true, force: true })
  const result = await runCli(
    [
      'snapshot',
      `--at=${at.map((value) => value.toFixed(2)).join(',')}`,
      '--no-end',
      '-o',
      outDir,
      '.'
    ],
    dir,
    5 * 60_000
  )
  if (result.code !== 0)
    throw new Error(`hyperframes snapshot failed: ${cliTail(result)}`)
  const files = existsSync(outDir) ? await readdir(outDir) : []
  return {
    frames: files
      .filter((name) => /^frame-.*\.png$/.test(name))
      .sort()
      .map((name) => join(outDir, name)),
    sheet: await oneSheet(outDir, files)
  }
}

/** The contact sheet as one picture: past nine frames Hyperframes writes it
 * in pages (contact-sheet-1.jpg, -2.jpg …), joined here one under another. */
export const oneSheet = async (outDir: string, files: string[]) => {
  const sheet = join(outDir, 'contact-sheet.jpg')
  if (files.includes('contact-sheet.jpg')) return sheet
  const pages = files
    .filter((name) => /^contact-sheet-\d+\.jpg$/.test(name))
    .sort((a, b) => parseInt(a.slice(14)) - parseInt(b.slice(14)))
  if (!pages.length) return null
  if (pages.length === 1) return join(outDir, pages[0])
  await runCommand(
    'ffmpeg',
    [
      '-y',
      ...pages.flatMap((name) => ['-i', join(outDir, name)]),
      '-filter_complex',
      `${pages.map((_, index) => `[${index}:v]`).join('')}vstack=inputs=${pages.length}`,
      '-q:v',
      '3',
      sheet
    ],
    60_000
  )
  return existsSync(sheet) ? sheet : join(outDir, pages[0])
}

/** When to look at a frame: as it settles in, in the middle, at its end. */
export const lookTimes = (duration: number) => [
  ...new Set(
    [
      Math.min(0.8, duration * 0.25),
      duration * 0.55,
      Math.max(0, duration - 0.25)
    ].map((value) => Math.round(value * 100) / 100)
  )
]

/**
 * Tries one frame alone: a one-frame copy of the project (its design, fonts
 * and the frame's media), assembled by the workflow's script, then checked
 * and looked at. Nothing in the episode's own project changes.
 */
export const tryFrame = async (input: {
  dir: string
  frameId: string
  html: string
  duration: number
  media?: string
  /** When to check and look, in seconds; a still is looked at once. */
  at?: number[]
  /** The canvas, when not the episode's 16:9 (a teaser drawn for its
   * shape). */
  format?: string
}) => {
  const trial = join(input.dir, '.studio', 'trial', input.frameId)
  await rm(trial, { recursive: true, force: true })
  await mkdir(join(trial, 'compositions', 'frames'), { recursive: true })
  for (const name of ['hyperframes.json', 'meta.json', 'frame.md'])
    if (existsSync(join(input.dir, name)))
      await cp(join(input.dir, name), join(trial, name))
  if (existsSync(join(input.dir, 'assets')))
    await symlink(join(input.dir, 'assets'), join(trial, 'assets'), 'dir')
  const src = `compositions/frames/${input.frameId}.html`
  await writeFile(join(trial, src), input.html)
  await writeFile(
    join(trial, 'STORYBOARD.md'),
    [
      '---',
      `format: ${input.format || '1920x1080'}`,
      '---',
      '',
      `## Frame 1 — ${input.frameId}`,
      '',
      `- duration: ${input.duration}s`,
      '- transition_in: cut',
      '- status: animated',
      `- src: ${src}`,
      ''
    ].join('\n')
  )
  try {
    await runScript(
      'assemble-index',
      ['--storyboard', join(trial, 'STORYBOARD.md'), '--hyperframes', trial],
      trial,
      120_000
    )
  } catch (error) {
    return {
      problems: [
        error instanceof Error
          ? error.message.replace(trial, '.')
          : String(error)
      ],
      warnings: [] as string[],
      fill: [] as string[],
      snapshots: [] as string[]
    }
  }
  const times = input.at?.length ? input.at : lookTimes(input.duration)
  const checked = await checkProject(trial, { at: times, captions: true })
  const shots = checked.errors.length
    ? { frames: [] }
    : await snapshotProject(trial, times, join(trial, 'snapshots'))
  const fill = await frameFill(shots.frames, times)
  return {
    problems: checked.errors.map(findingLine),
    warnings: [
      ...checked.warnings.map(findingLine),
      ...(fill.warning ? [fill.warning] : [])
    ],
    fill: fill.lines,
    snapshots: shots.frames
  }
}

export const relativeTo = (root: string, path: string) =>
  relative(root, path) || basename(path)
