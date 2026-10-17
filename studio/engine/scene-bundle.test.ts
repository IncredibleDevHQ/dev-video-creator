import { expect, it, vi } from 'vitest'
import { parseHTML } from 'linkedom'
import { runInNewContext } from 'node:vm'
import type { Project, Scene } from '../shared/model'
vi.mock('./persistence', () => ({
  readAsset: async () => Buffer.from('fixture audio'),
  validObjectKey: () => true
}))
const { buildSceneBundle } = await import('../render/scene')
it('keeps a formatted document executable, preserving the timeline and inserted artwork', async () => {
  const scene: Scene = {
    id: 's',
    slideId: 'slide',
    phase: 'waiting',
    presence: null,
    inputKey: 'i',
    produced: null,
    error: null,
    moments: [
      {
        id: 'm',
        lines: 'Hello',
        start: 0,
        end: 4,
        camera: 'none',
        layout: 'corner',
        overlay: null,
        recordingKey: 'r',
        audioKey: 'a',
        audio: { inputKey: 'a', objectKey: 'a.wav', duration: 4 },
        take: null,
        media: { inputKey: 'a', clips: [] }
      }
    ]
  }
  const svg = '<svg><text>Hello  world</text></svg>'
  const project = {
    title: 'Fixture',
    slides: [{ id: 'slide', title: 'Fixture', svg }]
  } as Project
  const bundle = await buildSceneBundle(project, scene)
  const source = bundle['index.html'] as string
  expect(source).toContain(svg)
  const { document } = parseHTML(source)
  const script = document.querySelector('script:not([src])')!.textContent!
  const calls: unknown[][] = []
  const timeline = {
    fromTo: (...args: unknown[]) => {
      calls.push(args)
      return timeline
    },
    set: (...args: unknown[]) => {
      calls.push(args)
      return timeline
    },
    to: (...args: unknown[]) => {
      calls.push(args)
      return timeline
    }
  }
  const window: { __timelines?: Record<string, unknown> } = {}
  runInNewContext(script, { gsap: { timeline: () => timeline }, window })
  expect(window.__timelines!.s).toBe(timeline)
  expect(calls.at(-1)).toEqual([{}, { duration: 0.001 }, 3.999])
  expect(
    document
      .querySelector('[data-composition-id]')!
      .getAttribute('data-duration')
  ).toBe('4')
})
