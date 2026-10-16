import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NotebookSummary, Snapshot } from '../shared/api'
import type { MapEpisode, MapView } from '../shared/content-map'
import type { SeriesSummary } from '../shared/series'
import type { FrameSummary, Storyboard } from '../shared/storyboard'
import type { AppContext } from '../app/app-context'
import { DEFAULT_LENGTH, lengthLabel } from '../shared/length'
import { projectViews, videoDisplay } from '../shared/state'
import { Recording } from '../app/recording'
vi.mock('../app/api', () => ({
  api: { settings: vi.fn(() => new Promise(() => {})), load: vi.fn() }
}))
vi.mock('../app/http', () => ({ requestJson: vi.fn() }))
// DOMPurify needs a browser window; the article's own words are not checked.
vi.mock('../app/source-markdown', () => ({
  sourceMarkdown: (source: string) => `<p>${source}</p>`
}))
const { parseHTML } = await import('linkedom')
const { requestJson } = await import('../app/http')
const { storyboardHeader, storyboardScreen } =
  await import('../app/storyboard-view')
const { changeStoryboard, saveStoryboardRecording } =
  await import('../app/storyboard-controller')
const { videoHeader } = await import('../app/video-screen')
const { stageStatus } = await import('../app/stage-status')

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const doc = (html: string) => parseHTML(`<div>${html}</div>`).document

const frame = (number: number, duration: number): FrameSummary => ({
  number,
  title: `Frame ${number}`,
  scene: `What frame ${number} shows`,
  voiceover: `Line ${number} is spoken here.`,
  duration,
  transition:
    number === 1 ? 'cut' : number === 3 ? 'crossfade' : 'push-slide LEFT',
  type: 'hook',
  beat: 'curiosity',
  narrativeRole: `Why frame ${number} is there`,
  keyMessage: `Frame ${number} leaves this`,
  status: 'outline'
})

// Three scenes, the second on camera, as review 7 found it.
const storyboard = (change: Partial<Storyboard> = {}): Storyboard => ({
  id: 'sb-1',
  pages: ['p1', 'p2', 'p3'],
  stage: 'review',
  status: 'waiting',
  waitingFor: 'approval',
  plan: {
    message: 'A request has a timer; a stream doesn’t.',
    audience: 'developers new to streaming',
    structure: 'concept-explainer',
    hook: 'Rhetorical question',
    scenes: [
      {
        pageId: 'p1',
        build: 'faceless',
        buildReason: 'It explains.',
        frames: [frame(1, 4), frame(2, 6)]
      },
      {
        pageId: 'p2',
        build: 'camera',
        buildReason: 'It is the creator’s verdict.',
        take: null,
        frames: [frame(3, 5), frame(4, 3)]
      },
      {
        pageId: 'p3',
        build: 'motion',
        buildReason: 'It moves.',
        frames: [frame(5, 4)]
      }
    ]
  },
  updatedAt: '2026-10-15T00:00:00.000Z',
  ...change
})

const notebook = (value: Storyboard, id = 'n'): Snapshot => {
  const project = {
    id,
    title: 'Fixture',
    source: 'Fixture',
    slides: ['p1', 'p2', 'p3'].map((page) => ({
      id: page,
      title: `Page ${page}`,
      svg: `<svg id="${page}" viewBox="0 0 1280 720"></svg>`
    })),
    video: {
      settings: {
        presence: 'high',
        voice: { kind: 'ai', id: 'v' },
        production: 'storyboard'
      },
      scenes: [],
      transitions: [],
      inputKey: 'v',
      produced: null,
      storyboard: value
    }
  } as unknown as Snapshot['project']
  const snapshot: Snapshot = {
    project,
    status: 'ready',
    error: null,
    events: [],
    views: projectViews(project, [])
  }
  // As the engine sends it: the video's display worked out once.
  snapshot.views!.video.display = videoDisplay(snapshot)
  return snapshot
}
const idle = () =>
  new Recording(
    () => {},
    () => {}
  )
