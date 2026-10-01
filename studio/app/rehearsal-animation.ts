import { dialogueBoundary } from '../shared/dialogue'
import type { Scene } from '../shared/model'
import { animationSecond } from '../shared/scene-time'

const starting = new WeakSet<HTMLVideoElement>()

/** Keep the content-only layer on the dialogue clock; camera stays a separate layer. */
export function syncRehearsalAnimation(
  root: ParentNode,
  scene: Scene,
  index: number,
  second: number,
  playing: boolean
) {
  const player = root.querySelector<HTMLVideoElement>(
    '[data-rehearsal-animation]'
  )
  const moment = scene.moments[index],
    base = scene.animation?.moments[index]
  if (!player || !moment || !base) return
  const holdAt = Math.max(
    moment.start,
    moment.start + dialogueBoundary(moment) - 0.3
  )
  const holding = second >= holdAt
  const at = animationSecond(
    scene,
    Math.max(moment.start, Math.min(holdAt, second)),
    true
  )
  const sync = () => {
    // Let an in-flight seek decode before moving the target again.
    if (player.seeking) return
    if (Math.abs(player.currentTime - at) > (!playing || holding ? 0.04 : 0.25))
      player.currentTime = at
    player.playbackRate = Math.max(
      0.25,
      Math.min(4, (base.end - base.start) / dialogueBoundary(moment))
    )
    if (playing && !holding) {
      if (player.paused !== false && !starting.has(player)) {
        starting.add(player)
        void player
          .play()
          .catch(() => {})
          .finally(() => starting.delete(player))
      }
    } else player.pause()
  }
  if (player.readyState) sync()
  else player.onloadedmetadata = sync
}
