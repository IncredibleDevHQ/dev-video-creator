import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { FrameSummary, Storyboard } from '../shared/storyboard'
import type { AppContext } from '../app/app-context'
import { TAKE_TYPES } from '../shared/storyboard'
import { projectViews, videoDisplay } from '../shared/state'
import { Recording } from '../app/recording'
vi.mock('../app/api', () => ({
  api: {
    approveStoryboard: vi.fn(),
    retryStoryboard: vi.fn(),
    noteStoryboardFrame: vi.fn(),
    setStoryboardBuild: vi.fn()
  }
}))
vi.mock('../app/http', () => ({ requestJson: vi.fn() }))
const { parseHTML } = await import('linkedom')
const { api } = await import('../app/api')
const { requestJson } = await import('../app/http')
const { storyboardScreen } = await import('../app/storyboard-view')
const { changeStoryboard, clickStoryboard, submitStoryboard } =
  await import('../app/storyboard-controller')
// The independent audit's look at the storyboard page: a voice-only take
// under review, the take file picker, and answers that come back after the
// creator went to another notebook. Fixtures only: the page's plumbing.

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetAllMocks()
})

const frame = (number: number): FrameSummary => ({
  number,
  title: `Frame ${number}`,
  scene: `What frame ${number} shows`,
  voiceover: `Line ${number} is spoken here.`,
  duration: 4,
  transition: 'cut',
  type: 'hook',
  beat: 'curiosity',
  narrativeRole: `Why frame ${number} is there`,
  keyMessage: `Frame ${number} leaves this`,
  status: 'outline'
})

// Recorded voice: the faceless scene waits for its spoken take, the camera
// scene for its video.
const storyboard = (): Storyboard => ({
  id: 'sb-1',
  pages: ['p1', 'p2'],
  stage: 'voice',
  status: 'waiting',
  waitingFor: 'takes',
  approved: true,
  plan: {
    message: 'A request has a timer; a stream doesn’t.',
    audience: 'developers',
    structure: 'concept-explainer',
    hook: 'Rhetorical question',
    scenes: [
      {
        pageId: 'p1',
        build: 'faceless',
        buildReason: 'It explains.',
        take: null,
        frames: [frame(1), frame(2)]
      },
      {
        pageId: 'p2',
        build: 'camera',
        buildReason: 'It is the creator’s verdict.',
        take: null,
        frames: [frame(3)]
      }
    ]
  },
  updatedAt: '2026-10-16T00:00:00.000Z'
})

const notebook = (id = 'n'): Snapshot => {
  const project = {
    id,
    title: 'Fixture',
    source: 'Fixture',
    slides: ['p1', 'p2'].map((page) => ({
      id: page,
      title: `Page ${page}`,
      svg: `<svg id="${page}" viewBox="0 0 1280 720"></svg>`
    })),
    video: {
      settings: {
        presence: 'high',
        voice: { kind: 'record' },
        production: 'storyboard'
      },
      scenes: [],
      transitions: [],
      inputKey: 'v',
      produced: null,
      storyboard: storyboard()
    }
  } as unknown as Snapshot['project']
  const snapshot: Snapshot = {
    project,
    status: 'ready',
    error: null,
    events: [],
    views: projectViews(project, [])
  }
  snapshot.views!.video.display = videoDisplay(snapshot)
  return snapshot
}

const page = (scene: number, capture: Recording, recordPage: string | null) =>
  parseHTML(
    `<div>${storyboardScreen(
      notebook(),
      { projectId: 'n', scene, frame: null },
      capture,
      recordPage
    )}</div>`
  ).document

/** A take just recorded, waiting to be saved or recorded again. */
const reviewing = () => {
  const capture = new Recording(
    () => {},
    () => {}
  )
  capture.phase = 'reviewing'
  capture.url = 'blob:take-under-review'
  return capture
}
const idle = () =>
  new Recording(
    () => {},
    () => {}
  )