const page = (value: Storyboard, scene: number, at: number | null = null) =>
  doc(
    storyboardScreen(
      notebook(value),
      { projectId: 'n', scene, frame: at },
      idle(),
      null
    )
  )
const texts = (nodes: Iterable<Element>) =>
  [...nodes].map((node) => node.textContent?.trim())
const posed = (value: Storyboard) => ({
  ...value,
  plan: {
    ...value.plan!,
    scenes: value.plan!.scenes.map((scene) => ({
      ...scene,
      frames: scene.frames.map((entry) => ({
        ...entry,
        status: 'built' as const,
        still: `t${entry.number}`
      }))
    }))
  }
})

describe('the storyboard’s next step (UX-1)', () => {
  const header = (value: Storyboard) =>
    doc(storyboardHeader(notebook(value), value))

  it('puts the next step in the header, enabled, while the storyboard waits for the creator', () => {
    const plan = header(storyboard()).querySelector('button')
    expect(plan?.textContent).toBe('Approve the plan')
    expect(plan?.dataset.action).toBe('sb-approve')
    expect(plan?.classList.contains('primary')).toBe(true)
    expect(plan?.hasAttribute('disabled')).toBe(false)
    const stills = header(storyboard({ stage: 'board', approved: true }))
    expect(stills.querySelector('button')?.textContent).toBe(
      'Approve the stills'
    )
    const take = header(
      storyboard({ stage: 'voice', approved: true, waitingFor: 'takes' })
    ).querySelector('button')
    expect(take?.textContent).toBe('Record your take')
    expect(take?.dataset.action).toBe('sb-record')
    expect(take?.dataset.page).toBe('p2')
    expect(take?.hasAttribute('disabled')).toBe(false)
    const made = header(
      storyboard({
        stage: 'done',
        status: 'done',
        waitingFor: undefined,
        approved: true,
        produced: { objectKey: 'k.mp4', duration: 18 }
      })
    ).querySelector('button')
    expect(made?.textContent).toBe('Export MP4')
    expect(made?.hasAttribute('disabled')).toBe(false)
    // The video stage's header is this one.
    expect(videoHeader(notebook(storyboard()))).toContain(
      '>Approve the plan</button>'
    )
    // A made storyboard video is released as any video is (review 7).
    const released = videoHeader(
      notebook(
        storyboard({
          stage: 'done',
          status: 'done',
          waitingFor: undefined,
          approved: true,
          produced: { objectKey: 'k.mp4', duration: 18 }
        })
      )
    )
    expect(released).toContain('data-action="release-dialog"')
    expect(released).toContain('>Export MP4</button>')
  })

  it('plays back a take the creator only spoke, beside its buttons', () => {
    const spoken = storyboard({ stage: 'voice', approved: true })
    spoken.plan!.scenes[0].take = { objectKey: 'n/voice.webm', duration: 9 }
    const html = page(spoken, 0)
    const player = html.querySelector('.sb-take-actions audio')
    expect(player?.getAttribute('src')).toBe('/objects/n/voice.webm')
    // A camera take plays on the stage instead.
    const camera = storyboard({ stage: 'voice', approved: true })
    camera.plan!.scenes[1].take = { objectKey: 'n/take.webm', duration: 8 }
    expect(page(camera, 1).querySelector('.sb-take-actions audio')).toBeNull()
  })

  it('says a working stage as status text, never as a greyed button', () => {
    for (const stage of ['plan', 'stills', 'frames'] as const) {
      const value = storyboard({
        stage,
        status: 'working',
        waitingFor: undefined,
        approved: stage !== 'plan'
      })
      const html = header(value)
      expect(html.querySelector('button')).toBeNull()
      expect(html.querySelector('[role="status"]')?.textContent).toBe(
        videoDisplay(notebook(value)).label
      )
    }
    // Waiting, there is a step to take and no busy words.
    expect(header(storyboard()).querySelector('[role="status"]')).toBeNull()
  })

  it('names what the Video tab waits for in words, not as “0/1”', () => {
    const caption = (value: Storyboard) =>
      doc(stageStatus(notebook(value), 'video')).querySelector('.stage-caption')
        ?.textContent || ''
    expect(caption(storyboard())).toBe('plan to approve')
    expect(caption(storyboard({ stage: 'board', approved: true }))).toBe(
      'stills to approve'
    )
    expect(
      caption(
        storyboard({ stage: 'voice', approved: true, waitingFor: 'takes' })
      )
    ).toBe('takes needed')
    const working = caption(
      storyboard({
        stage: 'frames',
        status: 'working',
        waitingFor: undefined,
        approved: true
      })
    )
    expect(working).not.toMatch(/\d+\/\d+/)
    expect(working).not.toBe('')
  })
})

