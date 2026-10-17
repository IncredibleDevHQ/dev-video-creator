// Release's "Rebuild for portrait" (review 8, round 1): a storyboard
// episode's frames fill a 16:9 picture, so a teaser cropped to 9:16 keeps
// most of its text small, and no crop fixes that. The frame agent draws each
// frame the teaser uses again for the teaser's shape (one AI run a frame,
// teaser-portrait-run.ts); Hyperframes renders them; the teaser is cut from
// that render with the episode's own sound for its stretches and its own
// captions in the caption band. "Keep it as it is" is the creator's other
// way out of a draft.
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Project } from '../shared/model'
import type { Teaser } from '../shared/release'
import { frameId } from '../shared/storyboard'
import {
  canRebuild,
  shapeName,
  teaserFrames,
  type TeaserFrame,
  type TeaserPiece
} from '../shared/teaser-shape'
import { addEvent } from './activity'
import { HarnessStageError } from './generation-errors'
import { readAsset, storeAsset } from './persistence'
import { changeProject, loadProject } from './projects'
import { Refusal } from './refusal'
import { concurrency, origin, selectionOf } from './storyboard/run'
import { productionDir } from './storyboard/workspace'
import { croppedCaptions } from './teaser-framing'
import {
  drawFrameForShape,
  drawnForShape,
  prepareShape,
  renderShape
} from './teaser-portrait-run'
import { FRAME, drawCaptions } from './teasers'
import { runCommand } from './voice'

const changeTeaser = (
  id: string,
  teaserId: string,
  change: (teaser: Teaser) => void
) =>
  changeProject(id, (current) => {
    const teaser = current.project.release?.teasers.find(
      (item) => item.id === teaserId
    )
    if (!teaser) throw new Refusal('That teaser is gone')
    change(teaser)
  })

/** The creator keeps a teaser whose text stays small: it is offered as
 * finished, and the bundle carries it. */
export const keepTeaser = (id: string, raw: unknown) =>
  changeTeaser(
    id,
    String((raw as { teaser?: unknown })?.teaser || ''),
    (teaser) => {
      teaser.kept = true
    }
  )

/** The teaser cut from its shape's render: each stretch from its frame, a
 * sliver of the frame beside it held on that frame's first or last
 * picture, the episode's sound for the segments, the teaser's captions in
 * the caption band the frames keep clear. */
