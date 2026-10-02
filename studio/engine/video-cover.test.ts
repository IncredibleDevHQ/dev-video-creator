import { it, expect } from 'vitest'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { videoCover } from '../render/video-cover'
import { runCommand } from './voice'
it('extracts a real later frame instead of the blank opening and preserves the video aspect ratio', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'studio-cover-check-'))
  try {
    const source = join(dir, 'scene.mp4'),
      cover = join(dir, 'cover.jpg'),
      pixel = join(dir, 'pixel.rgb')
    await runCommand('ffmpeg', [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'color=black:s=320x180:r=30:d=1',
      '-f',
      'lavfi',
      '-i',
      'color=red:s=320x180:r=30:d=1',
      '-filter_complex',
      '[0:v][1:v]concat=n=2:v=1:a=0[v]',
      '-map',
      '[v]',
      '-c:v',
      'libx264',
      source
    ])
    await writeFile(cover, await videoCover(await readFile(source), 1.5))
    const bytes = await readFile(cover)
    expect([...bytes.subarray(0, 2)]).toEqual([255, 216])
    await runCommand('ffmpeg', [
      '-y',
      '-i',
      cover,
      '-frames:v',
      '1',
      '-vf',
      'crop=2:2:480:270,scale=1:1',
      '-pix_fmt',
      'rgb24',
      '-f',
      'rawvideo',
      pixel
    ])
    const [red, green, blue] = await readFile(pixel)
    expect(red).toBeGreaterThan(220)
    expect(green).toBeLessThan(30)
    expect(blue).toBeLessThan(30)
    const dimensions = await runCommand('ffprobe', [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height',
      '-of',
      'csv=p=0',
      cover
    ])
    expect(dimensions.trim()).toBe('960,540')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}, 15000)
