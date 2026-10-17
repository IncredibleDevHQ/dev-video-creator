import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { EpisodePlan, PlanFrame, Storyboard } from '../shared/storyboard'
// Review 8, F10, round 1: the episode's planning hands the planner the
// creator's material (the source with its notes), and a frame whose own
// words still promise past it after the rewrite is flagged on that frame of
// the plan the creator approves; a new plan is flagged afresh. The planner
// and the stages after it are stand-ins: these prove the plumbing only.
const { planned, posed } = vi.hoisted(() => ({
  planned: vi.fn(),
  posed: vi.fn()
}))
vi.mock('./storyboard/plan', async (original) => ({
  ...(await original<typeof import('./storyboard/plan')>()),
  planEpisode: planned,
  blueprintIds: () => []
}))
vi.mock('./storyboard/stills-stage', () => ({ stillsStage: posed }))
const { writeRow } = await import('./persistence')
const { changeProject, loadProject } = await import('./projects')
const { scheduleStoryboard, settledStoryboard, storyboardDir } =
  await import('./storyboard/pipeline')
const { approveStoryboard } = await import('./storyboard/actions')

const NOTE = 'Do not promise that an old retry will be deduplicated forever.'
const frame = (number: number, voiceover: string): PlanFrame => ({
  number,
  title: `Frame ${number}`,
  scene: `What frame ${number} shows`,
  voiceover,
  duration: 3,
  transition: 'cut',
  type: 'hook',
  persuasion: 'Before/after',
  beat: 'tension',
  narrativeRole: 'Shows it',
  keyMessage: 'It is so'
})
const plan: EpisodePlan = {
  message: 'A timeout is ambiguous',
  audience: 'developers',
  structure: 'story-explainer',
  hook: 'Stakes / consequence',
  direction: { palette: 'ink', motion: 'reveal', held: 'none', never: 'none' },
  scenes: [
    {
      pageId: 'p1',
      build: 'faceless',
      buildReason: 'It explains',
      frames: [
        frame(1, 'The first line.'),
        frame(
          2,
          'Next time, a key means a retry can never pour a second latte.'
        )
      ]
    }
  ]
}
const claim = {
  word: 'never',
  sentence: plan.scenes[0].frames[1].voiceover,
  limit: { says: NOTE, from: 'the note of 17 October 2026' }
}

it('hands the planner the creator’s material, and flags on its frame what still promises past it', async () => {
  const board: Storyboard = {
    id: 'sb-flag',
    pages: ['p1'],
    stage: 'plan',
    status: 'working',
    updatedAt: '2026-10-17T00:00:00.000Z'
  }
  await writeRow('projects', 'flag', {
    project: {
      id: 'flag',
      title: 'Fixture',
      source: `Keys and retries.\n\n## Note, 17 October 2026\n\n${NOTE}`,
      harness: { adapter: 'claude-code' },
      slides: [
        {
          id: 'p1',
          title: 'A timeout',
          svg: '<svg/>',
          narration: 'The first line.'
        }
      ],
      video: {
        settings: {
          presence: 'off',
          voice: { kind: 'ai', id: 'default' },
          production: 'storyboard'
        },
        scenes: [],
        transitions: [],
        inputKey: 'v',
        produced: null,
        storyboard: board
      }
    },
    status: 'ready',
    error: null,
    events: []
  } as unknown as Snapshot)
  const dir = storyboardDir('flag', board)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'frame.md'), '# Frame\n')
  planned.mockResolvedValue({
    plan,
    length: { min: 10, max: 60, strict: false },
    brief: '# Brief\n',
    claims: [{ number: 2, claim }]
  })
  posed.mockResolvedValue('stop')
  scheduleStoryboard('flag')
  await settledStoryboard('flag')
  const given = planned.mock.calls[0][0] as {
    material: Array<{ text: string; from: string }>
  }
  expect(given.material).toContainEqual({
    text: NOTE,
    from: 'the note of 17 October 2026',
    by: 'creator'
  })
  const waiting = (await loadProject('flag'))!.project.video!.storyboard!
  expect(waiting.stage).toBe('review')
  expect(waiting.plan!.scenes[0].frames.map((f) => f.claim)).toEqual([
    undefined,
    `It says “never”; the note of 17 October 2026 says “${NOTE}”`
  ])
  // Kept, then planned again with a change: the new plan is flagged afresh.
  await changeProject('flag', (current) => {
    current.project.video!.storyboard!.keptClaims = [2]
  })
  await approveStoryboard('flag', { note: 'Shorter, please' })
  await settledStoryboard('flag')
  const again = (await loadProject('flag'))!.project.video!.storyboard!
  expect(again.keptClaims).toBeUndefined()
  expect(again.plan!.scenes[0].frames[1].claim).toBe(
    `It says “never”; the note of 17 October 2026 says “${NOTE}”`
  )
})