describe('the storyboard’s buttons (UX-2, UX-3, UX-4)', () => {
  it('puts Record and Upload on the camera scene’s stage, where its take goes', () => {
    const html = page(storyboard({ stage: 'voice', approved: true }), 1)
    const slot = html.querySelector('.sb-stage .sb-take-placeholder')
    expect(slot?.textContent).toContain('Your take goes here')
    expect(texts(slot!.querySelectorAll('button'))).toEqual([
      'Upload',
      'Record'
    ])
    const record = slot!.querySelector('[data-action="sb-record"]')
    expect(record?.getAttribute('data-page')).toBe('p2')
    const row = html.querySelector('.video-actions')!
    expect(row.querySelector('[data-action="sb-record"]')).toBeNull()
    expect(row.querySelector('[data-action="sb-upload"]')).toBeNull()
    // “← Wireframe” is the header tabs’ to do.
    expect(html.querySelector('[data-action="open-wireframe"]')).toBeNull()
  })

  it('ends the row with one secondary and one primary: Change the plan, then Approve', () => {
    const plan = page(storyboard(), 0).querySelector('.video-actions')!
    expect(texts(plan.querySelectorAll('button'))).toEqual([
      'Change the plan',
      'Approve the plan'
    ])
    expect(texts(plan.querySelectorAll('button.primary'))).toEqual([
      'Approve the plan'
    ])
    // A still on a camera scene's stage: its take buttons sit under it.
    const stills = page(
      posed(storyboard({ stage: 'board', approved: true })),
      1,
      3
    )
    const row = stills.querySelector('.video-actions')!
    expect(texts(row.querySelectorAll('button')).slice(-2)).toEqual([
      'Change the plan',
      'Approve the stills'
    ])
    expect(row.querySelectorAll('button.primary')).toHaveLength(1)
    expect(row.querySelector('[data-action^="sb-record"]')).toBeNull()
    expect(texts(stills.querySelectorAll('.sb-take-actions button'))).toEqual([
      'Upload',
      'Record'
    ])
  })

  it('keeps Record again and Upload under the stage once a take is made', () => {
    const value = storyboard({
      stage: 'frames',
      status: 'done',
      approved: true
    })
    value.plan!.scenes[1].take = { objectKey: 'take.webm', duration: 8 }
    const html = page(value, 1)
    expect(texts(html.querySelectorAll('.sb-take-actions button'))).toEqual([
      'Upload',
      'Record again'
    ])
    expect(html.querySelector('.sb-take-placeholder')).toBeNull()
  })

  it('stands a neutral outline in for the take, never a stranger’s photo', () => {
    const html = page(storyboard({ stage: 'voice', approved: true }), 1)
    const slot = html.querySelector('.sb-take-placeholder')!
    expect(html.querySelector('img[src*="presenter"]')).toBeNull()
    expect(slot.querySelector('img')).toBeNull()
    expect(slot.querySelector('svg')).not.toBeNull()
  })

  it('shows a camera glyph in the take placeholder', () => {
    const slot = page(
      storyboard({ stage: 'voice', approved: true }),
      1
    ).querySelector('.sb-take-placeholder')!
    const camera = [...slot.querySelectorAll('*')].some((node) =>
      /camera/i.test(
        `${node.getAttribute('class') || ''} ${node.getAttribute('aria-label') || ''}`
      )
    )
    expect(camera).toBe(true)
  })

  it('names the transition between frames in the rail’s words, not a bare arrow', () => {
    const html = page(storyboard({ stage: 'done', status: 'done' }), 1, 3)
    const mark = html.querySelector('.sb-strip [data-action="sb-transition"]')
    expect(mark?.textContent).toBe('Push left')
    expect(mark?.getAttribute('aria-label')).toBe('Into frame 4: Push left')
    expect(html.querySelector('.sb-strip')?.textContent).not.toContain('←')
  })
})

