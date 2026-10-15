import { existsSync } from 'node:fs'
import { cp } from 'node:fs/promises'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { createWorkspace } from '../engine/storyboard/workspace'
import { checkEpisodePlan } from '../engine/storyboard/plan-check'
import { blueprintIds } from '../engine/storyboard/plan'
import { prepareEpisodeAudio } from '../engine/storyboard/voice'
import {
  writeFramePackets,
  frameShapeProblems
} from '../engine/storyboard/frames'
import { tryFrame } from '../engine/storyboard/check'
import { writeBoard } from '../engine/storyboard/board'
import { poseMoment, poseProblems } from '../engine/storyboard/stills'
import {
  assembleEpisode,
  checkEpisode,
  episodePoster,
  episodeSheet,
  renderEpisode
} from '../engine/storyboard/assemble'
import {
  episodeFrames,
  writeProjectFiles,
  type Internal
} from '../engine/storyboard/state'
import { runCommand, probeSeconds } from '../engine/voice'

// The machinery alone, no model: the pinned CLI makes the project, the
// workflow's scripts make its design, packets, captions, index and
// transitions, the local voice and the aligner time the words, a camera
// scene's take (a generated test pattern with a spoken track, standing in
// for footage) is cut at its frames, Hyperframes checks a stub still and
// stub frames and renders the episode. The still and the frames are stubs
// written here, not a model's.

const stubFrame = (
  id: string,
  title: string,
  duration: number,
  media?: string,
  still = false
) => `<template>
  <div id="root" data-composition-id="${id}" data-width="1920" data-height="1080" data-duration="${duration}">
    <style>
      #root { position: relative; width: 1920px; height: 1080px; overflow: hidden; font-family: "Inter", sans-serif; }
      .${id}-ground { position: absolute; inset: 0; background: #15181d; }
      .${id}-title { position: absolute; left: 0; right: 0; top: 360px; text-align: center; font-size: 120px; color: #eef1f4; font-weight: 700; }
      .${id}-take { position: absolute; right: 60px; top: 60px; width: 640px; height: 360px; object-fit: cover; }
    </style>
    <div id="${id}-ground" class="clip ${id}-ground" data-start="0" data-duration="${duration}" data-track-index="0"></div>
    ${media ? `<video id="${id}-take" class="clip ${id}-take" src="${media}" muted playsinline data-start="0" data-duration="${duration}" data-track-index="2"></video>` : ''}
    <div id="${id}-title" class="clip ${id}-title" data-start="0" data-duration="${duration}" data-track-index="1">${title}</div>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      ${still ? '' : `tl.fromTo("#${id}-title", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }, 0.2);`}
      window.__timelines["${id}"] = tl;
    </script>
  </div>
</template>`

