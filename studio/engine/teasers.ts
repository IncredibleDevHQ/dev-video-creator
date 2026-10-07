// A teaser, cut from the produced video for one channel: the hook, then the
// strongest beat, framed for the feed (9:16, 1:1, 4:5 or 16:9) over a blurred
// fill, with the words burned in, because feeds autoplay muted. Captions are
// drawn by a browser and laid over with ffmpeg, which needs no font filters.
import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { captionCues, teaserSegments } from '../shared/release-plan'
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

const escapeHtml = (text: string) =>
  text.replace(/[&<>"]/g, (char) => `&#${char.charCodeAt(0)};`)

/** Each caption as a transparent PNG, sized for the frame. */
const drawCaptions = async (
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

/** Cuts, frames and captions a teaser; returns the MP4's bytes. */
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
    const cues = captionCues(project, teaser.segments)
    const pictures = await drawCaptions(dir, cues, frame.width)
    const audio = await hasAudio(source)
    const parts = teaser.segments.map(
      (segment, index) =>
        `[0:v]trim=start=${segment.from}:end=${segment.to},setpts=PTS-STARTPTS[v${index}]` +
        (audio
          ? `;[0:a]atrim=start=${segment.from}:end=${segment.to},asetpts=PTS-STARTPTS[a${index}]`
          : '')
    )
    const joined = teaser.segments
      .map((_, index) => `[v${index}]${audio ? `[a${index}]` : ''}`)
      .join('')
    const { width: W, height: H } = frame
    const filters = [
      ...parts,
      `${joined}concat=n=${teaser.segments.length}:v=1:a=${audio ? 1 : 0}[cv]${audio ? '[ca]' : ''}`,
      '[cv]split[bgsrc][fgsrc]',
      `[bgsrc]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},gblur=sigma=32,eq=brightness=-0.18[bg]`,
      `[fgsrc]scale=${W}:${H}:force_original_aspect_ratio=decrease[fg]`,
      '[bg][fg]overlay=(W-w)/2:(H-h)/2[c0]',
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
    return await readFile(out)
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
    const bytes = await cutTeaser(snapshot.project, teaser)
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
      objectKey: asset.objectKey
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
