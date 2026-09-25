import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { narrationClock, probeSeconds, systemVoiceAvailable } from './voice'

// The scene's clock from its narration: spoken where there are words,
// measured, silence for a moment with none, joined into one track.
describe.runIf(await systemVoiceAvailable())('a generated narration clock', () => {
  it('measures each moment and joins them into one track that keeps the clock', async () => {
    const clock = await narrationClock([
      { id: 'm1', text: 'A token bucket refills at a steady rate.', estimate: 3 },
      { id: 'm2', text: '', estimate: 1.5 },
      { id: 'm3', text: 'Each request spends one token.', estimate: 3 },
    ])
    expect(clock.moments.map(moment => moment.id)).toEqual(['m1', 'm2', 'm3'])
    // Contiguous, each longer than its settle, the silent one its estimate.
    expect(clock.moments[0].start).toBe(0)
    for (let i = 1; i < clock.moments.length; i += 1) expect(clock.moments[i].start).toBe(clock.moments[i - 1].end)
    expect(clock.moments[0].spokenEnd - clock.moments[0].start).toBeGreaterThan(1)
    expect(clock.moments[1].spokenEnd - clock.moments[1].start).toBeCloseTo(1.5, 1)
    expect(clock.moments[1].words).toBe('')
    expect(clock.duration).toBe(clock.moments[2].end)
    // The encoded track is the clock, within a frame or two.
    const dir = mkdtempSync(join(tmpdir(), 'voice-test-'))
    writeFileSync(join(dir, 'narration.mp3'), clock.audio)
    expect(Math.abs((await probeSeconds(join(dir, 'narration.mp3'))) - clock.duration)).toBeLessThan(0.12)
  }, 60_000)
})
