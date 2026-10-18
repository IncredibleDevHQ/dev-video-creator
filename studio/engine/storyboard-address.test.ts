import { describe, expect, it, vi } from 'vitest'
import { parseHTML } from 'linkedom'
import type { Project } from '../shared/model'

vi.mock('../app/api', () => ({ api: {} }))
vi.mock('../app/http', () => ({ requestJson: vi.fn() }))
const { clickStoryboard, storyboardViewAt } =
  await import('../app/storyboard-controller')

/** A notebook of three pages, a scene each, told as one storyboard. */
const project = {
  id: 'ep',
  slides: ['a', 'b', 'c'].map((id) => ({ id, title: id })),
  video: {
    scenes: ['a', 'b', 'c'].map((id) => ({
      id: `scene-${id}`,
      slideId: id,
      moments: []
    })),
    storyboard: {
      id: 'sb',
      stage: 'board',
      status: 'waiting',
      pages: ['a', 'b', 'c'],
      plan: {
        scenes: ['a', 'b', 'c'].map((pageId, index) => ({
          pageId,
          frames: [{ number: index + 1, duration: 4, title: pageId }]
        }))
      }
    }
  }
} as unknown as Project

describe('a storyboard video’s address (Jev series run)', () => {
  it('opens on the scene the address names', () => {
    expect(storyboardViewAt(project, 2)).toEqual({
      projectId: 'ep',
      scene: 2,
      frame: null
    })
    const plain = {
      ...project,
      video: { ...project.video!, storyboard: undefined }
    }
    expect(storyboardViewAt(plain as Project, 1)).toBeNull()
  })

  it('names the scene chosen on the rail, so a reload opens it again', async () => {
    const { document } = parseHTML(
      '<div><button data-index="1"></button></div>'
    )
    const app = {
      snapshot: { project },
      capture: { phase: 'idle' },
      root: document.querySelector('div'),
      sbView: null,
      selected: 0,
      render: vi.fn()
    }
    const button = document.querySelector('button')!
    await clickStoryboard(app as never, button as never, 'sb-scene')
    expect(app.sbView).toEqual({ projectId: 'ep', scene: 1, frame: null })
    expect(app.selected).toBe(1)
  })
})

it('brings the selected frame preview back into view without changing scenes', async () => {
  const { document } = parseHTML(
    '<div><div class="sb-stage"></div><button data-number="2"></button></div>'
  )
  const preview = document.querySelector('.sb-stage') as HTMLElement
  preview.scrollIntoView = vi.fn()
  const app = {
    snapshot: { project },
    capture: { phase: 'idle' },
    root: document.querySelector('div'),
    sbView: { projectId: 'ep', scene: 1, frame: null },
    selected: 1,
    render: vi.fn()
  }
  await clickStoryboard(
    app as never,
    document.querySelector('button') as never,
    'sb-frame'
  )
  expect(app.sbView).toEqual({ projectId: 'ep', scene: 1, frame: 2 })
  expect(preview.scrollIntoView).toHaveBeenCalledWith({
    block: 'nearest',
    inline: 'nearest'
  })
})
