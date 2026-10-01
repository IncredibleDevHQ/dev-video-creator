import type { Snapshot } from '../shared/api'
import type { Scene } from '../shared/model'
/** Only current matching takes can substantiate a saved-recording message. */
export function recordingHandoff(snapshot: Snapshot, scene: Scene) {
  const view = snapshot.views?.scenes[scene.id]
  if (
    view?.produced ||
    [
      'queued',
      'writing',
      'changing',
      'replanning',
      'producing',
      'failed'
    ].includes(scene.phase)
  )
    return ''
  const saved = (scene.moments || []).flatMap((moment, index) =>
    moment.take?.recordingKey === moment.recordingKey && moment.take
      ? [index + 1]
      : []
  )
  if (!saved.length) return ''
  const label =
    saved.length === 1
      ? `Moment ${saved[0]} recording saved`
      : `${saved.length} recordings saved`
  const remaining = view?.openMomentIds.length || 0
  return `<div class="recording-handoff" role="status"><span class="saved-indicator" aria-hidden="true"></span><strong>${label}</strong><span>${remaining ? `${remaining} ${remaining === 1 ? 'moment still needs' : 'moments still need'} recording. You can record them in any order.` : 'Ready to combine with your scene.'}</span></div>`
}
