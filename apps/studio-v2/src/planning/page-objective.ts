// What a base page teaches, kept apart from how it was staged (F4 of the
// fresh end-to-end review). The teaching objective is the source outline's
// idea for the page. The director's notes are layout guidance for the slide
// and its presenter: they are rewritten whenever the page is animated, and
// are never the page's idea.

type OutlineScene = { nodeId?: string; title: string; idea: string }

// The outline scene a page was made from: by the page's id, or by the base
// page a video scene came from; an outline written before scenes kept
// their page ids is matched by title.
export const outlineSceneOf = <T extends OutlineScene>(scenes: T[] | undefined, attrs: Record<string, unknown>): T | undefined => {
  if (!scenes?.length) return undefined
  const origin = attrs.origin && typeof attrs.origin === 'object' ? (attrs.origin as { scene?: unknown; scenes?: unknown }) : null
  const ids = [attrs.id, origin?.scene, ...(Array.isArray(origin?.scenes) ? origin!.scenes : [])].map(value => String(value || '')).filter(Boolean)
  const title = String(attrs.title || '')
  return scenes.find(scene => scene.nodeId && ids.includes(scene.nodeId)) || (title ? scenes.find(scene => !scene.nodeId && scene.title === title) : undefined)
}

export const pageObjectiveOf = (attrs: Record<string, unknown>, scenes: OutlineScene[] | undefined) => {
  const seed = attrs.directorSeed && typeof attrs.directorSeed === 'object' ? String((attrs.directorSeed as { directorNotes?: unknown }).directorNotes || '') : ''
  // A page made from a source outline was handed its idea as its first
  // notes; the director keeps those as its seed when it first writes its own.
  const objective = (outlineSceneOf(scenes, attrs)?.idea || (attrs.pageOrigin ? seed : '')).trim()
  const notes = String(attrs.directorNotes || '').trim()
  return {
    objective,
    // The notes the page carries, unless they are only its objective.
    layoutGuidance: notes && notes !== objective ? notes : '',
  }
}

// A page's idea for a writer or a neighbour: its objective, else notes a
// person wrote — never the director's generated staging.
export const pageIdeaOf = (attrs: Record<string, unknown>, scenes: OutlineScene[] | undefined) => {
  const { objective, layoutGuidance } = pageObjectiveOf(attrs, scenes)
  return objective || (attrs.directorAuto ? '' : layoutGuidance)
}
