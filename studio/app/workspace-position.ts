import type { Project } from '../shared/model'

/** Stable IDs keep a recording's scene/moment selected after reopening its URL. */
export function workspacePosition(project: Project, url: URL) {
  const scenes = project.video?.scenes || []
  const found = scenes.findIndex(
    (scene) => scene.id === url.searchParams.get('scene')
  )
  const selected = Math.max(0, found),
    moments = scenes[selected]?.moments || []
  const matched = moments.findIndex(
    (moment) => moment.id === url.searchParams.get('moment')
  )
  const momentIndex = Math.max(0, matched)
  return { selected, momentIndex, second: moments[momentIndex]?.start || 0 }
}
export function workspaceUrl(
  url: URL,
  project: Project,
  stage: string,
  selected: number,
  momentIndex: number
) {
  const next = new URL(url.href)
  next.searchParams.set('view', stage)
  if (stage === 'video') {
    const scene = project.video?.scenes[selected],
      moment = scene?.moments[momentIndex]
    if (scene) next.searchParams.set('scene', scene.id)
    else next.searchParams.delete('scene')
    if (moment) next.searchParams.set('moment', moment.id)
    else next.searchParams.delete('moment')
  }
  return next
}

/**
 * The moment to show for the scene on show (review 6: one kept from another
 * scene made Practice and chat do nothing, or send a time the scene doesn't
 * have). A moment and time carried over from another scene, which nothing
 * chose for this one, give way to its first moment; so does one out of its
 * range. Its time goes with it, so the time chip and the chat agree.
 */
export const momentOnShow = (
  scene: { id: string; moments: ReadonlyArray<{ start: number }> },
  momentIndex: number,
  second: number,
  last?: { scene: string; index: number; second: number }
) => {
  const carried = Boolean(
    last &&
    last.scene !== scene.id &&
    last.index === momentIndex &&
    last.second === second
  )
  return carried || momentIndex < 0 || momentIndex >= scene.moments.length
    ? { momentIndex: 0, second: scene.moments[0]?.start ?? 0 }
    : { momentIndex, second }
}
