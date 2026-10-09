import { expect, it, vi } from 'vitest'
import { syncRehearsalAnimation } from '../app/rehearsal-animation'
import type { Scene } from '../shared/model'
it('plays saved animation on the moment clock and holds its final frame for a longer take', () => {
  const player = {
    readyState: 1,
    currentTime: 0,
    playbackRate: 1,
    play: vi.fn(async () => {}),
    pause: vi.fn()
  }
  const root = { querySelector: () => player } as unknown as ParentNode
  const scene = {
    animationKey: 'key',
    animation: { inputKey: 'key', moments: [{ id: 'one', start: 0, end: 4 }] },
    moments: [{ id: 'one', start: 0, end: 8 }]
  } as Scene
  syncRehearsalAnimation(root, scene, 0, 2, true)
  expect(player.currentTime).toBe(1)
  expect(player.playbackRate).toBe(0.5)
  expect(player.play).toHaveBeenCalledOnce()
  syncRehearsalAnimation(root, scene, 0, 10, true)
  expect(player.currentTime).toBeCloseTo(3.85)
  expect(player.pause).toHaveBeenCalledOnce()
  syncRehearsalAnimation(root, scene, 0, 0, false)
  expect(player.currentTime).toBe(0)
  expect(player.pause).toHaveBeenCalledTimes(2)
})

it('pauses at the hold boundary instead of repeatedly drifting into the next moment', () => {
  const player = {
    readyState: 1,
    currentTime: 3.7,
    playbackRate: 1,
    play: vi.fn(async () => {}),
    pause: vi.fn()
  }
  const scene = {
    animationKey: 'key',
    animation: { inputKey: 'key', moments: [{ id: 'one', start: 0, end: 4 }] },
    moments: [{ id: 'one', start: 0, end: 4 }]
  } as Scene
  syncRehearsalAnimation(
    { querySelector: () => player } as unknown as ParentNode,
    scene,
    0,
    3.7,
    true
  )
  expect(player.play).not.toHaveBeenCalled()
  expect(player.pause).toHaveBeenCalledOnce()
  expect(player.currentTime).toBe(3.7)
})
it('does not seek again when a paused hold frame is already decoded', () => {
  let at = 3.7
  const seek = vi.fn()
  const player = {
    readyState: 4,
    get currentTime() {
      return at
    },
    set currentTime(value: number) {
      seek(value)
      at = value
    },
    playbackRate: 1,
    play: vi.fn(async () => {}),
    pause: vi.fn()
  }
  const scene = {
    animationKey: 'key',
    animation: { inputKey: 'key', moments: [{ id: 'one', start: 0, end: 4 }] },
    moments: [{ id: 'one', start: 0, end: 4 }]
  } as Scene
  for (let i = 0; i < 20; i++)
    syncRehearsalAnimation(
      { querySelector: () => player } as unknown as ParentNode,
      scene,
      0,
      3.7,
      true
    )
  expect(seek).not.toHaveBeenCalled()
  expect(player.play).not.toHaveBeenCalled()
})

it('does not interrupt an unfinished seek when the dialogue clock advances', () => {
  let at = 33
  const seek = vi.fn()
  const player = {
    readyState: 2,
    seeking: true,
    paused: true,
    get currentTime() {
      return at
    },
    set currentTime(value: number) {
      seek(value)
      at = value
    },
    playbackRate: 1,
    play: vi.fn(async () => {}),
    pause: vi.fn()
  }
  const scene = {
    animation: { moments: [{ start: 33, end: 39 }] },
    moments: [{ start: 48, end: 54 }]
  } as Scene
  for (let i = 0; i < 30; i++)
    syncRehearsalAnimation(
      { querySelector: () => player } as unknown as ParentNode,
      scene,
      0,
      48 + i / 10,
      true
    )
  expect(seek).not.toHaveBeenCalled()
  expect(player.play).not.toHaveBeenCalled()
  player.seeking = false
  syncRehearsalAnimation(
    { querySelector: () => player } as unknown as ParentNode,
    scene,
    0,
    51,
    true
  )
  expect(seek).toHaveBeenCalledOnce()
  expect(player.play).toHaveBeenCalledOnce()
})