describe('a take upload (SB-6)', () => {
  const app = (snapshot: Snapshot) =>
    ({
      snapshot,
      sbRecord: { projectId: 'n', pageId: 'p2' },
      capture: {
        blob: new Blob(['take']),
        phase: 'reviewing',
        dispose: vi.fn()
      },
      render: vi.fn()
    }) as unknown as AppContext
  const later = () => {
    let finish!: (value: Snapshot) => void
    vi.mocked(requestJson).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve as (value: Snapshot) => void
        })
    )
    return (value: Snapshot) => finish(value)
  }

  it('keeps the notebook the creator went to when a recorded take returns', async () => {
    const context = app(notebook(storyboard()))
    const finish = later()
    const saving = saveStoryboardRecording(context)
    context.snapshot = notebook(storyboard(), 'other')
    finish(notebook(storyboard()))
    await saving
    expect(context.snapshot.project.id).toBe('other')
    // Still there, the saved notebook comes back as usual.
    const same = app(notebook(storyboard()))
    const done = later()
    const saved = saveStoryboardRecording(same)
    const fresh = notebook(storyboard({ updatedAt: 'later' }))
    done(fresh)
    await saved
    expect(same.snapshot).toBe(fresh)
    expect(same.sbRecord).toBeNull()
  })

  it('frees the recorder once a recorded take is saved, even after the creator left', async () => {
    const context = app(notebook(storyboard()))
    const finish = later()
    const saving = saveStoryboardRecording(context)
    context.snapshot = notebook(storyboard(), 'other')
    finish(notebook(storyboard()))
    await saving
    expect(context.capture.dispose).toHaveBeenCalledOnce()
    expect(context.sbRecord).toBeNull()
  })

  it('keeps the notebook the creator went to when an uploaded take file returns', async () => {
    const { document, window } = parseHTML('<input type="file">')
    vi.stubGlobal('HTMLSelectElement', window.HTMLSelectElement)
    vi.stubGlobal('HTMLInputElement', window.HTMLInputElement)
    const input = document.querySelector('input')!
    input.dataset.sbTakeFile = ''
    input.dataset.page = 'p2'
    Object.defineProperty(input, 'files', {
      value: [new File(['take'], 'take.webm', { type: 'video/webm' })]
    })
    const context = app(notebook(storyboard()))
    const finish = later()
    const upload = changeStoryboard(context, input)
    context.snapshot = notebook(storyboard(), 'other')
    finish(notebook(storyboard()))
    expect(await upload).toBe(true)
    expect(context.snapshot.project.id).toBe('other')
    expect(context.render).not.toHaveBeenCalled()
    const same = app(notebook(storyboard()))
    const done = later()
    const uploading = changeStoryboard(same, input)
    const fresh = notebook(storyboard({ updatedAt: 'later' }))
    done(fresh)
    await uploading
    expect(same.snapshot).toBe(fresh)
  })
})

