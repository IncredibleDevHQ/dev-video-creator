// The episode's sound, frame by frame, in Hyperframes' own audio_meta.json
// shape (faceless-explainer/scripts/audio.mjs): every spoken frame gets its
// clip and its words, timed inside the clip. Frames are spoken in the
// video's voice; a scene with the creator's take speaks with the take,
// cut where its frames' lines begin. Measured lengths become the frames'
// durations (sync-durations: the real voice wins).
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { BuildType, PlanFrame } from '../../shared/storyboard'
import { alignTake, takeClockOf, type AlignedLine } from '../take-clock'
import { narrationClock, probeSeconds, runCommand } from '../voice'

export type EpisodeFrame = PlanFrame & { build: BuildType; pageId: string }
export type MetaWord = { id: string; text: string; start: number; end: number }
export type FrameVoice = {
  frame: number
  path: string
  duration_s: number
  words: MetaWord[]
}
export type AudioMeta = {
  bgm: null
  bgm_pending: false
  voices: FrameVoice[]
  sfx: []
}

const pad2 = (value: number) => String(value).padStart(2, '0')
const r3 = (value: number) => Math.round(value * 1000) / 1000

/** Each word of a line spread evenly over its clip: when no aligner can
 * hear it, captions still follow the line. */
export const evenWords = (
  line: string,
  seconds: number,
  from = 0
): MetaWord[] => {
  const words = line.split(/\s+/).filter(Boolean)
  const step = words.length ? seconds / words.length : 0
  return words.map((word, index) => ({
    id: `w${index}`,
    text: word,
    start: r3(from + index * step),
    end: r3(from + (index + 1) * step)
  }))
}

/** The aligner's words for a line, moved to start at `offset` seconds. */
export const wordsFrom = (
  line: AlignedLine | undefined,
  offset: number
): MetaWord[] =>
  (line?.words || []).map((word, index) => ({
    id: `w${index}`,
    text: word.word,
    start: r3(Math.max(0, word.startMs / 1000 - offset)),
    end: r3(Math.max(0, word.endMs / 1000 - offset))
  }))

const toWav = (input: string, output: string, extra: string[] = []) =>
  runCommand(
    'ffmpeg',
    [
      '-y',
      ...extra,
      '-i',
      input,
      '-vn',
      '-ar',
      '44100',
      '-ac',
      '1',
      '-c:a',
      'pcm_s16le',
      output
    ],
    300_000
  )

/** Speaks every frame of the scenes without a take, in the video's voice. */
const speakFrames = async (
  dir: string,
  frames: EpisodeFrame[],
  voice: { referenceId?: string; systemVoice?: string }
) => {
  const voices: FrameVoice[] = []
  for (const frame of frames) {
    if (!frame.voiceover.trim()) continue
    const clip = await narrationClock(
      [
        {
          id: String(frame.number),
          text: frame.voiceover,
          estimate: frame.duration
        }
      ],
      { ...voice, settle: 0.35 }
    )
    const mp3 = join(dir, '.studio', `voice-${pad2(frame.number)}.mp3`)
    await writeFile(mp3, clip.audio)
    const path = `assets/voice/${pad2(frame.number)}.wav`
    await toWav(mp3, join(dir, path))
    voices.push({
      frame: frame.number,
      path,
      duration_s: r3(await probeSeconds(join(dir, path))),
      words: []
    })
  }
  // One pass of the aligner over all the clips, joined in order.
  if (voices.length) {
    const list = join(dir, '.studio', 'voices.txt')
    await writeFile(
      list,
      voices.map((entry) => `file '${join(dir, entry.path)}'`).join('\n')
    )
    const joined = join(dir, '.studio', 'voices.wav')
    await runCommand(
      'ffmpeg',
      ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', joined],
      300_000
    )
    const lines = voices.map((entry) => ({
      id: String(entry.frame),
      say: frames.find((frame) => frame.number === entry.frame)!.voiceover
    }))
    const aligned = await alignTake(joined, lines).catch(() => null)
    let offset = 0
    for (const entry of voices) {
      const line = aligned?.find((item) => item.id === String(entry.frame))
      const say = lines.find((item) => item.id === String(entry.frame))!.say
      entry.words =
        line && line.coverage >= 0.5 && line.words.length
          ? wordsFrom(line, offset)
          : evenWords(say, Math.max(0.5, entry.duration_s - 0.35))
      offset += entry.duration_s
    }
  }
  return voices
}

/** A scene's take, cut at its frames: each frame's sound, its words and, for
 * a camera scene, its picture (muted, every frame a keyframe, as the renderer
 * seeks it). */
