import { parseHTML } from 'linkedom'
import { afterAll, expect, it, vi } from 'vitest'
import type { Scene } from '../shared/model'

// The practice view's read-along, in a DOM without layout: the few browser
// APIs it measures with are stubbed, and the clock is faked.
const { window, document } = parseHTML(
  '<main><div class="stage-area"><div class="stage video-stage"><svg></svg></div><div class="video-actions"></div></div></main>'
)
const rect = () => ({ top: 0, bottom: 100, left: 0, right: 100 })
Object.assign(window.HTMLElement.prototype, { getBoundingClientRect: rect })
Object.assign(globalThis, {
  window,
  document,
  ResizeObserver: class {
    observe() {}
    disconnect() {}
  },
  getComputedStyle: () => ({
    paddingLeft: '0',
    paddingRight: '0',
    paddingTop: '0',
    paddingBottom: '0'
  }),
  getSelection: () => null
})
vi.mock('../app/api', () => ({ api: {} }))
vi.useFakeTimers({ toFake: ['performance', 'setTimeout', 'clearTimeout'] })
// Node has no animation frames: one every 16 ms of the fake clock.
Object.assign(globalThis, {
  requestAnimationFrame: (step: (at: number) => void) =>
    setTimeout(() => step(performance.now()), 16),
  cancelAnimationFrame: (id: ReturnType<typeof setTimeout>) => clearTimeout(id)
})
afterAll(() => vi.useRealTimers())
const { dialogueStudio } = await import('../app/dialogue-studio')

let scene: Scene = {
  id: 'scene',
  slideId: 'slide',
  phase: 'waiting',
  presence: null,
  moments: [
    {
      id: 'm1',
      lines: 'One two three four five six seven eight.',
      start: 0,
      end: 4,
      camera: 'none',
      layout: 'corner',
      overlay: null,
      recordingKey: 'r',
      take: null,
      audio: null,
      audioKey: 'a'
    }
  ],
  inputKey: 'i',
  produced: null,
  error: null
}

let animation: 'none' | 'making' | 'ready' = 'none'
let index = 0,
  second = 0,
  scope: 'moment' | 'scene' | undefined
// The page around the studio: it renders again whenever it changes.
const studio = dialogueStudio(
  document.querySelector('main') as unknown as HTMLElement,
  () => ({
    projectId: 'p',
    scene,
    index,
    second,
    busy: false,
    recording: false,
    label: '• Read along',
    animation,
    scope
  }),
  (at) => (second = at),
  () => {},
  {
    scope: (next) => {
      scope = next
      studio.mount()
    },
    // The page shows the moment's number without drawing again.
    moment: (next) => {
      index = next
    },
    // Picking a moment to practise draws the page again.
    pick: (next) => {
      index = next
      second = scene.moments[next].start
      studio.mount()
    }
  }
)
const $ = (name: string) =>
  document.querySelector(`[data-ds="${name}"]`) as HTMLElement
const click = (element: Element) =>
  element.dispatchEvent(new window.Event('click', { bubbles: true }))

it('plays a moment before its scene has an animation, reading the words over the wireframe', () => {
  studio.mount()
  // A disabled Play, with nothing to say why, was the bug.
  expect($('play').hasAttribute('disabled')).toBe(false)
  expect($('remaining').textContent).toBe(
    'No animation yet · the words play over the wireframe'
  )
  expect($('animation').textContent).toContain(
    'Wireframe · animation not made yet'
  )
  // The way to the animation is right there.
  const make = document.querySelector('[data-ds-make]') as HTMLElement
  expect(make.getAttribute('data-action')).toBe('make-animation')
  expect(make.hasAttribute('hidden')).toBe(false)
  $('play').dispatchEvent(new window.Event('click', { bubbles: true }))
  vi.advanceTimersByTime(2000)
  expect(studio.isPlaying()).toBe(true)
  expect($('play').textContent).toBe('Ⅱ Pause')
  expect($('time').textContent).toBe('0:02.0 / 0:04.0')
  expect(document.querySelectorAll('[data-ds-word].read').length).toBe(4)
  vi.advanceTimersByTime(2500)
  expect(studio.isPlaying()).toBe(false)
  expect($('play').textContent).toBe('▶ Replay')
  expect($('time').textContent).toBe('0:04.0 / 0:04.0')
})

it('says the animation is being made, and stops offering to make it', () => {
  animation = 'making'
  studio.mount()
  expect(document.querySelector('[data-ds="remaining"]')!.textContent).toBe(
    'Making the animation… it plays here when ready'
  )
  expect(document.querySelector('[data-ds-make]')!.hasAttribute('hidden')).toBe(
    true
  )
})

