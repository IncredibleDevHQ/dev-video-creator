// A teaser, cut from the produced video for one channel: the hook, then the
// strongest beat, framed for the feed (9:16, 1:1, 4:5 or 16:9), with the
// words burned in, because feeds autoplay muted. A storyboard episode is
// cropped to where its lesson sits (teaser-framing.ts); anything else is
// fitted whole over a blurred fill. Captions are drawn by a browser and
// laid over with ffmpeg, which needs no font filters.
import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { teaserCues, teaserSegments } from '../shared/release-plan'
import {
  CHANNEL_ASPECTS,
  emptyRelease,
  type Aspect,
  type Channel,
  type Teaser
} from '../shared/release'
import type { Project } from '../shared/model'
import { addEvent } from './activity'
import { readAsset, storeAsset } from './persistence'
import { changeProject, loadProject } from './projects'
import { Refusal } from './refusal'
import {
  BAND_TOP,
  PATCH,
  croppedCaptions,
  frameTeaser,
  smallSeconds,
  type Layout,
  type Shot
} from './teaser-framing'
import { runCommand } from './voice'

export const FRAME: Record<
  Aspect,
  { width: number; height: number; captionAt: number }
> = {
  '9:16': { width: 1080, height: 1920, captionAt: 0.7 },
  '1:1': { width: 1080, height: 1080, captionAt: 0.8 },
  '4:5': { width: 1080, height: 1350, captionAt: 0.77 },
  '16:9': { width: 1920, height: 1080, captionAt: 0.82 }
}

const hasAudio = (file: string) =>
  new Promise<boolean>((done) =>
    execFile(
      'ffprobe',
      [
        '-v',
        'error',
        '-select_streams',
        'a',
        '-show_entries',
        'stream=index',
        '-of',
        'csv=p=0',
        file
      ],
      (error, stdout) => done(!error && stdout.trim().length > 0)
    )
  )

/** The produced video's picture size; a storyboard's canvas if unread. */
const pictureSize = (file: string) =>
  new Promise<{ width: number; height: number }>((done) =>
    execFile(
      'ffprobe',
      [
        '-v',
        'error',
        '-select_streams',
        'v:0',
        '-show_entries',
        'stream=width,height',
        '-of',
        'csv=p=0',
        file
      ],
      (error, stdout) => {
        const [width, height] = stdout.trim().split(',').map(Number)
        done(
          error || !width || !height
            ? { width: 1920, height: 1080 }
            : { width, height }
        )
      }
    )
  )

const escapeHtml = (text: string) =>
  text.replace(/[&<>"]/g, (char) => `&#${char.charCodeAt(0)};`)

/** One stretch's picture: cropped and placed on its frame's background, or
 * fitted whole over a blurred fill. The fill is the picture without its
 * lowest fifth, where a video's own captions sit: blown up, they showed
 * again behind the frame. A cropped teaser leaves the caption band out of
 * its fits too, its captions being its own. */
const shotFilter = (
  shot: Shot,
  index: number,
  layout: Layout,
  bandless: boolean
) => {
  const { width: W, height: H } = layout
  const cut = `[0:v]trim=start=${shot.from}:end=${shot.to},setpts=PTS-STARTPTS`
  const { crop, place, patch } = shot
  const lesson = crop
    ? `crop=${crop.w}:${crop.h}:${crop.x}:${crop.y},scale=${place!.w}:${place!.h}:flags=lanczos`
    : ''
  // The frame's own background blown up from a corner: no colour is
  // converted, so it meets the crop without a seam.
  if (crop && patch)
    return [
      `${cut},split[s${index}][p${index}]`,
      `[p${index}]crop=${PATCH}:${PATCH}:${patch.x}:${patch.y},scale=2:2:flags=area,scale=${W}:${H}:flags=bilinear,setsar=1[c${index}]`,
      `[s${index}]${lesson},setsar=1[f${index}]`,
      `[c${index}][f${index}]overlay=${place!.x}:${place!.y},setsar=1[v${index}]`
    ].join(';')
  if (crop)
    return `${cut},${lesson},pad=${W}:${H}:${place!.x}:${place!.y}:color=${shot.color},setsar=1[v${index}]`
  return [
    `${cut}${bandless ? `,crop=iw:trunc(ih*${BAND_TOP.toFixed(4)}/2)*2:0:0` : ''},split[b${index}][f${index}]`,
    `[b${index}]crop=iw:ih*0.8:0:0,scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},gblur=sigma=32,eq=brightness=-0.18[g${index}]`,
    `[f${index}]scale=${W}:${H}:force_original_aspect_ratio=decrease[k${index}]`,
    `[g${index}][k${index}]overlay=(W-w)/2:(H-h)/2,setsar=1[v${index}]`
  ].join(';')
}

/** Each caption as a transparent PNG, sized for the frame. */
export const drawCaptions = async (
  dir: string,
  cues: Array<{ text: string }>,
  width: number
) => {
  if (!cues.length) return []
  const { default: puppeteer } = await import('puppeteer')
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox'],
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false
  })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width, height: 400 })
    const files: string[] = []
    for (const [index, cue] of cues.entries()) {
      await page.setContent(
        `<body style="margin:0;background:transparent;display:flex;justify-content:center;align-items:flex-start"><div id="c" style="display:inline-block;max-width:${Math.round(width * 0.86)}px;padding:14px 26px;border-radius:16px;background:rgba(0,0,0,.74);color:#fff;font:700 ${Math.round(width / 20)}px/1.22 -apple-system,'Segoe UI',Inter,Arial,sans-serif;text-align:center">${escapeHtml(cue.text)}</div></body>`
      )
      const element = await page.$('#c')
      const file = join(dir, `cue-${index}.png`)
      await element!.screenshot({ path: file, omitBackground: true })
      files.push(file)
    }
    return files
  } finally {
    await browser.close().catch(() => {})
  }
}