describe('Home (UX-10, UX-11)', () => {
  const summary = (
    id: string,
    extra: Partial<NotebookSummary> = {}
  ): NotebookSummary => ({
    id,
    title: `Notebook ${id}`,
    status: 'ready',
    hasVideo: false,
    updatedAt: null,
    site: null,
    preview: null,
    slides: 3,
    ...extra
  })
  const notebooks = [
    summary('map', { title: 'Streamline' }),
    summary('e1', { title: 'Why it breaks', videoReady: true }),
    summary('e2', { title: 'Ship it', hasVideo: true }),
    summary('loose', { title: 'A loose notebook' })
  ]
  const series: SeriesSummary = {
    id: 's',
    title: 'Streamline in three episodes, from the outage to the fix',
    episodes: 2,
    planned: null,
    updatedAt: '',
    map: 'map',
    members: [
      { notebookId: 'e1', number: 1 },
      { notebookId: 'e2', number: 2 }
    ]
  }

  it('shows a series as one row: its map, then its episodes in order, with their state', async () => {
    const { seriesSection } = await import('../app/series-view')
    const html = doc(seriesSection([series], notebooks))
    const rows = html.querySelectorAll('.series-row')
    expect(rows).toHaveLength(1)
    expect(
      rows[0].querySelector('[data-action="open-series"]')?.textContent
    ).toBe(series.title)
    const entries = [...rows[0].querySelectorAll('ol > li button')]
    expect(
      entries.map((entry) => entry.querySelector('b')?.textContent)
    ).toEqual(['Content map', 'Episode 1', 'Episode 2'])
    expect(entries[0].getAttribute('data-map')).toBe('map')
    expect(entries.map((entry) => entry.getAttribute('data-notebook'))).toEqual(
      [null, 'e1', 'e2']
    )
    expect(
      entries.map((entry) => entry.querySelector('small')?.textContent)
    ).toEqual(['Wireframes ready', 'Video ready', 'Video in progress'])
    // In the words the notebook tiles use, never the raw status.
    const said = (status: NotebookSummary['status']) =>
      doc(
        seriesSection([series], [summary('e1', { status }), ...notebooks])
      ).querySelectorAll('ol > li small')[1]?.textContent
    expect(said('draft')).toBe('Ready to create wireframes')
    expect(said('reading')).toBe('Reading the source')
    expect(said('failed')).toBe('Needs another try')
  })

  it('keeps the series’ notebooks out of the loose ones, which come below', async () => {
    const { createRenderStartScreen } = await import('../app/start-controller')
    const { document } = parseHTML(
      '<html><body><div id="app"></div></body></html>'
    )
    vi.stubGlobal('document', document)
    const root = document.getElementById('app')!
    const app = {
      root,
      notebooks,
      series: [series],
      showAllRecent: false,
      pending: false,
      ago: () => ''
    } as unknown as AppContext
    createRenderStartScreen(app)()
    const sections = [...root.querySelectorAll('.saved-notebooks')]
    expect(
      sections.map((section) => section.classList.contains('saved-series'))
    ).toEqual([true, false])
    expect(
      [...sections[1].querySelectorAll('.notebook-tile')].map((tile) =>
        tile.getAttribute('data-notebook')
      )
    ).toEqual(['loose'])
  })

  it('forgets a notebook that is gone and leads home, without Try again', async () => {
    const { NotebookOpening, notebookOpeningView } =
      await import('../app/notebook-opening')
    const kept = new Map([['minimal-studio-project', 'gone']])
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => kept.get(key) ?? null,
      setItem: (key: string, value: string) => kept.set(key, value),
      removeItem: (key: string) => kept.delete(key)
    })
    const opening = new NotebookOpening(
      () => Promise.reject(new Error('Project not found')),
      () => {},
      () => {}
    )
    await opening.open('gone')
    expect(kept.has('minimal-studio-project')).toBe(false)
    const view = doc(notebookOpeningView(opening.state!))
    expect(view.querySelector('a[href="/"]')?.textContent).toBe(
      'Back to your notebooks'
    )
    expect(view.querySelector('[data-action="open-notebook"]')).toBeNull()
    expect(view.querySelector('main')?.textContent).not.toContain(
      'Project not found'
    )
    // A notebook that could not load for now keeps its link and Try again.
    kept.set('minimal-studio-project', 'saved')
    const down = new NotebookOpening(
      () => Promise.reject(new Error('Studio is unavailable.')),
      () => {},
      () => {}
    )
    await down.open('saved')
    expect(kept.get('minimal-studio-project')).toBe('saved')
    expect(notebookOpeningView(down.state!)).toContain(
      'data-action="open-notebook"'
    )
  })
})

