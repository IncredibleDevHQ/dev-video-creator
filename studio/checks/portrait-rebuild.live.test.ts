import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import type { Project } from '../shared/model'
import { teaserFrames } from '../shared/teaser-shape'
import { tryFrame } from '../engine/storyboard/check'
import { createWorkspace } from '../engine/storyboard/workspace'
import { storeAsset } from '../engine/persistence'
import { prepareShape, renderShape } from '../engine/teaser-portrait-run'
import { cutFromShape } from '../engine/teaser-portrait'

// Review 8, round 1: a teaser's frames drawn again for 9:16. The machinery
// alone, no model: the pinned CLI makes the project, Hyperframes checks a
// frame on the 1080×1920 canvas and renders the shape's frames, and the
// teaser is cut from that render with the episode's sound and the teaser's
// captions; then measured. The frames are stubs written here, standing in
// for the frame agent's, the same words in both shapes: not a model's.

const LINES = ['Order once', 'Pay once', 'Two lattes arrive', 'No second tap']
const style = (id: string, width: number, height: number, css: string) =>
  `<style>#${id}-root { position: relative; width: ${width}px; height: ${height}px; overflow: hidden; font-family: "Inter", sans-serif; background: #15181d; color: #eef1f4; } ${css}</style>`
/** The frame as the episode shows it: a headline over a list, side by side
 * with a figure, filling a 16:9 picture. */
const landscape = (id: string, duration: number) => `<template>
  <div id="${id}-root" data-composition-id="${id}" data-width="1920" data-height="1080" data-duration="${duration}">
    ${style(id, 1920, 1080, `.${id}-title { position: absolute; left: 120px; top: 110px; font-size: 104px; font-weight: 700; } .${id}-list { position: absolute; left: 120px; top: 330px; font-size: 56px; line-height: 1.5; } .${id}-figure { position: absolute; right: 160px; top: 330px; font-size: 300px; font-weight: 700; }`)}
    <div id="${id}-title" class="clip ${id}-title" data-start="0" data-duration="${duration}" data-track-index="1">One click, two lattes</div>
    <div id="${id}-list" class="clip ${id}-list" data-start="0" data-duration="${duration}" data-track-index="2">${LINES.map((line) => `<div>${line}</div>`).join('')}</div>
    <div id="${id}-figure" class="clip ${id}-figure" data-start="0" data-duration="${duration}" data-track-index="3">2×</div>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      tl.fromTo("#${id}-figure", { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.1);
      window.__timelines["${id}"] = tl;
    </script>
  </div>
</template>`
/** The same frame drawn again for a phone: stacked, type phone-sized,
 * the caption band clear. */
const portrait = (id: string, duration: number) => `<template>
  <div id="${id}-root" data-composition-id="${id}" data-width="1080" data-height="1920" data-duration="${duration}">
    ${style(id, 1080, 1920, `.${id}-title { position: absolute; left: 80px; right: 80px; top: 200px; font-size: 116px; line-height: 1.1; font-weight: 700; } .${id}-list { position: absolute; left: 80px; top: 560px; font-size: 64px; line-height: 1.6; } .${id}-figure { position: absolute; left: 80px; top: 1080px; font-size: 360px; font-weight: 700; }`)}
    <div id="${id}-title" class="clip ${id}-title" data-start="0" data-duration="${duration}" data-track-index="1">One click, two lattes</div>
    <div id="${id}-list" class="clip ${id}-list" data-start="0" data-duration="${duration}" data-track-index="2">${LINES.map((line) => `<div>${line}</div>`).join('')}</div>
    <div id="${id}-figure" class="clip ${id}-figure" data-start="0" data-duration="${duration}" data-track-index="3">2×</div>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      tl.fromTo("#${id}-figure", { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.1);
      window.__timelines["${id}"] = tl;
    </script>
  </div>
</template>`

/** A picture's luma, row by row. */
const luma = (file: string, width: number, height: number, at?: number) => {
  const bytes = execFileSync(
    'ffmpeg',
    [
      '-v',
      'error',
      ...(at === undefined ? [] : ['-ss', String(at)]),
      '-i',
      file,
      '-frames:v',
      '1',
      '-vf',
      `scale=${width}:${height}`,
      '-f',
      'rawvideo',
      '-pix_fmt',
      'gray',
      'pipe:1'
    ],
    { maxBuffer: 1 << 25 }
  )
  const row = (y: number) => bytes.subarray(y * width, (y + 1) * width)
  const lit = (y: number) => row(y).some((value) => value > 150)
  return {
    /** The height of the first run of rows with light text in them: the
     * headline's first line. */
    headline: () => {
      let y = 0
      while (y < height && !lit(y)) y++
      const top = y
      while (y < height && lit(y)) y++
      return y - top
    },
    /** The share of the picture with a sharp edge in its row, above `below`. */
    sharp: (below: number) =>
      Array.from({ length: below }, (_, y) => row(y)).filter((line) => {
        let edges = 0
        for (let x = 1; x < line.length; x++)
          if (Math.abs(line[x] - line[x - 1]) > 40) edges++
        return edges >= 2
      }).length / height,
    litIn: (from: number, to: number) =>
      Array.from({ length: to - from }, (_, index) => from + index).some(lit)
  }
}

