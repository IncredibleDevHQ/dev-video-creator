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

const scene: Scene = {
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
const studio = dialogueStudio(
  document.querySelector('main') as unknown as HTMLElement,
  () => ({
    projectId: 'p',
    scene,
    index: 0,
    second: 0,
    busy: false,
    recording: false,
    label: '• Read along',
    animation
  }),
  () => {},
  () => {}
)

it('plays a moment before its scene has an animation, reading the words over the wireframe', () => {
  studio.mount()
  const $ = (name: string) =>
    document.querySelector(`[data-ds="${name}"]`) as HTMLElement
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
