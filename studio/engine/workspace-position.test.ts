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