it('plays the whole scene as one timeline, one moment into the next', () => {
  animation = 'none'
  const moment = scene.moments[0]
  scene = {
    ...scene,
    id: 'whole',
    moments: [
      { ...moment, id: 'w1', lines: 'One two.', start: 0, end: 2 },
      { ...moment, id: 'w2', lines: 'Three four five.', start: 2, end: 5 },
      { ...moment, id: 'w3', lines: 'Six.', start: 5, end: 6 }
    ]
  }
  // Recording has no choice to make; practice does.
  studio.mount()
  expect($('scope').hidden).toBe(true)
  scope = 'moment'
  studio.mount()
  expect($('scope').hidden).toBe(false)
  const choice = (name: string) =>
    document.querySelector(`[data-ds-scope="${name}"]`)!
  expect(choice('moment').getAttribute('aria-pressed')).toBe('true')
  // Icons, named for a screen reader and the hover label: the whole scene
  // first, as it is the default.
  expect(
    [...document.querySelectorAll('[data-ds-scope]')].map((button) => [
      button.getAttribute('aria-label'),
      button.querySelector('svg') !== null,
      button.textContent
    ])
  ).toEqual([
    ['Whole scene', true, ''],
    ['This moment', true, '']
  ])
  // One moment keeps the scene's map, a spotlight on its part.
  expect([$('zoom').hidden, $('spot').hidden]).toEqual([false, false])
  expect(document.querySelectorAll('[data-ds-moment]').length).toBe(3)
  // Play stops at the moment's end, on the scene's clock.
  click($('play'))
  vi.advanceTimersByTime(2500)
  expect([index, studio.isPlaying(), $('play').textContent]).toEqual([
    0,
    false,
    '▶ Replay'
  ])
  expect($('time').textContent).toBe('0:02.0 / 0:06.0')
  click(choice('scene'))
  expect(scope).toBe('scene')
  expect(choice('scene').getAttribute('aria-pressed')).toBe('true')
  // The whole scene on one timeline: its moments are parts of it, cut
  // apart by a line, and the read-along holds every moment's words.
  const panel = document.querySelector('.dialogue-studio')
  const blocks = () => [...document.querySelectorAll('[data-ds-moment]')]
  expect(blocks().map((block) => block.getAttribute('style'))).toEqual([
    'left:0%;width:33.33333333333333%',
    'left:33.33333333333333%;width:50%',
    'left:83.33333333333334%;width:16.666666666666664%'
  ])
  expect(document.querySelectorAll('[data-ds="cuts"] > i').length).toBe(2)
  expect($('words').textContent).toBe('1One two. 2Three four five. 3Six.')
  expect($('time').textContent).toBe('0:02.0 / 0:06.0')
  expect($('zoom').hidden).toBe(false)
  // Play goes on from where it is, through every moment, without a new panel.
  click($('play'))
  vi.advanceTimersByTime(500)
  expect([index, studio.isPlaying()]).toEqual([1, true])
  expect($('time').textContent).toBe('0:02.5 / 0:06.0')
  expect(blocks()[1].classList.contains('is-current')).toBe(true)
  expect($('remaining').textContent).toBe(
    'No animation yet · the words play over the wireframe'
  )
  vi.advanceTimersByTime(2600)
  expect([index, studio.isPlaying()]).toEqual([2, true])
  expect(document.querySelector('.dialogue-studio')).toBe(panel)
  expect(document.querySelector('[data-ds-word].current')!.textContent).toBe(
    'Six.'
  )
  vi.advanceTimersByTime(1200)
  expect([index, studio.isPlaying()]).toEqual([2, false])
  expect($('time').textContent).toBe('0:06.0 / 0:06.0')
  expect($('play').textContent).toBe('▶ Replay scene')
  // Replay starts the scene again from its first moment.
  click($('replay'))
  expect([index, studio.isPlaying()]).toEqual([0, true])
  vi.advanceTimersByTime(1000)
  expect($('time').textContent).toBe('0:01.0 / 0:06.0')
  click($('play'))
  expect(studio.isPlaying()).toBe(false)
  // Any moment is one click away on the timeline.
  click(blocks()[2])
  expect([index, studio.isPlaying()]).toEqual([2, false])
  expect($('time').textContent).toBe('0:05.0 / 0:06.0')
  // Zoom in for detail, and fit the whole scene again.
  const zoom = (name: string) =>
    document.querySelector(`[data-ds-zoom="${name}"]`) as HTMLButtonElement
  expect([zoom('out').disabled, zoom('in').disabled]).toEqual([true, false])
  click(zoom('in'))
  expect($('timeline').style.width).toBe('960px')
  expect(zoom('out').disabled).toBe(false)
  click(zoom('fit'))
  expect($('timeline').style.width).toBe('600px')
  // Back to one moment: picking another on the map practises it alone.
  click(choice('moment'))
  click(blocks()[1])
  expect([index, $('time').textContent]).toEqual([1, '0:02.0 / 0:06.0'])
  expect($('spot').style.getPropertyValue('--from')).toBe('33.33333333333333%')
  expect(document.querySelector('.dialogue-studio')).toBe(panel)
  click($('play'))
  vi.advanceTimersByTime(3500)
  expect([index, studio.isPlaying(), $('time').textContent]).toEqual([
    1,
    false,
    '0:05.0 / 0:06.0'
  ])
  expect($('play').textContent).toBe('▶ Replay')
})