export const cutFromShape = async (input: {
  project: Project
  teaser: Pick<Teaser, 'aspect' | 'segments'>
  render: string
  frames: TeaserFrame[]
  pieces: TeaserPiece[]
}) => {
  const { project, teaser, frames, pieces } = input
  const produced = project.video?.produced
  if (!produced) throw new Refusal('Produce the video first')
  const { width: W, height: H } = FRAME[teaser.aspect]
  const dir = await mkdtemp(join(tmpdir(), 'studio-shape-teaser-'))
  try {
    const episode = join(dir, 'episode.mp4')
    await writeFile(episode, await readAsset(produced.objectKey))
    // Where each frame starts in the render: one after another, in order.
    const starts = new Map<number, number>()
    let at = 0
    for (const frame of frames) {
      starts.set(frame.number, at)
      at += frame.duration
    }
    const cues = await croppedCaptions(project, teaser.segments)
    const pictures = await drawCaptions(dir, cues, W)
    const audio =
      (
        await runCommand('ffprobe', [
          '-v',
          'error',
          '-select_streams',
          'a',
          '-show_entries',
          'stream=index',
          '-of',
          'csv=p=0',
          episode
        ]).catch(() => '')
      ).trim().length > 0
    const filters = [
      ...pieces.map((piece, index) => {
        const frame = frames.find((item) => item.number === piece.frame)!
        const start = starts.get(frame.number)! + piece.from - frame.from
        const end = starts.get(frame.number)! + piece.to - frame.from
        return `[0:v]trim=start=${start.toFixed(3)}:end=${end.toFixed(3)},setpts=PTS-STARTPTS${piece.before ? `,tpad=start_mode=clone:start_duration=${piece.before.toFixed(3)}` : ''}${piece.after ? `,tpad=stop_mode=clone:stop_duration=${piece.after.toFixed(3)}` : ''},scale=${W}:${H},setsar=1[v${index}]`
      }),
      `${pieces.map((_, index) => `[v${index}]`).join('')}concat=n=${pieces.length}:v=1:a=0[c0]`,
      ...(audio
        ? [
            ...teaser.segments.map(
              (segment, index) =>
                `[1:a]atrim=start=${segment.from}:end=${segment.to},asetpts=PTS-STARTPTS[a${index}]`
            ),
            `${teaser.segments.map((_, index) => `[a${index}]`).join('')}concat=n=${teaser.segments.length}:v=0:a=1[ca]`
          ]
        : []),
      // Centred in the caption band, the bottom sixth the frames keep clear.
      ...cues.map(
        (cue, index) =>
          `[c${index}][${index + 2}:v]overlay=x=(W-w)/2:y=${Math.round(H * (1 - 0.1667 / 2))}-h/2:enable='between(t,${cue.start},${cue.end})'[c${index + 1}]`
      )
    ]
    const out = join(dir, 'teaser.mp4')
    await runCommand(
      'ffmpeg',
      [
        '-y',
        '-i',
        input.render,
        '-i',
        episode,
        ...pictures.flatMap((file) => ['-i', file]),
        '-filter_complex',
        filters.join(';'),
        '-map',
        `[c${cues.length}]`,
        ...(audio ? ['-map', '[ca]', '-c:a', 'aac', '-b:a', '160k'] : []),
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-pix_fmt',
        'yuv420p',
        '-r',
        '30',
        '-movflags',
        '+faststart',
        out
      ],
      300_000
    )
    return await readFile(out)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/**
 * Draws a teaser's frames again for its shape and cuts the teaser from
 * them, in the background, on the creator's click: one frame agent run for
 * each frame the teaser uses, a frame already drawn since the episode's last
 * change kept. Returns the notebook with the rebuild under way.
 */
export const rebuildTeaser = async (id: string, raw: unknown) => {
  const teaserId = String((raw as { teaser?: unknown })?.teaser || '')
  const snapshot = await loadProject(id)
  if (!snapshot) throw new Refusal('Notebook not found')
  const project = snapshot.project
  const teaser = project.release?.teasers.find((item) => item.id === teaserId)
  if (!teaser) throw new Refusal('That teaser is gone')
  if (teaser.rebuild?.state === 'rebuilding')
    throw new Refusal('It is being drawn again now')
  if (!canRebuild(project, teaser))
    throw new Refusal(
      'Only a storyboard episode’s teaser whose text stays small is drawn again'
    )
  const storyboard = project.video!.storyboard!
  const { frames, pieces } = teaserFrames(project, teaser.segments)
  if (!frames.length) throw new Refusal('Produce the video first')
  const started = await changeProject(id, (current) => {
    const teasers = current.project.release?.teasers || []
    const claimed = teasers.find((item) => item.id === teaserId)
    if (!claimed) throw new Refusal('That teaser is gone')
    if (claimed.rebuild?.state === 'rebuilding')
      throw new Refusal('It is being drawn again now')
    // One shape's frames are drawn and rendered in one folder at a time.
    const canvas = FRAME[claimed.aspect]
    const busy = teasers.some(
      (item) =>
        item.id !== teaserId &&
        item.rebuild?.state === 'rebuilding' &&
        FRAME[item.aspect].width === canvas.width &&
        FRAME[item.aspect].height === canvas.height
    )
    if (busy)
      throw new Refusal(
        `Another teaser’s frames are being drawn for ${shapeName(claimed.aspect)} now: wait for it`
      )
    claimed.rebuild = {
      state: 'rebuilding',
      frames: frames.length,
      done: 0,
      at: new Date().toISOString()
    }
  })
  const step = (change: (teaser: Teaser) => void) =>
    changeTeaser(id, teaserId, change)
  void (async () => {
    const canvas = FRAME[teaser.aspect]
    const episodeDir = productionDir(id, storyboard.id)
    const dir = await prepareShape(episodeDir, canvas)
    const selection = await selectionOf(snapshot)
    const queue = [...frames]
    const lane = async () => {
      while (queue.length) {
        const frame = queue.shift()!
        const name = frameId(frame)
        if (!(await drawnForShape(episodeDir, dir, name)))
          await drawFrameForShape({
            projectId: id,
            episodeDir,
            dir,
            frameId: name,
            number: frame.number,
            build: frame.build,
            duration: frame.duration,
            canvas,
            selection,
            origin: origin()
          })
        await step((current) => {
          if (current.rebuild) current.rebuild.done += 1
        })
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(concurrency(), frames.length) }, lane)
    )
    const render = await renderShape(
      dir,
      canvas,
      frames.map((frame) => ({
        frameId: frameId(frame),
        duration: frame.duration
      }))
    )
    const bytes = await cutFromShape({
      project,
      teaser,
      render,
      frames,
      pieces
    })
    const asset = await storeAsset({
      body: bytes,
      contentType: 'video/mp4',
      extension: '.mp4',
      kind: 'teaser',
      projectId: id
    })
    await step((current) => {
      current.objectKey = asset.objectKey
      current.rebuild = {
        ...current.rebuild!,
        state: 'ready',
        done: frames.length
      }
      delete current.small
      delete current.kept
    })
    await changeProject(id, (current) =>
      addEvent(
        current,
        'video',
        `Drew the ${teaser.aspect} teaser’s ${frames.length} frames again for ${shapeName(teaser.aspect)}`
      )
    )
  })().catch((error: Error) =>
    step((current) => {
      current.rebuild = {
        ...(current.rebuild || {
          frames: frames.length,
          done: 0,
          at: new Date().toISOString()
        }),
        state: 'failed',
        error:
          error instanceof Refusal || error instanceof HarnessStageError
            ? error.message
            : 'It could not be drawn again: try again'
      }
    }).catch(() => {})
  )
  return started
}
