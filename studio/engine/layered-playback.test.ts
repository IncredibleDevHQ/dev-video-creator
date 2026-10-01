import { parseHTML } from 'linkedom'
import { afterEach, expect, it, vi } from 'vitest'
import { layeredControls, layeredPlayback } from '../app/layered-playback'
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
it('uses one canvas transport for the saved recording and synchronizes the content clock', () => {
  const { document, window, Event } = parseHTML(
    `<html><body><div id="app"><div class="video-stage"><svg></svg><div class="presenter-preview"><video data-saved-presenter></video></div>${layeredControls()}</div></div></body></html>`
  )
  vi.stubGlobal('window', window)
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 1)
  )
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  const root = document.querySelector('#app') as unknown as HTMLElement,
    media = root.querySelector('video')!
  Object.assign(media, {
    duration: 28,
    currentTime: 0,
    paused: true,
    ended: false,
    muted: false,
    play: vi.fn(async () => {}),
    pause: vi.fn()
  })
  const sync = vi.fn(),
    paint = layeredPlayback(root, sync)
  paint()
  root.querySelector<HTMLElement>('[data-layered-play]')!.click()
  expect(media.play).toHaveBeenCalledOnce()
  const seek = root.querySelector<HTMLInputElement>('[data-layered-seek]')!
  seek.value = '50'
  seek.dispatchEvent(new Event('input', { bubbles: true }))
  expect(media.currentTime).toBe(14)
  expect(sync).toHaveBeenLastCalledWith(14, false)
  root.querySelector<HTMLElement>('[data-layered-mute]')!.click()
  expect(media.muted).toBe(true)
  expect(root.querySelector('[data-layered-time]')!.textContent).toBe(
    '0:14 / 0:28'
  )
  const stage = root.querySelector('.video-stage')!
  Object.assign(stage, { requestFullscreen: vi.fn(async () => {}) })
  root.querySelector<HTMLElement>('[data-layered-fullscreen]')!.click()
  expect(stage.requestFullscreen).toHaveBeenCalledOnce()
})

it('reviews a fresh WebM using recorded duration before container metadata is finite', () => {
  const { document, window, Event } = parseHTML(
    `<html><body><div id="app"><video data-take-player data-review-duration="12.5"></video>${layeredControls()}</div></body></html>`
  )
  vi.stubGlobal('window', window)
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 1)
  )
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  const root = document.querySelector('#app') as unknown as HTMLElement,
    media = root.querySelector('video')!
  Object.assign(media, {
    duration: Infinity,
    currentTime: 0,
    paused: true,
    ended: false,
    muted: false
  })
  layeredPlayback(root, vi.fn())()
  expect(root.querySelector('[data-layered-time]')!.textContent).toBe(
    '0:00 / 0:12'
  )
  const seek = root.querySelector<HTMLInputElement>('[data-layered-seek]')!
  expect(seek.disabled).toBe(false)
  seek.value = '50'
  seek.dispatchEvent(new Event('input', { bubbles: true }))
  expect(media.currentTime).toBe(6.25)
})