describe('a notebook reading its link (UX-18)', () => {
  const reading = (source: string): Snapshot =>
    ({
      project: {
        id: 'r',
        title: 'Streams',
        source,
        sourceUrl: 'https://example.com/streams',
        slides: [],
        video: null,
        harness: { adapter: 'claude-code' }
      },
      status: 'reading',
      error: null,
      events: []
    }) as unknown as Snapshot

  it('says it is reading once, in the notebook, with the header’s own button and the pill’s dot', async () => {
    const { workspaceHeader } = await import('../app/workspace-header')
    const { notebookScreen } = await import('../app/notebook-screen')
    const snapshot = reading('https://example.com/streams')
    const header = workspaceHeader(snapshot, 'notebook', true)
    const body = notebookScreen(snapshot, false)
    expect(`${header}${body}`.match(/reading the source/gi)).toHaveLength(1)
    expect(doc(body).querySelector('.notebook-body')?.textContent).toContain(
      'Reading the source…'
    )
    const top = doc(header)
    const next = top.querySelector('.header-stage-actions button')
    expect(next?.textContent).toBe('Create wireframes →')
    expect(next?.hasAttribute('disabled')).toBe(true)
    const pill = top.querySelector('.agent-pill')!
    expect(pill.classList.contains('is-working')).toBe(true)
    expect(pill.querySelector('.agent-dot')).not.toBeNull()
    expect(pill.querySelector('.agent-activity')).toBeNull()
    expect(top.querySelector('[data-stage="presentation"]')?.textContent).toBe(
      'Wireframe'
    )
  })

  it('counts one word as a word', async () => {
    const { notebookScreen } = await import('../app/notebook-screen')
    const words = (source: string) =>
      doc(notebookScreen(reading(source), false)).querySelector(
        '.notebook-source span'
      )?.textContent
    expect(words('https://example.com/streams')).toBe('1 word')
    expect(words('Two words')).toBe('2 words')
  })
})

describe('Settings opened from the map (UX-7)', () => {
  it('opens at API keys with Back to the map, and Back goes there', async () => {
    const { Settings } = await import('../app/settings')
    const { document } = parseHTML(
      '<html><body><div id="app"></div></body></html>'
    )
    vi.stubGlobal('document', document)
    const root = document.getElementById('app')!
    const back = vi.fn()
    const go = vi.fn()
    const settings = new Settings(
      root,
      () => null,
      back,
      async () => {}
    )
    void settings.open('keys', { label: '← Back to the map', go })
    const close = root.querySelector('[data-action="close-settings"]')!
    expect(close.textContent).toBe('← Back to the map')
    expect(
      root
        .querySelector('[data-settings-panel="keys"]')
        ?.getAttribute('aria-current')
    ).toBe('page')
    ;(close as HTMLElement).click()
    expect(go).toHaveBeenCalledOnce()
    expect(back).not.toHaveBeenCalled()
    // Opened from a notebook, it goes back there as before.
    void settings.open('voice')
    expect(
      root.querySelector('[data-action="close-settings"]')?.textContent
    ).toBe('← Back to notebook')
    settings.close()
    expect(back).toHaveBeenCalledOnce()
    expect(go).toHaveBeenCalledOnce()
  })
})

describe('Studio AI without a key (CV-9)', () => {
  it('keeps nothing said while there is no key, so nothing goes later unasked', async () => {
    const { VoiceCall } = await import('../app/map-voice')
    const { document } = parseHTML(
      '<div class="map-page"><div class="map-stage"><button data-voice="talk"></button><div data-map-slot="menu" hidden></div></div></div>'
    )
    const root = document.querySelector('.map-page')!
    const map = {
      root,
      isOpen: true,
      slot: (name: string) => root.querySelector(`[data-map-slot="${name}"]`)
    }
    const voice = new VoiceCall(map as never)
    const inside = voice as unknown as { needsKey: boolean; waiting: string[] }
    inside.needsKey = true
    voice.say('About my comment on Ep 1: tighten it')
    expect(inside.waiting).toEqual([])
    expect(root.querySelector('[data-map-slot="menu"]')?.textContent).toContain(
      'Studio AI needs an OpenAI key'
    )
  })
})

