// The clock of a scene the creator presents (P5).
//
// The creator's selected take is the scene's clock. The product normalizes
// it once into the file the stage, the check and the render all play, and
// aligns it to the approved plan's spoken lines, moment by moment. The
// take's own delivery (its pace, pauses and emphasis) sets the timing. A
// line the take does not say is named and never invented, and the take is
// never stretched or cut.
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { probeSeconds, runCommand } from './voice'

// A spoken line of the approved plan, by the moment that says it.
export type TakeLine = { id: string; say: string }
export type AlignedWord = { word: string; startMs: number; endMs: number }
// One line as the aligner found it on the take (align_take.py).
export type AlignedLine = { id: string; say: string; words: AlignedWord[]; coverage: number; startMs: number; durationMs: number; review: string | null }

// The pinned aligner, shipped with the desktop skills.
const alignerPath = () => {
  const root = process.env.STUDIO_SKILLS_DIR
  return root ? join(root, 'explainer-master', 'scripts', 'align_take.py') : fileURLToPath(new URL('../../studio-desktop/skills/explainer-master/scripts/align_take.py', import.meta.url))
}

const streamsOf = async (path: string) =>
  (await runCommand('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', path], 30_000)).split('\n').map(line => line.trim()).filter(Boolean)

// The take as the product plays it everywhere: WebM with a VP8 picture at a
// constant 30 fps and Opus sound, with cues, so every player can seek it to
// any frame. A take with no picture keeps only its sound.
export const normalizeTake = async (input: string, output: string) => {
  const streams = await streamsOf(input)
  if (!streams.includes('audio')) throw new Error('the take has no sound to set the scene\'s clock')
  const picture = streams.includes('video')
  await runCommand('ffmpeg', [
    '-y', '-i', input,
    ...(picture ? ['-map', '0:v:0', '-vf', "scale='min(1920,iw)':-2,fps=30", '-c:v', 'libvpx', '-deadline', 'realtime', '-cpu-used', '8', '-b:v', '2500k', '-g', '15'] : ['-vn']),
    '-map', '0:a:0', '-c:a', 'libopus', '-b:a', '128k', '-ar', '48000',
    output,
  ], 600_000)
  return { picture, duration: Math.round((await probeSeconds(output)) * 1000) / 1000 }
}

// One frame of the take, for a producer to see the framing it works with.
export const takeFrame = async (input: string, seconds: number, output: string) => {
  await runCommand('ffmpeg', ['-y', '-ss', seconds.toFixed(2), '-i', input, '-frames:v', '1', '-vf', 'scale=640:-2', output], 60_000)
}

export const alignerAvailable = async () => access(alignerPath()).then(() => true, () => false)

// Aligns the take's speech to the plan's lines, in order, with the pinned
// aligner (faster-whisper through uv).
export const alignTake = async (audio: string, lines: TakeLine[]) => {
  const dir = await mkdtemp(join(tmpdir(), 'studio-take-align-'))
  try {
    const manifest = join(dir, 'take.json')
    await writeFile(manifest, JSON.stringify({ audio, beats: lines }))
    try {
      await runCommand('uv', ['run', '--with', 'faster-whisper==1.2.0', '--with', 'requests==2.32.5', 'python', alignerPath(), manifest], 600_000)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(/ENOENT/.test(message) ? 'aligning a take needs uv (https://docs.astral.sh/uv/), which runs the pinned speech aligner — install it and try again' : `the speech aligner failed: ${message}`)
    }
    return (JSON.parse(await readFile(join(dir, 'take.take-aligned.json'), 'utf8')) as { beats: AlignedLine[] }).beats
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

const round = (seconds: number) => Math.round(seconds * 1000) / 1000
// A moment shorter than this on the take is flagged: too quick to follow.
const TIGHT = 0.6
// A moment with no words needs at least this much of the take between the
// lines around it.
const QUIET = 0.5

export type TakeClock = {
  duration: number
  moments: Array<{ id: string; start: number; end: number }>
  // What each moment says, and where its words end on the take.
  spoken: Array<{ id: string; words: string; spokenEnd: number }>
  // What keeps the take from setting the clock: a line it does not say, a
  // silent moment it leaves no time for.
  problems: string[]
  // What the creator may want to look at: a line said differently, a moment
  // that passes very quickly.
  review: string[]
}

// Each moment's interval on the take. The first moment starts with the take,
// a spoken moment where its first word is heard, and a moment without words
// in the pause the take leaves for it. Every moment ends where the next one
// starts, and the last ends with the take.
export const takeClockOf = (moments: Array<{ id: string; say: string }>, aligned: AlignedLine[], duration: number): TakeClock => {
  const problems: string[] = []
  const review: string[] = []
  const found = new Map(aligned.map(line => [line.id, line]))
  const heard = moments.map(moment => {
    if (!moment.say) return null
    const line = found.get(moment.id)
    if (!line || line.coverage < 0.5 || !line.words.length) {
      problems.push(`moment ${moment.id}: the take does not say “${moment.say}”`)
      return null
    }
    if (line.review) review.push(`moment ${moment.id}: ${line.review}`)
    return { start: line.words[0].startMs / 1000, end: line.words[line.words.length - 1].endMs / 1000 }
  })
  if (problems.length) return { duration, moments: [], spoken: [], problems, review }
  const starts: number[] = new Array(moments.length).fill(0)
  let index = 0
  while (index < moments.length) {
    if (heard[index]) {
      starts[index] = index === 0 ? 0 : heard[index]!.start
      index += 1
      continue
    }
    // A run of moments without words shares the pause around it.
    let last = index
    while (last + 1 < moments.length && !heard[last + 1]) last += 1
    const before = index > 0 ? heard[index - 1]!.end : 0
    const after = last + 1 < moments.length ? heard[last + 1]!.start : duration
    const share = (after - before) / (last - index + 1)
    if (share < QUIET) problems.push(`${index === last ? `moment ${moments[index].id} has` : `moments ${moments.slice(index, last + 1).map(moment => moment.id).join(', ')} have`} no words, and the take leaves ${round(Math.max(0, after - before))}s for ${index === last ? 'it' : 'them'} — leave a pause for ${index === last ? 'it' : 'them'} in your take, or give ${index === last ? 'it' : 'them'} words in the plan`)
    for (let at = index; at <= last; at += 1) starts[at] = at === 0 ? 0 : round(before + share * (at - index))
    index = last + 1
  }
  const timed = moments.map((moment, at) => ({ id: moment.id, start: round(starts[at]), end: round(at + 1 < moments.length ? starts[at + 1] : duration) }))
  timed.forEach((moment, at) => {
    if (heard[at] && moment.end - moment.start < TIGHT) review.push(`moment ${moment.id} passes in ${round(moment.end - moment.start)}s on the take — quick for what it shows`)
  })
  for (let at = 1; at < timed.length; at += 1) if (timed[at].start < timed[at - 1].start) problems.push(`moment ${timed[at].id} is said before moment ${timed[at - 1].id} on the take`)
  return {
    duration,
    moments: timed,
    spoken: moments.map((moment, at) => ({ id: moment.id, words: moment.say, spokenEnd: round(heard[at] ? heard[at]!.end : timed[at].start) })),
    problems,
    review,
  }
}
