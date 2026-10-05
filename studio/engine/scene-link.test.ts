import { expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { Scene } from '../shared/model'
import { projectViews } from '../shared/state'
vi.mock('../app/api', () => ({ api: {} }))
const { sceneBadge, sceneLink, sceneChoice } = await import('../app/scene-link')
const { presentationScreen } = await import('../app/presentation-screen')

const scene = (id: string, phase: Scene['phase']): Scene => ({
  id: `scene-${id}`,
  slideId: id,
  phase,
  presence: null,
  moments: [
    {
      id: 'm1',
      lines: 'Synthetic fixture line.',
      start: 0,
      end: 54,
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
  produced:
    phase === 'produced' ? { inputKey: 'i', objectKey: `${id}.mp4` } : null,
  error: null
})
const snapshot = (video: boolean): Snapshot => {
  const project: Snapshot['project'] = {
    id: 'n',
    title: 'Fixture',
    source: 'Fixture',
    slides: ['a', 'b', 'c'].map((id) => ({
      id,
      title: `Wireframe ${id}`,
      svg: '<svg viewBox="0 0 1280 720"></svg>'
    })),
    video: video
      ? {
          settings: { presence: 'off', voice: { kind: 'ai', id: 'v' } },
          scenes: [
            scene('a', 'idle'),
            scene('b', 'produced'),
            scene('c', 'writing')
          ],
          transitions: ['none', 'none'],
          inputKey: 'v',
          produced: null
        }
      : null
  }
  return {
    project,
    status: 'ready',
    error: null,
    events: [],
    views: projectViews(project, [])
  }
}

it('marks each wireframe with where its scene stands', () => {
  const made = snapshot(true)
  expect(sceneBadge(made, 'a')).toContain('No scene')
  expect(sceneBadge(made, 'a')).toContain('is-none')
  expect(sceneBadge(made, 'b')).toContain('Scene ready')
  expect(sceneBadge(made, 'c')).toContain('Making scene')
  // Before there is a video, a wireframe has no scene to mark.
  expect(sceneBadge(snapshot(false), 'a')).toBe('')
})

it('says under the wireframe where its scene is, and plays it once made', () => {
  const made = snapshot(true)
  const left = sceneLink(made, 0, true)
  expect(left.line).toContain('Scene 1 is not in the video')
  expect(left.line).toContain(
    'data-action="make-scene" data-scene-id="scene-a"'
  )
  expect(left.pip).toBe('')
  const ready = sceneLink(made, 1, true)
  expect(ready.line).toContain('Scene 2 ready · 0:54')
  expect(ready.line).toContain('data-action="open-scene"')
  expect(ready.pip).toContain(
    '<video class="scene-pip-video" src="/objects/b.mp4"'
  )
  expect(ready.pip).toContain('data-action="pip-toggle"')
  // Folded, the picture-in-picture is a chip.
  expect(sceneLink(made, 1, false).pip).toContain('scene-pip-chip')
  expect(sceneLink(made, 2, true).line).toContain('Open in Video')
  expect(sceneLink(snapshot(false), 0, true).line).toContain(
    'data-action="make-video-one"'
  )
})

it('ticks every wireframe for a new video, or only the one asked for', () => {
  const slides = snapshot(false).project.slides
  const ticked = (html: string) =>
    [...html.matchAll(/value="(\w)" data-scene-index="\d" checked/g)].map(
      (match) => match[1]
    )
  expect(ticked(sceneChoice(slides, 1, false))).toEqual(['a', 'b', 'c'])
  expect(ticked(sceneChoice(slides, 1, true))).toEqual(['b'])
  expect(sceneChoice(slides, 1, true)).toContain('Just wireframe 2')
  expect(sceneChoice(slides, null, false)).not.toContain('Just wireframe')
})

it('puts the scene badge on the tiles and the scene under the wireframe', () => {
  const html = presentationScreen(snapshot(true), 1)
  expect(html.match(/class="scene-badge/g)).toHaveLength(3)
  expect(html).toContain('class="scene-pip"')
  expect(html).toContain('class="scene-line is-ready"')
})
