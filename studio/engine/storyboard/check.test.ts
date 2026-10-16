import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { runCommand } from '../voice'
import { oneSheet, stoppedByCheck } from './check'

it('joins a contact sheet written in pages into one picture', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'storyboard-sheet-'))
  try {
    for (const [name, height] of [
      ['contact-sheet-1.jpg', 120],
      ['contact-sheet-2.jpg', 40]
    ] as const)
      await runCommand(
        'ffmpeg',
        [
          '-y',
          '-f',
          'lavfi',
          '-i',
          `color=c=gray:s=200x${height}`,
          '-frames:v',
          '1',
          join(dir, name)
        ],
        30_000
      )
    const sheet = await oneSheet(dir, await readdir(dir))
    expect(sheet).toBe(join(dir, 'contact-sheet.jpg'))
    const size = await runCommand(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_entries',
        'stream=width,height',
        '-of',
        'csv=p=0',
        sheet!
      ],
      30_000
    )
    expect(size.trim()).toBe('200,160')
    expect(await oneSheet(dir, [])).toBeNull()
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

it('says why the finished check stopped in the creator’s words, the findings after', () => {
  const font =
    'font_family_without_font_face: Font family used without @font-face declaration: space grotesk.'
  const [line, details] = stoppedByCheck([font, 'mystery_code: odd']).split(
    '\n'
  )
  expect(line).toBe(
    'The finished check still finds a font the video can’t load and a problem in a frame.'
  )
  expect(details).toContain('space grotesk')
})
