// The voice the product speaks, and the clock it gives a scene (P4).
//
// A scene whose delivery is a generated voice is spoken moment by moment
// from its approved plan's narration, each clip measured, and joined into
// one track with a short settle after each moment. That track is the
// scene's clock: every moment's interval is read off it, and production
// keeps to it. Nothing here estimates speech: a moment the plan gives no
// words holds silence for the plan's estimate, and says so.
import { spawn } from 'node:child_process'
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const runCommand = (command: string, args: string[], timeoutMs = 120_000) =>
  new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    let errors = ''
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error(`${command} timed out`))
    }, timeoutMs)
    child.stdout.on('data', chunk => (output += chunk.toString()))
    child.stderr.on('data', chunk => (errors += chunk.toString()))
    child.on('error', reject)
    child.on('close', code => {
      clearTimeout(timer)
      if (code === 0) resolve(output)
      else reject(new Error(errors.trim().split('\n').slice(-3).join(' ') || `${command} exited with ${code}`))
    })
  })

const exists = async (path: string) => access(path).then(() => true, () => false)

export const systemVoiceAvailable = async () => process.platform === 'darwin' && (await exists('/usr/bin/say'))

export const generateSystemVoice = async (text: string, outputPath: string) => {
  if (!(await systemVoiceAvailable())) {
    throw new Error('No keyless system voice is available. Configure FISH_AUDIO_API_KEY or use microphone audio.')
  }
  const intermediatePath = outputPath.replace(/\.mp3$/, '.aiff')
  await runCommand('/usr/bin/say', ['-o', intermediatePath, text])
  try {
    await runCommand('ffmpeg', ['-y', '-i', intermediatePath, '-codec:a', 'libmp3lame', '-q:a', '2', outputPath])
  } finally {
    await rm(intermediatePath, { force: true })
  }
}

export const generateFishVoice = async (text: string, referenceId: string, outputPath: string) => {
  const apiKey = process.env.FISH_AUDIO_API_KEY
  if (!apiKey) throw new Error('FISH_AUDIO_API_KEY is not configured')
  const response = await fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      model: process.env.FISH_AUDIO_MODEL || 's2.1-pro',
    },
    body: JSON.stringify({
      text,
      reference_id: referenceId,
      format: 'mp3',
      normalize: true,
      prosody: { speed: 1, volume: 0, normalize_loudness: true },
    }),
  })
  if (!response.ok) throw new Error(`Fish Audio failed (${response.status})`)
  await writeFile(outputPath, Buffer.from(await response.arrayBuffer()))
}

// A media file's length, as ffprobe reads it.
export const probeSeconds = async (path: string) => {
  const output = await runCommand('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path], 30_000)
  const seconds = Number(output.trim())
  if (!Number.isFinite(seconds)) throw new Error(`ffprobe could not read the length of ${path}`)
  return seconds
}

const round = (seconds: number) => Math.round(seconds * 1000) / 1000

export type NarrationLine = { id: string; text: string; estimate: number }
export type NarrationClock = {
  audio: Buffer
  duration: number
  provider: string
  // Each moment on the voice's clock: where it starts, where its words end,
  // and where it ends after its settle.
  moments: Array<{ id: string; start: number; spokenEnd: number; end: number; words: string }>
}

// Speaks each moment's words, measures them, and joins them into one track.
// The moments are measured as uncompressed audio, so their boundaries are
// exact; the track is encoded once at the end.
export const narrationClock = async (lines: NarrationLine[], options: { referenceId?: string; settle?: number } = {}): Promise<NarrationClock> => {
  const fish = Boolean(options.referenceId && process.env.FISH_AUDIO_API_KEY)
  const provider = fish ? 'Fish Audio authorized voice' : 'Local system voice'
  const settle = options.settle ?? 0.4
  const dir = await mkdtemp(join(tmpdir(), 'studio-narration-'))
  try {
    const silence = async (path: string, seconds: number) =>
      runCommand('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', seconds.toFixed(3), '-c:a', 'pcm_s16le', path])
    const parts: string[] = []
    const moments: NarrationClock['moments'] = []
    let at = 0
    for (const [index, line] of lines.entries()) {
      const spoken = join(dir, `m${index}.wav`)
      const words = line.text.trim()
      if (words) {
        const clip = join(dir, `m${index}.mp3`)
        if (fish) await generateFishVoice(words, options.referenceId!, clip)
        else await generateSystemVoice(words, clip)
        await runCommand('ffmpeg', ['-y', '-i', clip, '-ar', '44100', '-ac', '1', '-c:a', 'pcm_s16le', spoken])
      } else {
        await silence(spoken, Math.max(0.5, line.estimate))
      }
      const length = await probeSeconds(spoken)
      const gap = join(dir, `g${index}.wav`)
      await silence(gap, settle)
      parts.push(spoken, gap)
      moments.push({ id: line.id, start: round(at), spokenEnd: round(at + length), end: round(at + length + settle), words })
      at = round(at + length + settle)
    }
    const list = join(dir, 'parts.txt')
    await writeFile(list, parts.map(path => `file '${path.replace(/'/g, "'\\''")}'`).join('\n'))
    const output = join(dir, 'narration.mp3')
    await runCommand('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c:a', 'libmp3lame', '-q:a', '2', output])
    const audio = await readFile(output)
    // The encoded track may run a frame long; the clock is the measured moments.
    return { audio, duration: round(at), provider, moments }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
