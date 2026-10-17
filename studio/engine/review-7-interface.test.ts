import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { MapView } from '../shared/content-map'
import type { FrameSummary, Storyboard } from '../shared/storyboard'
import type { MapCanvas as Canvas } from '../app/map-canvas'
import { projectViews, videoDisplay } from '../shared/state'
vi.mock('../app/api', () => ({
  api: { load: vi.fn(), subscribe: vi.fn(() => () => {}) }
}))
vi.mock('../app/map-api', () => ({
  mapApi: {
    view: vi.fn(),
    comments: vi.fn(async () => ({ comments: [] }))
  }
}))
const { parseHTML } = await import('linkedom')
const { api } = await import('../app/api')
const { mapApi } = await import('../app/map-api')
const { MapCanvas } = await import('../app/map-canvas')
const { logoContrast } = await import('../app/look-panel')
const { storyboardHeader } = await import('../app/storyboard-view')
const { installTooltips } = await import('../app/tooltip')
const { button } = await import('../app/ui')
// The independent audit's look at the interface: the logo warning, a remade
// episode's header, the Add menu's toggle, a map that is gone and Talk's
// tooltip. linkedom stand-ins: these check the plumbing, not a browser.

const doc = (html: string) => parseHTML(`<div>${html}</div>`).document

describe('the logo warning (independent audit)', () => {
  /** A logo of one colour, every pixel opaque. */
  const solid = (hex: string) => {
    const rgb = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16))
    return Array.from({ length: 4 }, () => [...rgb, 255]).flat()
  }

  it('warns of a logo under 3:1 contrast with the ground, a yellow or light grey one on white among them', () => {
    // About 1.5:1 and 1.6:1: hard to see, though far from white.
    expect(logoContrast(solid('#ffcf5c'), '#ffffff')).toBe(0)
    expect(logoContrast(solid('#cccccc'), '#ffffff')).toBe(0)
    // A navy wordmark on a dark chip, as before.
    expect(logoContrast(solid('#0a2540'), '#2b2f36')).toBe(0)
    // Navy on white, and a mid grey at 4.5:1: plain to see.
    expect(logoContrast(solid('#0a2540'), '#ffffff')).toBe(1)
    expect(logoContrast(solid('#767676'), '#ffffff')).toBe(1)
  })
})

describe('a remade episode’s header (independent audit)', () => {
  const frame = (number: number): FrameSummary => ({
    number,
    title: `Frame ${number}`,
    scene: 'What it shows',
    voiceover: `Line ${number}.`,
    duration: 4,
    transition: number === 1 ? 'cut' : 'crossfade',
    type: 'hook',
    beat: 'curiosity',
    narrativeRole: 'Why it is there',
    keyMessage: 'What it leaves',
    status: 'animated'
  })
  const made = (change: Partial<Storyboard>): Storyboard => ({
    id: 'sb',
    pages: ['p1'],
    stage: 'done',
    status: 'done',
    approved: true,
    produced: { objectKey: 'old.mp4', duration: 8 },
    plan: {
      message: 'A request has a timer',
      audience: 'developers',
      structure: 'concept-explainer',
      hook: 'Question',
      scenes: [
        {
          pageId: 'p1',
          build: 'faceless',
          buildReason: 'It explains.',
          frames: [frame(1), frame(2)]
        }
      ]
    },
    updatedAt: 'now',
    ...change
  })
  const header = (value: Storyboard) => {
    const project = {
      id: 'n',
      title: 'Fixture',
      source: 'Fixture',
      slides: [{ id: 'p1', title: 'p1', svg: '<svg/>' }],
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
    snapshot.views!.video.display = videoDisplay(snapshot)
    return doc(
      storyboardHeader(snapshot, value, button('Release', 'release-dialog'))
    )
  }

  it('offers no Export or Release of the last cut while a transition change puts the episode together again', () => {
    const again = header(made({ stage: 'assemble', status: 'working' }))
    expect(again.querySelector('[data-action="produce-video"]')).toBeNull()
    expect(again.querySelector('[data-action="release-dialog"]')).toBeNull()
    expect(again.querySelector('[role="status"]')?.textContent).toBe(
      'Assembling and checking'
    )
    // Made again: both come back, for the new cut.
    const done = header(made({}))
    expect(done.querySelector('[data-action="produce-video"]')).not.toBeNull()
    expect(done.querySelector('[data-action="release-dialog"]')).not.toBeNull()
  })
})

describe('the take’s place (independent audit)', () => {
  it('sizes its outline only, so the camera cue beside its words keeps its icon', () => {
    const css = ['record', 'storyboard']
      .map((name) =>
        readFileSync(
          new URL(`../app/styles/${name}.css`, import.meta.url),
          'utf8'
        )
      )
      .join('\n')
    // A rule for every svg inside shrank the cue's icon to a dot.
    expect(css).not.toMatch(/\.take-placeholder svg\s*\{/)
    const outline = /\.take-placeholder > svg \{([^}]*)\}/.exec(css)?.[1]
    expect(outline).toMatch(/width:\s*30%/)
  })
})

const view = (): MapView => ({
  notebook: 'map',
  title: 'Streamline',
  series: {
    lines: [],
    gaps: [],
    flags: [],
    left: [],
    held: [],
    id: 's',
    title: 'Streamline',
    organize: true,
    directions: []
  },
  episodes: [],
  usage: {},
  comments: []
})
const snapshot = (): Snapshot => ({
  project: {
    id: 'map',
    title: 'Streamline',
    source: '',
    video: null,
    slides: [{ id: 'a', title: 'Page a', svg: '<svg/>' }]
  },
  status: 'ready',
  error: null,
  events: []
})

let win = parseHTML('')
const maps: Canvas[] = []
afterEach(() => {
  for (const map of maps.splice(0)) map.dismiss()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.resetAllMocks()
})
const openMap = async (id = 'map', from = id) => {
  win = parseHTML('<html><body><div id="app"></div></body></html>')
  vi.stubGlobal('document', win.document)
  vi.stubGlobal('window', win)
  vi.stubGlobal('addEventListener', win.addEventListener)
  vi.stubGlobal('location', new URL('http://localhost:4194/'))
  vi.stubGlobal('history', { replaceState: () => {} })
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} })
  vi.stubGlobal('requestAnimationFrame', () => 0)
  vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.stubGlobal('fetch', vi.fn())
  vi.stubGlobal('MutationObserver', win.MutationObserver)
  const hooks = { close: vi.fn(), openKeys: vi.fn(), error: vi.fn() }
  const map = new MapCanvas(win.document.getElementById('app')!, hooks as never)
  maps.push(map)
  vi.mocked(api.load).mockImplementation(async (asked: string) => {
    if (asked !== 'map') throw new Error('Project not found')
    return snapshot()
  })
  vi.mocked(mapApi.view).mockImplementation(async () => view())
  vi.mocked(mapApi.comments).mockImplementation(async () => ({
    comments: []
  }))
  await map.open(id, from)
  return { map, hooks, root: map.root }
}
const fire = (target: EventTarget, type: string, extra: object = {}) => {
  const event = new win.Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, extra)
  target.dispatchEvent(event)
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 5))