const cutTake = async (
  dir: string,
  takePath: string,
  frames: EpisodeFrame[],
  picture: boolean
) => {
  const duration = await probeSeconds(takePath)
  const lines = frames.map((frame) => ({
    id: String(frame.number),
    say: frame.voiceover
  }))
  const aligned = await alignTake(
    takePath,
    lines.filter((line) => line.say)
  )
  const clock = takeClockOf(lines, aligned, duration)
  if (clock.problems.length)
    throw new Error(
      `The take does not cover its scene: ${clock.problems.slice(0, 2).join('; ')}`
    )
  const voices: FrameVoice[] = []
  const media: Record<number, string> = {}
  for (const frame of frames) {
    const span = clock.moments.find(
      (moment) => moment.id === String(frame.number)
    )!
    const length = r3(span.end - span.start)
    const path = `assets/voice/${pad2(frame.number)}.wav`
    await toWav(takePath, join(dir, path), [
      '-ss',
      String(span.start),
      '-t',
      String(length)
    ])
    if (picture) {
      const video = `assets/takes/${pad2(frame.number)}.mp4`
      await runCommand(
        'ffmpeg',
        [
          '-y',
          '-ss',
          String(span.start),
          '-t',
          String(length),
          '-i',
          takePath,
          '-an',
          '-c:v',
          'libx264',
          '-crf',
          '18',
          '-g',
          '30',
          '-keyint_min',
          '30',
          '-pix_fmt',
          'yuv420p',
          '-movflags',
          '+faststart',
          join(dir, video)
        ],
        600_000
      )
      media[frame.number] = video
    }
    const line = aligned.find((item) => item.id === String(frame.number))
    voices.push({
      frame: frame.number,
      path,
      duration_s: length,
      words: frame.voiceover ? wordsFrom(line, span.start) : []
    })
  }
  return { voices, media }
}

/** A screen scene's capture, shared out over its frames in order. */
const cutCapture = async (
  dir: string,
  capturePath: string,
  frames: EpisodeFrame[],
  durations: Record<number, number>
) => {
  const total = await probeSeconds(capturePath)
  const media: Record<number, string> = {}
  let at = 0
  for (const frame of frames) {
    const length = durations[frame.number] ?? frame.duration
    const start = Math.min(at, Math.max(0, total - 0.5))
    const video = `assets/captures/${pad2(frame.number)}.mp4`
    await runCommand(
      'ffmpeg',
      [
        '-y',
        '-ss',
        String(start),
        '-i',
        capturePath,
        '-t',
        String(length),
        '-an',
        '-vf',
        `tpad=stop_mode=clone:stop_duration=${Math.ceil(length)}`,
        '-c:v',
        'libx264',
        '-crf',
        '18',
        '-g',
        '30',
        '-keyint_min',
        '30',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        join(dir, video)
      ],
      600_000
    )
    media[frame.number] = video
    at += length
  }
  return media
}

/**
 * The episode's audio: audio_meta.json, each frame's measured length, and
 * the media each camera or screen frame plays.
 */
export const prepareEpisodeAudio = async (input: {
  dir: string
  frames: EpisodeFrame[]
  voice: { referenceId?: string; systemVoice?: string }
  /** A take on disk per page that has one. */
  takes: Record<string, string>
  /** A product capture on disk per screen page. */
  captures: Record<string, string>
}) => {
  const { dir, frames } = input
  await mkdir(join(dir, '.studio'), { recursive: true })
  await rm(join(dir, 'assets', 'voice'), { recursive: true, force: true })
  await mkdir(join(dir, 'assets', 'voice'), { recursive: true })
  await mkdir(join(dir, 'assets', 'takes'), { recursive: true })
  await mkdir(join(dir, 'assets', 'captures'), { recursive: true })
  const pages = [...new Set(frames.map((frame) => frame.pageId))]
  const voices: FrameVoice[] = []
  const media: Record<number, string> = {}
  const spoken: EpisodeFrame[] = []
  for (const page of pages) {
    const scene = frames.filter((frame) => frame.pageId === page)
    const take = input.takes[page]
    if (take) {
      const cut = await cutTake(dir, take, scene, scene[0].build === 'camera')
      voices.push(...cut.voices)
      Object.assign(media, cut.media)
    } else spoken.push(...scene)
  }
  voices.push(...(await speakFrames(dir, spoken, input.voice)))
  voices.sort((a, b) => a.frame - b.frame)
  const durations: Record<number, number> = {}
  for (const frame of frames) {
    const entry = voices.find((item) => item.frame === frame.number)
    durations[frame.number] = entry ? entry.duration_s : frame.duration
  }
  for (const page of pages) {
    const capture = input.captures[page]
    const scene = frames.filter((frame) => frame.pageId === page)
    if (capture && scene[0].build === 'screen')
      Object.assign(media, await cutCapture(dir, capture, scene, durations))
  }
  const meta: AudioMeta = { bgm: null, bgm_pending: false, voices, sfx: [] }
  await writeFile(join(dir, 'audio_meta.json'), JSON.stringify(meta, null, 2))
  return { meta, durations, media }
}

export const readAudioMeta = async (dir: string) =>
  JSON.parse(await readFile(join(dir, 'audio_meta.json'), 'utf8')) as AudioMeta
