import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { alignTake, normalizeTake, takeClockOf, type AlignedLine } from './take-clock'
import { probeSeconds, runCommand, systemVoiceAvailable } from './voice'

const line = (id: string, say: string, words: Array<[string, number, number]>, coverage = 1, review: string | null = null): AlignedLine =>
  ({ id, say, words: words.map(([word, startMs, endMs]) => ({ word, startMs, endMs })), coverage, startMs: words[0]?.[1] ?? 0, durationMs: 0, review })

// The take sets the clock: each moment from where its words are heard, a
// moment without words in the pause the take leaves it, the last to the end.
describe('the clock a take sets', () => {
  it('times each moment from its words, and a quiet moment in the pause around it', () => {
    const clock = takeClockOf(
      [{ id: 'm1', say: 'Requests arrive.' }, { id: 'm2', say: '' }, { id: 'm3', say: 'Load stays safe.' }],
      [line('m1', 'Requests arrive.', [['Requests', 800, 1200], ['arrive.', 1250, 1800]]), line('m3', 'Load stays safe.', [['Load', 4200, 4500], ['stays', 4550, 4800], ['safe.', 4850, 5300]])],
      7.5,
    )
    expect(clock.problems).toEqual([])
    // m1 opens the take; m2 has the pause between m1's last word and m3's first.
    expect(clock.moments).toEqual([{ id: 'm1', start: 0, end: 1.8 }, { id: 'm2', start: 1.8, end: 4.2 }, { id: 'm3', start: 4.2, end: 7.5 }])
    expect(clock.spoken).toEqual([{ id: 'm1', words: 'Requests arrive.', spokenEnd: 1.8 }, { id: 'm2', words: '', spokenEnd: 1.8 }, { id: 'm3', words: 'Load stays safe.', spokenEnd: 5.3 }])
  })

  it('names a line the take does not say, and never invents it', () => {
    const clock = takeClockOf(
      [{ id: 'm1', say: 'Requests arrive.' }, { id: 'm2', say: 'The limit bites.' }],
      [line('m1', 'Requests arrive.', [['Requests', 0, 400], ['arrive.', 450, 900]]), line('m2', 'The limit bites.', [], 0, 'The take does not say this here')],
      3,
    )
    expect(clock.moments).toEqual([])
    expect(clock.problems).toEqual(['moment m2: the take does not say “The limit bites.”'])
  })

  it('refuses a moment without words that the take leaves no time for, and flags a hurried one', () => {
    const tight = takeClockOf(
      [{ id: 'm1', say: 'Requests arrive.' }, { id: 'm2', say: '' }, { id: 'm3', say: 'Load stays safe.' }],
      [line('m1', 'Requests arrive.', [['Requests', 0, 400], ['arrive.', 450, 900]]), line('m3', 'Load stays safe.', [['Load', 1000, 1200], ['stays', 1210, 1300], ['safe.', 1310, 1400]], 0.7, 'The take does not say this here: "safe"')],
      2,
    )
    expect(tight.problems).toEqual([expect.stringMatching(/^moment m2 has no words, and the take leaves 0.1s for it — leave a pause for it in your take/)])
    const hurried = takeClockOf(
      [{ id: 'm1', say: 'Requests arrive.' }, { id: 'm2', say: 'Load stays safe.' }],
      [line('m1', 'Requests arrive.', [['Requests', 0, 400], ['arrive.', 450, 900]]), line('m2', 'Load stays safe.', [['Load', 1000, 1200]], 0.7, 'The take does not say this here: "stays safe"')],
      1.4,
    )
    expect(hurried.problems).toEqual([])
    expect(hurried.review).toEqual(['moment m2: The take does not say this here: "stays safe"', 'moment m2 passes in 0.4s on the take — quick for what it shows'])
  })
})

// The real path: a spoken take, normalized and aligned by the pinned aligner.
const uvAvailable = await runCommand('uv', ['--version'], 10_000).then(() => true, () => false)
describe.runIf(uvAvailable && (await systemVoiceAvailable()))('a spoken take', () => {
  it('is normalized into a seekable file and aligned to the plan\'s lines', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'take-clock-test-'))
    const voice = join(dir, 'voice.aiff')
    await runCommand('/usr/bin/say', ['-o', voice, 'Requests arrive at the limiter. [[slnc 900]] The limit bites, and the request is turned away.'])
    const take = join(dir, 'take.mp4')
    await runCommand('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=24', '-i', voice, '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', take])
    const normalized = join(dir, 'take.webm')
    const made = await normalizeTake(take, normalized)
    expect(made.picture).toBe(true)
    expect(Math.abs(made.duration - (await probeSeconds(take)))).toBeLessThan(0.15)
    const lines = [{ id: 'm1', say: 'Requests arrive at the limiter.' }, { id: 'm2', say: 'The limit bites, and the request is turned away.' }]
    const aligned = await alignTake(normalized, lines)
    const clock = takeClockOf(lines, aligned, made.duration)
    expect(clock.problems).toEqual([])
    expect(clock.moments[0].start).toBe(0)
    // The second line starts after the pause the take left.
    expect(clock.moments[1].start).toBeGreaterThan(clock.spoken[0].spokenEnd + 0.5)
    expect(clock.moments[1].end).toBe(made.duration)
  }, 300_000)
})
