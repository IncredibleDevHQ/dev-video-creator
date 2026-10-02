import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { it, expect, afterAll } from 'vitest'
const root = await mkdtemp(join(tmpdir(), 'minimal-join-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const { storeAsset } = await import('./persistence')
const { joinScenes } = await import('../render/join')
const { runCommand, probeSeconds } = await import('./voice')
const keys: string[] = []
for (const color of ['red', 'blue']) {
  const path = join(root, `${color}.mp4`)
  await runCommand('ffmpeg', [
    '-y',
    '-f',
    'lavfi',
    '-i',
    `color=c=${color}:s=160x90:r=30`,
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440:sample_rate=48000',
    '-t',
    '1.2',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    path
  ])
  const asset = await storeAsset({
    body: await readFile(path),
    contentType: 'video/mp4',
    kind: 'test-fixture',
    extension: '.mp4'
  })
  keys.push(asset.objectKey)
}
afterAll(() => rm(root, { recursive: true, force: true }))
it.each([
  'none',
  'crossfade',
  'push-left',
  'push-right',
  'push-up',
  'wipe',
  'zoom'
] as const)(
  'joins scenes with %s and preserves sound',
  async (transition) => {
    let clock: Array<{ start: number; duration: number }> = []
    const bytes = await joinScenes(keys, [transition], (value) => {
      clock = value
    })
    const output = join(root, `joined-${transition}.mp4`)
    await writeFile(output, new Uint8Array(bytes))
    const duration = await probeSeconds(output)
    expect(duration).toBeGreaterThan(1.8)
    expect(duration).toBeLessThan(2.7)
    expect(clock).toHaveLength(2)
    expect(clock[0].start).toBe(0)
    expect(clock[1].start + clock[1].duration).toBeCloseTo(duration, 1)
    const streams = await runCommand('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'stream=codec_type',
      '-of',
      'csv=p=0',
      output
    ])
    expect(streams).toContain('video')
    expect(streams).toContain('audio')
  },
  20000
)