it('runs the storyboard machinery end to end on stub frames', async () => {
  const productionId = 'sb-machinery'
  const dir = await createWorkspace({
    projectId: 'machinery',
    productionId,
    title: 'Streams',
    source: 'A request has a timer. A stream does not.',
    branding: {
      name: '',
      tagline: '',
      accent: '#5eb0ff',
      useAccent: true,
      palette: { ground: '#15181d', text: '#eef1f4', secondary: '#93a0ae' },
      fonts: { display: 'Inter', body: 'Inter', mono: 'ui-monospace' },
      logoKey: null,
      look: { id: 'ink', name: 'Ink' }
    }
  })
  expect(existsSync(join(dir, 'frame.md'))).toBe(true)
  const pages = [
    {
      id: 'p1',
      title: 'The limit',
      script: 'Your request ended. Your stream did not.',
      capture: false
    },
    {
      id: 'p2',
      title: 'The trip',
      script: 'A frame goes in, changes on the way, and comes back out.',
      capture: false
    }
  ]
  const frame = (over: Record<string, unknown>) => ({
    scene: 'A word',
    persuasion: 'Before/after',
    beat: 'tension',
    narrativeRole: 'Shows it',
    keyMessage: 'It is so',
    duration: 3,
    ...over
  })
  const report = checkEpisodePlan(
    {
      message: 'A request has a timer; a stream does not',
      audience: 'developers',
      structure: 'story-explainer',
      hook: 'Stakes / consequence',
      direction: {
        palette: 'ink',
        motion: 'reveal',
        held: 'none',
        never: 'slideshow'
      },
      scenes: [
        {
          pageId: 'p1',
          build: 'camera',
          buildReason: 'The creator says it',
          frames: [
            frame({
              title: 'Ended',
              voiceover: 'Your request ended.',
              transition: 'cut',
              type: 'hook'
            }),
            frame({
              title: 'Did not',
              voiceover: 'Your stream did not.',
              transition: 'crossfade',
              type: 'pain_point'
            })
          ]
        },
        {
          pageId: 'p2',
          build: 'faceless',
          buildReason: 'A mechanism',
          frames: [
            frame({
              title: 'The trip',
              voiceover:
                'A frame goes in, changes on the way, and comes back out.',
              transition: 'crossfade',
              type: 'feature_showcase',
              duration: 5
            })
          ]
        }
      ]
    },
    { pages, camera: true, blueprints: blueprintIds() }
  )
  expect(report.problems).toEqual([])
  const internal: Internal = {
    plan: report.value,
    length: { min: 5, max: 30, strict: false }
  }
  await writeProjectFiles(dir, internal)
  // A still before anything is voiced: frame 3 posed, nothing moving,
  // checked and looked at once, and the board written for it.
  await writeFramePackets(dir)
  const trip = episodeFrames(report.value)[2]
  const pose = stubFrame(trip.id, trip.title, trip.duration, undefined, true)
  expect(poseProblems(pose, trip.id)).toEqual([])
  const still = await tryFrame({
    dir,
    frameId: trip.id,
    html: pose,
    duration: trip.duration,
    at: [poseMoment(trip.duration)]
  })
  expect(still.problems).toEqual([])
  expect(still.snapshots).toHaveLength(1)
  await writeBoard(dir, internal, { p1: 'The limit', p2: 'The trip' })
  expect(
    (await readFile(join(dir, 'boards', 'storyboard.html'), 'utf8')).match(
      /class="frame"/g
    )
  ).toHaveLength(3)
  // The camera scene's take: a test pattern with its lines spoken over it.
  await mkdir(join(dir, '.studio'), { recursive: true })
  const spoken = join(dir, '.studio', 'take-voice.aiff')
  await runCommand('/usr/bin/say', [
    '-o',
    spoken,
    'Your request ended. Your stream did not.'
  ])
  const seconds = await probeSeconds(spoken)
  const take = join(dir, '.studio', 'take.mp4')
  await runCommand('ffmpeg', [
    '-y',
    '-f',
    'lavfi',
    '-i',
    `testsrc2=size=1280x720:rate=30:duration=${seconds + 0.5}`,
    '-i',
    spoken,
    '-shortest',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    take
  ])
  const frames = episodeFrames(report.value)
  const audio = await prepareEpisodeAudio({
    dir,
    frames,
    voice: {},
    takes: { p1: take },
    captures: {}
  })
  expect(audio.meta.voices.map((voice) => voice.frame)).toEqual([1, 2, 3])
  expect(
    audio.meta.voices[2].words
      .map((word) => word.text)
      .join(' ')
      .toLowerCase()
  ).toMatch(/frame goes in/)
  expect(Object.keys(audio.media)).toEqual(['1', '2'])
  internal.durations = audio.durations
  internal.media = audio.media
  internal.voices = audio.meta.voices
  await writeProjectFiles(dir, internal)
  await writeFramePackets(dir)
  await mkdir(join(dir, 'compositions', 'frames'), { recursive: true })
  for (const entry of frames) {
    const duration = audio.durations[entry.number]
    const html = stubFrame(
      entry.id,
      entry.title,
      duration,
      audio.media[entry.number]
    )
    expect(frameShapeProblems(html, entry.id)).toEqual([])
    if (entry.number === 1) {
      const tried = await tryFrame({
        dir,
        frameId: entry.id,
        html,
        duration,
        media: audio.media[1]
      })
      expect(tried.problems).toEqual([])
      expect(tried.snapshots.length).toBeGreaterThan(0)
      expect(tried.fill[0]).toMatch(/its fullest moment, the content spans/)
    }
    await writeFile(
      join(dir, 'compositions', 'frames', `${entry.id}.html`),
      html
    )
    internal.statuses = { ...internal.statuses, [entry.number]: 'animated' }
  }
  await writeProjectFiles(dir, internal)
  await assembleEpisode(dir)
  expect(await readFile(join(dir, 'index.html'), 'utf8')).toMatch(
    /data-composition-id="captions"/
  )
  const checked = await checkEpisode(
    dir,
    frames.map((entry) => entry.id)
  )
  expect(checked.other).toEqual([])
  expect(await episodeSheet(dir, [1, 3, 6])).toBeTruthy()
  const output = await renderEpisode(dir)
  const length = await probeSeconds(output)
  const total = Object.values(audio.durations).reduce(
    (sum, value) => sum + value,
    0
  )
  expect(Math.abs(length - total)).toBeLessThan(1)
  expect(await episodePoster(output, 1)).toMatch(/poster\.jpg$/)
  // To look at what it made: STORYBOARD_MACHINERY_OUT=<folder>.
  if (process.env.STORYBOARD_MACHINERY_OUT)
    await cp(dir, process.env.STORYBOARD_MACHINERY_OUT, { recursive: true })
}, 900_000)
