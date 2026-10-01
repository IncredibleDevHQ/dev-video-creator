import { presenterOverlays } from '../render/presenter-overlay'
import type { Project, Scene } from '../shared/model'
import { it, expect } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { composePresenter } from '../render/presenter'
import { runCommand, probeSeconds } from './voice'
import type { Moment } from '../shared/model'
it.each(['beside-slide', 'corner', 'full-screen'] as const)(
  'renders the %s presenter layout and retimes a longer take',
  async (layout) => {
    const dir = await mkdtemp(join(tmpdir(), 'studio-presenter-fixture-'))
    try {
      const base = join(dir, 'base.mp4'),
        camera = join(dir, 'camera.mp4'),
        audio = join(dir, 'audio.wav')
      await runCommand('ffmpeg', [
        '-y',
        '-f',
        'lavfi',
        '-i',
        'color=blue:s=320x180:r=30:d=1',
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
        base
      ])
      await runCommand('ffmpeg', [
        '-y',
        '-f',
        'lavfi',
        '-i',
        'color=lime:s=320x180:r=30:d=3',
        '-c:v',
        'libx264',
        camera
      ])
      await runCommand('ffmpeg', [
        '-y',
        '-f',
        'lavfi',
        '-i',
        'anullsrc=r=48000:cl=stereo',
        '-t',
        '3',
        audio
      ])
      const m = (
        id: string,
        start: number,
        end: number,
        on: boolean
      ): Moment => ({
        id,
        start,
        end,
        camera: on ? 'full' : 'none',
        layout,
        lines: 'Synthetic fixture',
        overlay: null,
        recordingKey: 'fixture',
        audioKey: 'fixture',
        take: null,
        audio: null,
        media: {
          inputKey: 'fixture',
          clips: [{ start: 0, end: end - start, camera: on }]
        }
      })
      const output = join(dir, 'composed.mp4')
      const moments = [m('a', 0, 1, false), m('b', 1, 3, true)]
      if (layout === 'full-screen') moments[1].overlay = 'title-card'
      let logo: Buffer | undefined
      if (layout === 'full-screen') {
        const path = join(dir, 'logo.png')
        await runCommand('ffmpeg', [
          '-y',
          '-f',
          'lavfi',
          '-i',
          'color=cyan:s=160x80',
          '-frames:v',
          '1',
          path
        ])
        logo = await readFile(path)
      }
      const overlays = await presenterOverlays(
        {
          title: 'A visible title',
          branding: {
            name: 'Fixture speaker',
            accent: '#ff00ff',
            useAccent: true
          }
        } as Project,
        { moments } as Scene,
        logo
      )
      await writeFile(
        output,
        await composePresenter({
          overlays,
          animation: await readFile(base),
          animationMoments: [
            { id: 'a', start: 0, end: 1 },
            { id: 'b', start: 1, end: 2 }
          ],
          moments,
          audio: await readFile(audio),
          camera: await readFile(camera)
        })
      )
      expect(await probeSeconds(output)).toBeCloseTo(3, 1)
      const pixel = async (at: number, x: number, y: number) => {
        const path = join(dir, `pixel-${at}-${x}.rgb`)
        await runCommand('ffmpeg', [
          '-y',
          '-ss',
          String(at),
          '-i',
          output,
          '-frames:v',
          '1',
          '-vf',
          `crop=2:2:${x}:${y},scale=1:1`,
          '-pix_fmt',
          'rgb24',
          '-f',
          'rawvideo',
          path
        ])
        return [...(await readFile(path))]
      }
      const first = await pixel(0.5, 960, 540),
        content = await pixel(2, 600, 540),
        speaker = await pixel(2, 1700, 850)
      expect(first[2]).toBeGreaterThan(220)
      expect(speaker[1]).toBeGreaterThan(220)
      expect(speaker[0]).toBeLessThan(30)
      if (layout === 'full-screen') {
        expect(content[1]).toBeGreaterThan(220)
        const logoColor = await pixel(2, 1765, 140),
          accent = await pixel(2, 94, 940)
        expect(logoColor[1]).toBeGreaterThan(220)
        expect(logoColor[2]).toBeGreaterThan(220)
        expect(logoColor[0]).toBeLessThan(30)
        expect(accent[0]).toBeGreaterThan(220)
        expect(accent[2]).toBeGreaterThan(220)
        expect(accent[1]).toBeLessThan(30)
        const titlePixels = join(dir, 'title.rgb')
        await runCommand('ffmpeg', [
          '-y',
          '-ss',
          '2',
          '-i',
          output,
          '-frames:v',
          '1',
          '-vf',
          'crop=900:200:60:40',
          '-pix_fmt',
          'rgb24',
          '-f',
          'rawvideo',
          titlePixels
        ])
        const rgb = await readFile(titlePixels)
        let white = 0
        for (let i = 0; i < rgb.length; i += 3)
          if (rgb[i] > 220 && rgb[i + 1] > 220 && rgb[i + 2] > 220) white++
        expect(white).toBeGreaterThan(1000)
      } else {
        expect(content[0]).toBeGreaterThan(220)
        expect(content[1]).toBeLessThan(30)
      }
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  },
  30000
)

it.each([false, true])(
  'preserves timing across a presenter transition (next camera layout: %s)',
  async (changesLayout) => {
    const dir = await mkdtemp(join(tmpdir(), 'studio-presenter-exit-'))
    try {
      const base = join(dir, 'base.mp4'),
        camera = join(dir, 'camera.mp4'),
        audio = join(dir, 'audio.wav'),
        output = join(dir, 'scene.mp4')
      await runCommand('ffmpeg', [
        '-y',
        '-f',
        'lavfi',
        '-i',
        'color=blue:s=320x180:r=30:d=4',
        '-c:v',
        'libx264',
        base
      ])
      await runCommand('ffmpeg', [
        '-y',
        '-f',
        'lavfi',
        '-i',
        'color=lime:s=320x180:r=30:d=4',
        '-c:v',
        'libx264',
        camera
      ])
      await runCommand('ffmpeg', [
        '-y',
        '-f',
        'lavfi',
        '-i',
        'anullsrc=r=48000:cl=stereo',
        '-t',
        '4',
        audio
      ])
      const moments = [true, false, false, true].map(
        (on, i) =>
          ({
            id: String(i),
            start: i,
            end: i + 1,
            camera: on ? 'full' : 'none',
            layout: 'beside-slide',
            lines: 'Synthetic transition fixture',
            overlay: null,
            recordingKey: 'fixture',
            audioKey: 'fixture',
            take: null,
            audio: null,
            media: {
              inputKey: 'fixture',
              clips: [{ start: 0, end: 1, camera: on }]
            }
          }) as Moment
      )
      if (changesLayout) {
        moments[1].camera = 'full'
        moments[1].layout = 'corner'
        moments[1].media!.clips[0].camera = true
      }
      await writeFile(
        output,
        await composePresenter({
          animation: await readFile(base),
          animationMoments: moments.map(({ id, start, end }) => ({
            id,
            start,
            end
          })),
          moments,
          audio: await readFile(audio),
          camera: await readFile(camera)
        })
      )
      expect(await probeSeconds(output)).toBeCloseTo(4, 1)
      const pixel = async (at: number, x = 1450, y = 500) => {
        const path = join(dir, `${at}-${x}-${y}.rgb`)
        await runCommand('ffmpeg', [
          '-y',
          '-ss',
          String(at),
          '-i',
          output,
          '-frames:v',
          '1',
          '-vf',
          `crop=2:2:${x}:${y},scale=1:1`,
          '-pix_fmt',
          'rgb24',
          '-f',
          'rawvideo',
          path
        ])
        return [...(await readFile(path))]
      }
      const before = await pixel(0.6),
        during = await pixel(0.85),
        after = await pixel(1.5)
      expect(before[1]).toBeGreaterThan(220)
      expect(during[1]).toBeGreaterThan(30)
      expect(during[2]).toBeGreaterThan(30)
      expect(after[2]).toBeGreaterThan(220)
      expect(after[1]).toBeLessThan(30)
      expect((await pixel(3.5))[1]).toBeGreaterThan(220)
      if (changesLayout)
        expect((await pixel(1.5, 1700, 800))[1]).toBeGreaterThan(220)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  },
  30000
)

it('holds the final animation frame during extra spoken dialogue instead of slowing it down', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'studio-extension-render-'))
  try {
    const base = join(dir, 'base.mp4'),
      audio = join(dir, 'audio.wav'),
      output = join(dir, 'result.mp4')
    await runCommand('ffmpeg', [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'color=blue:s=160x90:r=30:d=1',
      '-f',
      'lavfi',
      '-i',
      'color=red:s=160x90:r=30:d=1',
      '-filter_complex',
      '[0:v][1:v]concat=n=2:v=1:a=0[v]',
      '-map',
      '[v]',
      '-c:v',
      'libx264',
      base
    ])
    await runCommand('ffmpeg', [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'anullsrc=r=48000:cl=stereo',
      '-t',
      '4',
      audio
    ])
    const moment: Moment = {
      id: 'm',
      start: 0,
      end: 4,
      lines: 'Base. Extra.',
      plannedSeconds: 4,
      camera: 'full',
      layout: 'beside-slide',
      overlay: null,
      recordingKey: 'k',
      audioKey: 'a',
      take: null,
      audio: null,
      extension: {
        baseLines: 'Base.',
        baseSeconds: 2,
        text: 'Extra.',
        seconds: 2
      },
      segments: [
        { id: 'base', lines: 'Base.', camera: false, estimate: 2 },
        { id: 'extra', lines: 'Extra.', camera: false, estimate: 2 }
      ],
      media: {
        inputKey: 'a',
        clips: [
          { start: 0, end: 2, camera: false },
          { start: 2, end: 4, camera: false }
        ]
      }
    }
    await writeFile(
      output,
      await composePresenter({
        animation: await readFile(base),
        animationMoments: [{ id: 'm', start: 0, end: 2 }],
        moments: [moment],
        audio: await readFile(audio)
      })
    )
    expect(await probeSeconds(output)).toBeCloseTo(4, 1)
    for (const at of [1.5, 2.5, 3.7]) {
      const file = join(dir, `${at}.rgb`)
      await runCommand('ffmpeg', [
        '-y',
        '-ss',
        String(at),
        '-i',
        output,
        '-frames:v',
        '1',
        '-vf',
        'scale=1:1',
        '-pix_fmt',
        'rgb24',
        '-f',
        'rawvideo',
        file
      ])
      const pixel = await readFile(file)
      expect(pixel[0]).toBeGreaterThan(220)
      expect(pixel[2]).toBeLessThan(30)
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}, 30000)
