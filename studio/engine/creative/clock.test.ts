import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterAll, expect, it } from 'vitest'
import type { Scene } from '../../shared/model'
const root = await mkdtemp(join(tmpdir(), 'studio-clock-check-'))
process.env.MINIMAL_STUDIO_DATA_DIR = join(root, 'store')
const { storeAsset, readAsset, listRows } = await import('../persistence')
const { runCommand, probeSeconds } = await import('../voice')
const { prepareCreativeClock } = await import('./clock')
afterAll(() => rm(root, { recursive: true, force: true }))
it('joins measured sound and aligns camera clips without extending camera into off-camera time', async () => {
  const sound = join(root, 'sound.wav'),
    picture = join(root, 'picture.mp4')
  await runCommand('ffmpeg', [
    '-y',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440:duration=1',
    '-c:a',
    'pcm_s16le',
    sound
  ])
  await runCommand('ffmpeg', [
    '-y',
    '-f',
    'lavfi',
    '-i',
    'color=c=blue:s=160x90:r=30:d=1',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    picture
  ])
  const audio = (
    await storeAsset({
      body: await readFile(sound),
      contentType: 'audio/wav',
      extension: '.wav',
      projectId: 'clock',
      kind: 'fixture'
    })
  ).objectKey
  const video = (
    await storeAsset({
      body: await readFile(picture),
      contentType: 'video/mp4',
      extension: '.mp4',
      projectId: 'clock',
      kind: 'fixture'
    })
  ).objectKey
  const scene = {
    id: 'scene',
    inputKey: 'revision',
    moments: [0, 1].map((index) => ({
      id: `m${index}`,
      lines: 'Synthetic test tone.',
      start: index,
      end: index + 1,
      camera: index ? 'start' : 'none',
      layout: 'corner',
      overlay: null,
      recordingKey: 'fixture',
      take: null,
      audioKey: `a${index}`,
      audio: { inputKey: `a${index}`, objectKey: audio, duration: 1 },
      media: {
        inputKey: `a${index}`,
        clips: index
          ? [
              {
                start: 0,
                end: 0.5,
                camera: true,
                videoKey: video,
                videoFrom: 0
              },
              { start: 0.5, end: 1, camera: false }
            ]
          : [{ start: 0, end: 1, camera: false }]
      }
    }))
  } as Scene
  const prepared = await prepareCreativeClock('clock', scene)
  expect(prepared.clock.moments).toEqual([
    { id: 'm0', start: 0, end: 1 },
    { id: 'm1', start: 1, end: 2 }
  ])
  expect(prepared.clock.kind).toBe('take')
  const joined = join(root, 'joined.wav'),
    camera = join(root, 'camera.mp4')
  await writeFile(joined, await readAsset(prepared.audioKey))
  await writeFile(camera, await readAsset(prepared.videoKey!))
  expect(await probeSeconds(joined)).toBeCloseTo(2, 2)
  expect(await probeSeconds(camera)).toBeCloseTo(2, 1)
  const pixel = async (at: number) => {
    const path = join(root, `pixel-${at}.rgb`)
    await runCommand('ffmpeg', [
      '-y',
      '-ss',
      String(at),
      '-i',
      camera,
      '-frames:v',
      '1',
      '-vf',
      'scale=1:1',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgb24',
      path
    ])
    return [...(await readFile(path))]
  }
  const before = await pixel(0.3),
    during = await pixel(1.2),
    after = await pixel(1.7)
  expect(Math.max(...before)).toBeLessThan(10)
  expect(during[2]).toBeGreaterThan(150)
  expect(Math.max(...after)).toBeLessThan(10)
  const assets = await listRows('assets')
  expect(await prepareCreativeClock('clock', scene)).toEqual(prepared)
  expect(await listRows('assets')).toEqual(assets)
})