describe('the tooltip (CV-10)', () => {
  it('hides when its control is redrawn under the pointer, or the pointer moves on', async () => {
    vi.useFakeTimers()
    const { document, window } = parseHTML(
      '<html><body><div class="dock"><button title="End the call">End</button></div><p>Canvas</p></body></html>'
    )
    vi.stubGlobal('document', document)
    vi.stubGlobal('addEventListener', window.addEventListener)
    vi.stubGlobal('MutationObserver', window.MutationObserver)
    vi.stubGlobal('innerWidth', 1280)
    vi.stubGlobal('innerHeight', 800)
    const { installTooltips } = await import('../app/tooltip')
    installTooltips()
    const over = (target: Element) => {
      const event = new window.Event('pointerover', { bubbles: true })
      Object.assign(event, { pointerType: 'mouse' })
      target.dispatchEvent(event)
      vi.advanceTimersByTime(400)
    }
    over(document.querySelector('.dock button')!)
    const tip = document.querySelector<HTMLElement>('.tooltip')!
    expect(tip.hidden).toBe(false)
    expect(tip.textContent).toBe('End the call')
    // The call's state changed: the dock is drawn again under the pointer.
    document.querySelector('.dock')!.innerHTML =
      '<button title="End the call">End</button>'
    await Promise.resolve()
    await Promise.resolve()
    expect(tip.hidden).toBe(true)
    over(document.querySelector('.dock button')!)
    expect(tip.hidden).toBe(false)
    over(document.querySelector('p')!)
    expect(tip.hidden).toBe(true)
  })
})

describe('the map’s words and places (UX-13, UX-16, UX-17)', () => {
  const lane: MapEpisode = {
    notebook: 'e1',
    number: 1,
    title: 'Why it breaks',
    status: 'ready',
    made: false,
    copies: [],
    video: null,
    teasers: [],
    posts: null
  }
  const map = {
    notebook: 'map',
    title: 'Streamline',
    series: {
      id: 's',
      title: 'Streamline',
      organize: true,
      directions: [],
      lines: [],
      gaps: [],
      flags: [],
      left: [],
      held: []
    },
    episodes: [lane],
    usage: {}
  } as MapView

  it('says why an episode runs outside the window, in words with an arrow (UX-16)', async () => {
    const { laneHead } = await import('../app/map-view')
    const runs = (seconds: number) =>
      doc(laneHead(map, { ...lane, seconds })).querySelector('.map-runs')!
    expect(runs(30).textContent).toBe(
      `${lengthLabel(30)} · under ${lengthLabel(DEFAULT_LENGTH.min)}`
    )
    expect(runs(200).textContent).toBe(
      `${lengthLabel(200)} · over ${lengthLabel(DEFAULT_LENGTH.max)}`
    )
    expect(runs(30).querySelector('.map-runs-arrow')).not.toBeNull()
    expect(runs(200).querySelector('.map-runs-arrow')).not.toBeNull()
    expect(runs(60).textContent).toBe(lengthLabel(60))
    expect(runs(60).querySelector('.map-runs-arrow')).toBeNull()
  })

  it('leaves every stage tab unselected on the map (UX-17)', async () => {
    const { mapStages } = await import('../app/map-view')
    const tabs = doc(
      mapStages(notebook(storyboard({ stage: 'done', status: 'done' })))
    ).querySelectorAll('button')
    expect(texts(tabs)).toEqual(['Notebook', 'Wireframe', 'Video'])
    expect([...tabs].some((tab) => tab.hasAttribute('aria-current'))).toBe(
      false
    )
  })

  it('puts the notes panel on the right, under its toggle (UX-13)', () => {
    const css = readFileSync(
      new URL('../app/styles/map-chrome.css', import.meta.url),
      'utf8'
    )
    const rule =
      /\.map-page\.is-notes-open \.map-rail \{([^}]*)\}/.exec(css)?.[1] || ''
    expect(rule).toMatch(/right:\s*12px/)
    expect(rule).toMatch(/left:\s*auto/)
  })
})
