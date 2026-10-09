import { expect, it } from 'vitest'
import { workspacePosition, workspaceUrl } from '../app/workspace-position'
import type { Project } from '../shared/model'
const project = {
  video: {
    scenes: [
      { id: 'first', moments: [{ id: 'a', start: 0 }] },
      {
        id: 'recorded',
        moments: [
          { id: 'intro', start: 0 },
          { id: 'outro', start: 28 }
        ]
      }
    ]
  }
} as Project
it('returns to the same recorded scene and moment after reload, using stable IDs', () => {
  const url = workspaceUrl(
    new URL('http://localhost/?notebook=p'),
    project,
    'video',
    1,
    1
  )
  expect(workspacePosition(project, url)).toEqual({
    selected: 1,
    momentIndex: 1,
    second: 28
  })
  project.video!.scenes.reverse()
  expect(workspacePosition(project, url)).toEqual({
    selected: 0,
    momentIndex: 1,
    second: 28
  })
  project.video!.scenes.reverse()
})
it('falls back safely when the saved scene or moment has been removed', () => {
  expect(
    workspacePosition(
      project,
      new URL('http://localhost/?scene=deleted&moment=deleted')
    )
  ).toEqual({ selected: 0, momentIndex: 0, second: 0 })
  expect(
    workspacePosition(
      project,
      new URL('http://localhost/?scene=recorded&moment=deleted')
    )
  ).toEqual({ selected: 1, momentIndex: 0, second: 0 })
})

it('shows the first moment of a scene the creator moved to, unless one was chosen for it', async () => {
  const { momentOnShow } = await import('../app/workspace-position')
  const b = {
    id: 'b',
    moments: [
      { start: 0 },
      { start: 4 },
      { start: 8 },
      { start: 12 },
      { start: 16 }
    ]
  }
  // Moment 4 of scene a at 22 s, then wireframe b: nothing chose b's moment.
  expect(momentOnShow(b, 4, 22, { scene: 'a', index: 4, second: 22 })).toEqual({
    momentIndex: 0,
    second: 0
  })
  // Chosen with the move (playing the whole video, recording): kept.
  expect(momentOnShow(b, 2, 9, { scene: 'a', index: 4, second: 22 })).toEqual({
    momentIndex: 2,
    second: 9
  })
  // The same scene keeps its moment; one out of range starts again.
  expect(momentOnShow(b, 3, 13, { scene: 'b', index: 3, second: 13 })).toEqual({
    momentIndex: 3,
    second: 13
  })
  expect(momentOnShow(b, 7, 30)).toEqual({ momentIndex: 0, second: 0 })
})