describe('a take under review, and the take picker (independent audit)', () => {
  it('plays a voice-only take under review, as a camera take plays on the stage', () => {
    const spoken = page(0, reviewing(), 'p1')
    expect(
      spoken.querySelector('audio[data-sb-take]')?.getAttribute('src')
    ).toBe('blob:take-under-review')
    expect(spoken.querySelector('[data-action="save-take"]')).not.toBeNull()
    // A camera take keeps its own player on the stage, and no second one.
    const camera = page(1, reviewing(), 'p2')
    expect(
      camera.querySelector('video[data-sb-take]')?.getAttribute('src')
    ).toBe('blob:take-under-review')
    expect(camera.querySelector('audio')).toBeNull()
  })

  it('offers only the files the engine takes for the scene: video on camera, sound for a spoken scene', () => {
    const accept = (scene: number) =>
      page(scene, idle(), null)
        .querySelector('[data-sb-take-file]')!
        .getAttribute('accept')!
        .split(',')
    const taken = Object.keys(TAKE_TYPES)
    expect(accept(1)).toEqual(taken.filter((t) => t.startsWith('video/')))
    expect(accept(0)).toEqual(taken.filter((t) => t.startsWith('audio/')))
  })

  it('sends a picked .m4a or .wav under the name the engine takes it by', async () => {
    const { document, window } = parseHTML('<input type="file">')
    vi.stubGlobal('HTMLSelectElement', window.HTMLSelectElement)
    vi.stubGlobal('HTMLInputElement', window.HTMLInputElement)
    const input = document.querySelector('input')!
    input.dataset.sbTakeFile = ''
    input.dataset.page = 'p1'
    const sent: string[] = []
    vi.mocked(requestJson).mockImplementation(async (_url, options) => {
      sent.push((options!.headers as Record<string, string>)['Content-Type'])
      return notebook() as never
    })
    for (const [name, type] of [
      ['memo.m4a', 'audio/x-m4a'],
      ['take.wav', 'audio/x-wav'],
      ['take.webm', 'video/webm']
    ]) {
      Object.defineProperty(input, 'files', {
        value: [new File(['take'], name, { type })],
        configurable: true
      })
      const app = { snapshot: notebook(), render: vi.fn() }
      await changeStoryboard(app as unknown as AppContext, input)
    }
    expect(sent).toEqual(['audio/mp4', 'audio/wav', 'video/webm'])
    for (const type of sent) expect(TAKE_TYPES).toHaveProperty([type])
  })
})

describe('storyboard answers after the creator left (independent audit)', () => {
  const app = () =>
    ({
      snapshot: notebook(),
      capture: { phase: 'idle' },
      dialog: { close: vi.fn() },
      render: vi.fn()
    }) as unknown as AppContext & { dialog: { close: () => void } }
  /** The next answer from the engine, held until the test gives it. */
  const later = (method: keyof typeof api) => {
    let finish!: (value: Snapshot) => void
    vi.mocked(api[method]).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }) as never
    )
    return (value: Snapshot) => finish(value)
  }

  it('keeps the notebook the creator went to when Approve or Try again answers', async () => {
    for (const [action, method] of [
      ['sb-approve', 'approveStoryboard'],
      ['sb-retry', 'retryStoryboard']
    ] as const) {
      const context = app()
      const finish = later(method)
      const target =
        parseHTML('<button></button>').document.querySelector('button')!
      const clicked = clickStoryboard(context, target as never, action)
      context.snapshot = notebook('other')
      finish(notebook())
      await clicked
      expect(context.snapshot.project.id).toBe('other')
    }
  })

  it('keeps the other notebook, and its dialog, when a change to the plan or a still answers', async () => {
    for (const [form, method] of [
      [{ id: 'storyboard-change', dataset: {} }, 'approveStoryboard'],
      [
        { id: 'storyboard-still', dataset: { number: '2' } },
        'noteStoryboardFrame'
      ]
    ] as const) {
      const context = app()
      const finish = later(method)
      const submitted = submitStoryboard(
        context,
        form as never,
        {
          get: () => 'Open on the numbers'
        } as never
      )
      context.snapshot = notebook('other')
      finish(notebook())
      await submitted
      expect(context.snapshot.project.id).toBe('other')
      expect(context.dialog.close).not.toHaveBeenCalled()
    }
    // Still there, the answer shows and its dialog closes.
    const same = app()
    const finish = later('approveStoryboard')
    const fresh = notebook()
    const submitted = submitStoryboard(
      same,
      { id: 'storyboard-change', dataset: {} } as never,
      { get: () => 'Open on the numbers' } as never
    )
    finish(fresh)
    await submitted
    expect(same.snapshot).toBe(fresh)
    expect(same.dialog.close).toHaveBeenCalledOnce()
  })

  it('keeps the other notebook when a scene’s new build answers', async () => {
    const { document, window } = parseHTML(
      '<select data-sb-build data-page="p1"><option value="motion" selected>Motion</option></select>'
    )
    vi.stubGlobal('HTMLSelectElement', window.HTMLSelectElement)
    vi.stubGlobal('HTMLInputElement', window.HTMLInputElement)
    const context = app()
    const finish = later('setStoryboardBuild')
    const changed = changeStoryboard(context, document.querySelector('select')!)
    context.snapshot = notebook('other')
    finish(notebook())
    expect(await changed).toBe(true)
    expect(context.snapshot.project.id).toBe('other')
    expect(context.render).not.toHaveBeenCalled()
  })
})