it('checks and renders a teaser’s frames on a 1080×1920 canvas and cuts the teaser from them, its text phone-sized', async () => {
  const dir = await createWorkspace({
    projectId: 'portrait-live',
    productionId: 'sb',
    title: 'One click, two lattes',
    source: 'Order once, pay once: two lattes arrive.'
  })
  const ids = ['f01-one-click', 'f02-two-lattes']
  // The episode's frame, checked on its own canvas: its snapshot is 16:9.
  const wide = await tryFrame({
    dir,
    frameId: ids[0],
    html: landscape(ids[0], 3),
    duration: 3,
    at: [2]
  })
  expect(wide.problems).toEqual([])
  // The same frame drawn for the teaser, checked on the teaser's canvas.
  const canvas = { width: 1080, height: 1920 }
  const shape = await prepareShape(dir, canvas)
  const tall = await tryFrame({
    dir: shape,
    frameId: ids[0],
    html: portrait(ids[0], 3),
    duration: 3,
    at: [2],
    format: '1080x1920'
  })
  expect(tall.problems).toEqual([])
  expect(
    execFileSync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'stream=width,height',
      '-of',
      'csv=p=0',
      tall.snapshots[0]
    ])
      .toString()
      .trim()
  ).toBe('1080,1920')
  // The shape's frames rendered, one after another.
  await mkdir(join(shape, 'compositions', 'frames'), { recursive: true })
  for (const id of ids)
    await writeFile(
      join(shape, 'compositions', 'frames', `${id}.html`),
      portrait(id, 3)
    )
  const render = await renderShape(
    shape,
    canvas,
    ids.map((frameId) => ({ frameId, duration: 3 }))
  )
  expect(
    execFileSync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'stream=width,height:format=duration',
      '-of',
      'csv=p=0',
      render
    ])
      .toString()
      .trim()
      .split('\n')
  ).toEqual(['1080,1920', expect.stringMatching(/^6\.\d+/)])
  // The episode: its sound, and the captions it spoke.
  const episode = join(dir, '.studio', 'episode.mp4')
  await mkdir(join(dir, '.studio'), { recursive: true })
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    'color=c=black:s=320x180:r=30:d=6',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440:duration=6',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-shortest',
    episode
  ])
  const video = await storeAsset({
    body: await readFile(episode),
    contentType: 'video/mp4',
    extension: '.mp4',
    kind: 'produced-video',
    projectId: 'portrait-live'
  })
  await writeFile(
    join(dir, 'caption_groups.json'),
    JSON.stringify({
      groups: [
        { start: 0.2, end: 2.6, text: 'One click.' },
        { start: 3.2, end: 5.6, text: 'Two lattes.' }
      ]
    })
  )
  const project = {
    id: 'portrait-live',
    title: 'One click, two lattes',
    source: '',
    slides: [],
    video: {
      settings: { presence: 'off', voice: { kind: 'record' } },
      scenes: [],
      transitions: [],
      inputKey: '',
      produced: { inputKey: 'sb', objectKey: video.objectKey },
      storyboard: {
        id: 'sb',
        pages: ['p'],
        stage: 'done',
        status: 'done',
        updatedAt: '',
        plan: {
          message: '',
          audience: '',
          structure: '',
          hook: '',
          scenes: [
            {
              pageId: 'p',
              build: 'faceless',
              buildReason: '',
              frames: [
                {
                  number: 1,
                  title: 'One click',
                  type: 'hook',
                  duration: 3,
                  voiceover: '',
                  transition: 'cut'
                },
                {
                  number: 2,
                  title: 'Two lattes',
                  type: 'explain',
                  duration: 3,
                  voiceover: '',
                  transition: 'cut'
                }
              ]
            }
          ]
        }
      }
    },
    release: { teasers: [], campaign: [] }
  } as unknown as Project
  const segments = [{ from: 0, to: 6 }]
  const { frames, pieces } = teaserFrames(project, segments)
  const bytes = await cutFromShape({
    project,
    teaser: { aspect: '9:16', segments },
    render,
    frames,
    pieces
  })
  const cut = join(dir, '.studio', 'teaser.mp4')
  await writeFile(cut, bytes)
  const probe = JSON.parse(
    execFileSync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'stream=codec_type,width,height:format=duration',
      '-of',
      'json',
      cut
    ]).toString()
  )
  expect(
    probe.streams.map((item: { codec_type: string }) => item.codec_type)
  ).toEqual(['video', 'audio'])
  expect(probe.streams[0]).toMatchObject({ width: 1080, height: 1920 })
  expect(Math.abs(Number(probe.format.duration) - 6)).toBeLessThan(0.15)
  // Measured: the headline against the episode's own, and how much of the
  // picture above the caption band holds sharp detail. The 16:9 frame
  // fitted to 9:16 would show its text at 0.56 and its detail over a third
  // of the rows it had; drawn again, the text is as large as the episode's
  // and the detail fills over three times as much of the picture.
  const episodeLook = luma(wide.snapshots[0], 1920, 1080)
  const teaserLook = luma(cut, 1080, 1920, 1.5)
  expect(teaserLook.headline() / episodeLook.headline()).toBeGreaterThan(0.9)
  const fitted = episodeLook.sharp(900) * (1080 / 1920) * (1080 / 1920)
  expect(fitted).toBeLessThan(0.15)
  expect(teaserLook.sharp(1600)).toBeGreaterThan(0.3)
  expect(teaserLook.sharp(1600)).toBeGreaterThan(fitted * 2.5)
  // The teaser's caption in the band below, while it is spoken; none in
  // the gap between the two.
  expect(teaserLook.litIn(1600, 1920)).toBe(true)
  expect(luma(cut, 1080, 1920, 2.9).litIn(1600, 1920)).toBe(false)
}, 900_000)