/** Cuts, frames and captions a teaser: the MP4's bytes, and the seconds in
 * which its text stays below reading size on a phone. */
export const cutTeaser = async (
  project: Project,
  teaser: Pick<Teaser, 'aspect' | 'segments'>
) => {
  const produced = project.video?.produced
  if (!produced) throw new Refusal('Produce the video first')
  const dir = await mkdtemp(join(tmpdir(), 'studio-teaser-'))
  try {
    const source = join(dir, 'video.mp4')
    await writeFile(source, await readAsset(produced.objectKey))
    const frame = FRAME[teaser.aspect]
    const size = await pictureSize(source)
    // A storyboard episode cropped to its lesson, with the teaser's own
    // captions under it (review 8); else the fit, as before.
    const cropped = await frameTeaser({
      project,
      video: source,
      segments: teaser.segments,
      layout: frame,
      source: size
    }).catch(() => null)
    const fit = Math.min(frame.width / size.width, frame.height / size.height)
    const shots: Shot[] =
      cropped || teaser.segments.map((segment) => ({ ...segment, scale: fit }))
    const cues = cropped
      ? await croppedCaptions(project, teaser.segments)
      : teaserCues(project, teaser.segments)
    const pictures = await drawCaptions(dir, cues, frame.width)
    const audio = await hasAudio(source)
    const { height: H } = frame
    const filters = [
      ...shots.map((shot, index) =>
        shotFilter(shot, index, frame, Boolean(cropped))
      ),
      `${shots.map((_, index) => `[v${index}]`).join('')}concat=n=${shots.length}:v=1:a=0[c0]`,
      ...(audio
        ? [
            ...teaser.segments.map(
              (segment, index) =>
                `[0:a]atrim=start=${segment.from}:end=${segment.to},asetpts=PTS-STARTPTS[a${index}]`
            ),
            `${teaser.segments.map((_, index) => `[a${index}]`).join('')}concat=n=${teaser.segments.length}:v=0:a=1[ca]`
          ]
        : []),
      ...cues.map(
        (cue, index) =>
          `[c${index}][${index + 1}:v]overlay=x=(W-w)/2:y=${Math.round(H * frame.captionAt)}:enable='between(t,${cue.start},${cue.end})'[c${index + 1}]`
      )
    ]
    const out = join(dir, 'teaser.mp4')
    await runCommand(
      'ffmpeg',
      [
        '-y',
        '-i',
        source,
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
    return { bytes: await readFile(out), small: smallSeconds(shots) }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

const setTeaser = (id: string, teaser: Teaser) =>
  changeProject(id, (current) => {
    const release = current.project.release || emptyRelease()
    release.teasers = [
      ...release.teasers.filter((item) => item.id !== teaser.id),
      teaser
    ]
    current.project.release = release
  })

/** A teaser for a channel, cut in the background. */
export const makeTeaser = async (id: string, raw: unknown) => {
  const value = (raw ?? {}) as Record<string, unknown>
  const channel = String(value.channel) as Channel
  if (!(channel in CHANNEL_ASPECTS))
    throw new Refusal('Choose X, LinkedIn or YouTube')
  const aspect = (
    CHANNEL_ASPECTS[channel].includes(value.aspect as Aspect)
      ? value.aspect
      : CHANNEL_ASPECTS[channel][0]
  ) as Aspect
  const snapshot = await loadProject(id)
  if (!snapshot?.project.video?.produced)
    throw new Refusal('Produce the video first')
  const moment =
    value.moment === undefined || value.moment === null
      ? undefined
      : Number(value.moment)
  const segments = teaserSegments(
    snapshot.project,
    Number.isFinite(moment) ? moment : undefined
  )
  if (!segments.length) throw new Refusal('Produce the video first')
  const teaser: Teaser = {
    id: randomUUID(),
    channel,
    aspect,
    segments,
    state: 'cutting',
    at: new Date().toISOString()
  }
  const started = await setTeaser(id, teaser)
  void (async () => {
    const { bytes, small } = await cutTeaser(snapshot.project, teaser)
    const asset = await storeAsset({
      body: bytes,
      contentType: 'video/mp4',
      extension: '.mp4',
      kind: 'teaser',
      projectId: id
    })
    await setTeaser(id, {
      ...teaser,
      state: 'ready',
      objectKey: asset.objectKey,
      ...(small ? { small } : {})
    })
    await changeProject(id, (current) =>
      addEvent(current, 'video', `Cut a ${aspect} teaser for ${channel}`)
    )
  })().catch((error: Error) =>
    setTeaser(id, {
      ...teaser,
      state: 'failed',
      error:
        error instanceof Refusal ? error.message : 'The teaser could not be cut'
    }).catch(() => {})
  )
  return started
}
