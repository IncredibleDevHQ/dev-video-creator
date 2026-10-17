import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, expect, it, vi } from 'vitest'
import type { EpisodeFrame } from './voice'

// Review 8, round 3: Stop ends the voice between lines, so the production
// stops while the voice is recorded, not in the stage after it. The voice
// is a stand-in: no line is spoken.
const { spoken } = vi.hoisted(() => ({ spoken: vi.fn() }))
vi.mock('../voice', async (original) => ({
  ...(await original<typeof import('../voice')>()),
  narrationClock: spoken
}))
const { prepareEpisodeAudio } = await import('./voice')

const dir = await mkdtemp(join(tmpdir(), 'voice-stop-'))
afterAll(() => rm(dir, { recursive: true, force: true }))

const frame = (number: number): EpisodeFrame => ({
  number,
  title: `Frame ${number}`,
  scene: 'A card',
  voiceover: `Line ${number}.`,
  duration: 2,
  transition: 'cut',
  type: 'hook',
  persuasion: 'Before/after',
  beat: 'tension',
  narrativeRole: 'Shows it',
  keyMessage: 'It is so',
  build: 'faceless',
  pageId: 'p1'
})

it('speaks no further line once the creator has pressed Stop', async () => {
  await expect(
    prepareEpisodeAudio({
      dir,
      frames: [frame(1), frame(2)],
      voice: {},
      takes: {},
      captures: {},
      stopped: async () => true
    })
  ).rejects.toThrow('Stopped while the voice was recorded')
  expect(spoken).not.toHaveBeenCalled()
})
