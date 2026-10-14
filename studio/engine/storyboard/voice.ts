// The episode's sound, frame by frame, in Hyperframes' own audio_meta.json
// shape (faceless-explainer/scripts/audio.mjs): every spoken frame gets its
// clip and its words, timed inside the clip. Frames are spoken in the
// video's voice; a scene with the creator's take speaks with the take,
// cut where its frames' lines begin. Measured lengths become the frames'
// durations (sync-durations: the real voice wins).
import { mkdir, readFile, writeFile } from 'node:fs/promises'
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

/** A line's words as captions show them: a dash on its own is no word. */
export const spokenWords = (line: string) =>
  line.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word))

/**
 * Every word of a frame's line, timed inside the frame's own clip, which
 * starts `offset` seconds into what the aligner heard: the aligner's time
 * where it heard the word (a time outside the clip belongs to another
 * frame, and is dropped), the gaps around shared out over the words it
 * missed. When it heard less than half, the line is spread evenly.
 */
export const frameWords = (
  say: string,
  line: AlignedLine | undefined,
  offset: number,
  seconds: number,
  settle = 0
): MetaWord[] => {
  const words = spokenWords(say)
  const end = Math.max(0.5, seconds - settle)
  const times: Array<{ start: number; end: number } | null> = words.map(
    () => null
  )
  let next = 0
  for (const heard of line?.words || []) {
    const start = heard.startMs / 1000 - offset
    const stop = heard.endMs / 1000 - offset
    if (start < -0.25 || stop > seconds + 0.25) continue
    const index = words.findIndex(
      (word, at) => at >= next && word === heard.word
    )
    if (index < 0) continue
    times[index] = {
      start: Math.min(Math.max(0, start), seconds),
      end: Math.min(Math.max(0, stop), seconds)
    }
    next = index + 1
  }
  if (times.filter(Boolean).length * 2 < words.length)
    return evenWords(words.join(' '), end)
  const filled = times.slice()
  for (let index = 0; index < words.length; index++) {
    if (filled[index]) continue
    let last = index
    while (last + 1 < words.length && !filled[last + 1]) last++
    const from = index ? filled[index - 1]!.end : 0
    const to =
      last + 1 < words.length
        ? filled[last + 1]!.start
        : Math.max(from, Math.min(end, seconds))
    const share = Math.max(0, to - from) / (last - index + 1)
    for (let at = index; at <= last; at++)
      filled[at] = {
        start: from + (at - index) * share,
        end: from + (at - index + 1) * share
      }
    index = last
  }
  let floor = 0
  return words.map((text, index) => {
    const start = Math.max(floor, filled[index]!.start)
    floor = start
    return {
      id: `w${index}`,
      text,
      start: r3(start),
      end: r3(Math.max(start, filled[index]!.end))
    }
  })
}

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
      say: spokenWords(
        frames.find((frame) => frame.number === entry.frame)!.voiceover
      ).join(' ')
    }))
    const aligned = await alignTake(joined, lines).catch(() => null)
    let offset = 0
    for (const entry of voices) {
      const line = aligned?.find((item) => item.id === String(entry.frame))
      const say = lines.find((item) => item.id === String(entry.frame))!.say
      entry.words = frameWords(say, line, offset, entry.duration_s, 0.35)
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
    say: spokenWords(frame.voiceover).join(' ')
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
      words: frame.voiceover
        ? frameWords(frame.voiceover, line, span.start, length)
        : []
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
 * The episode's audio, scene by scene: the frames given are voiced now
 * (their take cut, or spoken), merged with what was voiced before, and
 * audio_meta.json written whole. Returns each frame's measured length and
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
  /** What earlier scenes were voiced with. */
  previous?: {
    voices?: FrameVoice[]
    durations?: Record<number, number>
    media?: Record<number, string>
  }
}) => {
  const { dir, frames } = input
  for (const folder of [
    '.studio',
    'assets/voice',
    'assets/takes',
    'assets/captures'
  ])
    await mkdir(join(dir, folder), { recursive: true })
  const now = new Set(frames.map((frame) => frame.number))
  const pages = [...new Set(frames.map((frame) => frame.pageId))]
  const voices: FrameVoice[] = (input.previous?.voices || []).filter(
    (entry) => !now.has(entry.frame)
  )
  const media: Record<number, string> = Object.fromEntries(
    Object.entries(input.previous?.media || {}).filter(
      ([frame]) => !now.has(Number(frame))
    )
  )
  const durations: Record<number, number> = Object.fromEntries(
    Object.entries(input.previous?.durations || {}).filter(
      ([frame]) => !now.has(Number(frame))
    )
  )
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
