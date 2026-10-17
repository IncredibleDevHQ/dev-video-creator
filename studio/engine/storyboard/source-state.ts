import type { Project } from '../../shared/model'

/** Inputs that a storyboard production took from its wireframes. */
export const storyboardSources = (project: Project) => {
  const board = project.video?.storyboard
  if (!board) return ''
  return JSON.stringify({
    branding: project.branding,
    pages: board.pages.map((id) => {
      const slide = project.slides.find((page) => page.id === id)
      return (
        slide && {
          id,
          title: slide.title,
          svg: slide.svg,
          narration: slide.narration,
          idea: slide.idea,
          capture: slide.capture
        }
      )
    })
  })
}