describe('the map’s Add menu and a map that is gone (independent audit)', () => {
  it('closes the Add menu with a second click on +, as toggles do', async () => {
    const { map, root } = await openMap()
    const add = root.querySelector<HTMLElement>('[data-map="add"]')!
    add.click()
    await settle()
    expect(map.slot('menu')?.hidden).toBe(false)
    add.click()
    await settle()
    expect(map.slot('menu')?.hidden).toBe(true)
    add.click()
    await settle()
    expect(map.slot('menu')?.hidden).toBe(false)
  })

  it('says a map that no longer exists is gone, with the way home, never Loading…', async () => {
    const { root, hooks } = await openMap('deleted')
    expect(root.querySelector('h1')?.textContent).toBe('This map is gone')
    expect(root.querySelector('a.opening-home')?.getAttribute('href')).toBe('/')
    expect(root.textContent).not.toContain('Loading…')
    expect(hooks.error).not.toHaveBeenCalled()
  })

  it('says why a map didn’t open, with Try again, when the studio can’t be reached', async () => {
    const { map, root, hooks } = await openMap()
    vi.mocked(api.load).mockRejectedValueOnce(
      new Error(
        'Studio is unavailable. Check that it is running, then try again.'
      )
    )
    await map.open('offline', 'e1')
    expect(root.querySelector('h1')?.textContent).toBe('The map didn’t open')
    expect(root.querySelector('p')?.textContent).toContain(
      'Studio is unavailable'
    )
    expect(root.querySelector('a.opening-retry')?.getAttribute('href')).toBe(
      '/?map=offline'
    )
    expect(root.querySelector('a.opening-home')?.getAttribute('href')).toBe(
      '/?notebook=e1'
    )
    expect(root.textContent).not.toContain('Loading…')
    // Said once, on the page.
    expect(hooks.error).not.toHaveBeenCalled()
  })

  it('offers the way back to the episode a gone map was opened from', async () => {
    const { root } = await openMap('deleted', 'e1')
    const back = root.querySelector('a.opening-home')!
    expect(back.textContent).toBe('Back to the notebook')
    expect(back.getAttribute('href')).toBe('/?notebook=e1')
  })
})

describe('Talk’s tooltip (independent audit)', () => {
  it('says Talk’s new words at once when the key goes missing while its tooltip shows', async () => {
    const { map, root } = await openMap()
    vi.stubGlobal('innerWidth', 1440)
    vi.stubGlobal('innerHeight', 900)
    vi.useFakeTimers()
    installTooltips()
    const talk = root.querySelector<HTMLElement>('[data-voice="talk"]')!
    fire(talk, 'pointerover')
    vi.advanceTimersByTime(400)
    const tip = win.document.querySelector<HTMLElement>('.tooltip')!
    expect(tip.hidden).toBe(false)
    expect(tip.textContent).toContain('Talk to Studio AI')
    // The engine says there is no key: the call ends and Talk asks for one.
    ;(map.voice as unknown as { needsKey: boolean }).needsKey = true
    map.voice.paint()
    expect(tip.textContent).toContain('needs an OpenAI key')
    // The pointer leaves: the title it gets back says the same.
    fire(talk, 'pointerout')
    expect(tip.hidden).toBe(true)
    expect(talk.getAttribute('title')).toContain('needs an OpenAI key')
    expect(talk.classList.contains('is-setup')).toBe(true)
  })
})
