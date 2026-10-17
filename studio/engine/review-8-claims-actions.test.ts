import { beforeEach, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
// Review 8, F10, round 1: each flag's two answers, where the creator meets
// it, ask the studio for the right thing: a segue line on its wireframe, a
// frame in the storyboard plan, a post in Release. The network is a
// stand-in: these checks prove what the buttons ask for.
const { mapApi, api, studioApi } = vi.hoisted(() => ({
  mapApi: { segueCheck: vi.fn() },
  api: { keepFrameClaim: vi.fn(), approveStoryboard: vi.fn() },
  studioApi: { notebook: vi.fn() }
}))
vi.mock('../app/map-api', () => ({ mapApi }))
vi.mock('../app/api', () => ({ api }))
vi.mock('../app/studio-api', () => ({ studioApi }))
vi.mock('../app/release-view', () => ({
  releaseDialog: () => '',
  releaseBusy: () => false
}))
vi.mock('../app/campaign-view', () => ({ campaignSection: () => '' }))
vi.mock('../app/numbers-view', () => ({ numbersSection: () => '' }))
const { clickSlides } = await import('../app/slides-controller')
const { clickStoryboard } = await import('../app/storyboard-controller')
const { clickRelease } = await import('../app/release-controller')

const NOTE = 'It says “never”; the note says “Do not promise…”'
const snapshot = {
  project: {
    id: 'ep',
    title: 'One click, two lattes',
    source: '',
    slides: [{ id: 'y', title: 'A timeout is ambiguous', svg: '<svg/>' }],
    video: {
      settings: { presence: 'off', voice: { kind: 'ai', id: 'v' } },
      scenes: [],
      transitions: [],
      inputKey: '',
      produced: null,
      storyboard: {
        id: 'sb',
        pages: ['y'],
        stage: 'review',
        status: 'waiting',
        waitingFor: 'approval',
        plan: {
          scenes: [{ pageId: 'y', frames: [{ number: 3, claim: NOTE }] }]
        },
        updatedAt: ''
      }
    }
  },
  status: 'ready',
  error: null,
  events: []
} as unknown as Snapshot
const appOf = () => ({
  snapshot,
  selected: 0,
  capture: { phase: 'idle' },
  render: vi.fn(),
  showDialog: vi.fn(),
  dialog: { open: false, scrollTop: 0, dataset: {} }
})
const button = (data: Record<string, string>) =>
  ({ dataset: data, disabled: false }) as unknown as HTMLButtonElement
beforeEach(() => {
  for (const fn of [
    mapApi.segueCheck,
    api.keepFrameClaim,
    api.approveStoryboard,
    studioApi.notebook
  ])
    fn.mockReset().mockResolvedValue(snapshot)
})

it('asks for a flagged segue line to be written again, or kept, from its wireframe', async () => {
  const app = appOf()
  await clickSlides(
    app as never,
    button({ slide: 'y', line: 'outro' }),
    'segue-again'
  )
  expect(mapApi.segueCheck).toHaveBeenCalledWith('ep', {
    slide: 'y',
    line: 'outro'
  })
  await clickSlides(
    app as never,
    button({ slide: 'y', line: 'outro' }),
    'segue-keep'
  )
  expect(mapApi.segueCheck).toHaveBeenLastCalledWith('ep', {
    slide: 'y',
    line: 'outro',
    keep: true
  })
  expect(app.render).toHaveBeenCalledTimes(2)
})

it('sends the plan back with a flagged frame named, or keeps the frame’s words', async () => {
  const app = appOf()
  expect(
    await clickStoryboard(
      app as never,
      button({ number: '3' }),
      'sb-claim-again'
    )
  ).toBe(true)
  expect(api.approveStoryboard).toHaveBeenCalledWith(
    'ep',
    `Frame 3: ${NOTE}. Say it within that limit, or leave the promise out.`
  )
  await clickStoryboard(app as never, button({ number: '3' }), 'sb-claim-keep')
  expect(api.keepFrameClaim).toHaveBeenCalledWith('ep', 3)
})

it('keeps a flagged post from Release', async () => {
  await clickRelease(
    appOf() as never,
    button({ channel: 'linkedin' }),
    'keep-post-check'
  )
  expect(studioApi.notebook).toHaveBeenCalledWith('ep', 'release', {
    keepCheck: 'linkedin'
  })
})
