import type { Scene } from '../shared/model'
import { animationSecond } from '../shared/scene-time'
export const standInControls = () =>
  '<div class="layered-controls" aria-label="Moment playback"><button type="button" data-stand-in-play aria-label="Play moment">▶</button><button type="button" data-stand-in-replay aria-label="Replay moment">↻</button><time data-stand-in-time>0:00</time><label class="sr" for="stand-in-seek">Moment position</label><input id="stand-in-seek" data-stand-in-seek type="range" min="0" max="100" step="0.1" value="0"><span data-stand-in-status role="status"></span></div>'
/** The existing animation is the clock; this never requests a camera or generates media. */
export function standInPlayback(
  root: HTMLElement,
  current: () => { scene: Scene; index: number } | null,
  update: (second: number, playing: boolean) => void
) {
  let frame = 0
  const stop = () => {
    cancelAnimationFrame(frame)
    frame = 0
  }
  const context = () => {
    const at = current(),
      controls = root.querySelector('[data-stand-in-play]'),
      player = root.querySelector<HTMLVideoElement>(
        '[data-rehearsal-animation]'
      )
    if (!at || !controls || !player) return null
    const moment = at.scene.moments[at.index],
      base = at.scene.animation?.moments[at.index]
    return moment && base ? { ...at, moment, base, player } : null
  }
  const paint = () => {
    const at = context()
    if (!at) {
      stop()
      return
    }
    const { player, moment, base, scene } = at
    const second = Math.max(
      moment.start,
      Math.min(moment.end, animationSecond(scene, player.currentTime))
    )
    if (player.currentTime >= base.end) {
      player.pause()
      stop()
    }
    const play = root.querySelector<HTMLButtonElement>('[data-stand-in-play]')!
    play.textContent = player.paused ? '▶' : 'Ⅱ'
    play.setAttribute(
      'aria-label',
      player.paused ? 'Play moment' : 'Pause moment'
    )
    root.querySelector('[data-stand-in-time]')!.textContent =
      `${(second - moment.start).toFixed(1)} / ${(moment.end - moment.start).toFixed(1)}s`
    root.querySelector<HTMLInputElement>('[data-stand-in-seek]')!.value =
      String(((second - moment.start) / (moment.end - moment.start)) * 100)
    update(second, !player.paused)
  }
  const tick = () => {
    paint()
    if (context()?.player.paused === false && !context()?.player.ended)
      frame = requestAnimationFrame(tick)
  }
  root.addEventListener('click', (event) => {
    const replay = (event.target as Element).closest('[data-stand-in-replay]')
    if (!replay && !(event.target as Element).closest('[data-stand-in-play]'))
      return
    const at = context()
    if (!at) return
    if (replay) {
      at.player.currentTime = at.base.start
      void at.player.play().catch(() => {})
      return
    }
    if (at.player.paused) {
      if (
        at.player.currentTime >= at.base.end - 0.02 ||
        at.player.currentTime < at.base.start
      )
        at.player.currentTime = at.base.start
      void at.player.play().catch(() => {
        stop()
        const status = root.querySelector('[data-stand-in-status]')
        if (status) status.textContent = 'Could not play. Try again.'
      })
    } else at.player.pause()
  })
  root.addEventListener('input', (event) => {
    const input = event.target as HTMLInputElement,
      at = context()
    if (!input.matches('[data-stand-in-seek]') || !at) return
    at.player.currentTime =
      at.base.start +
      (Number(input.value) / 100) * (at.base.end - at.base.start)
    paint()
  })
  root.addEventListener(
    'click',
    (event) => {
      if (
        (event.target as Element).closest(
          '[data-moment],[data-scene],[data-stage],[data-action=practice],[data-action=scene-next],[data-action=record-moment]'
        )
      ) {
        context()?.player.pause()
        stop()
      }
    },
    true
  )
  for (const type of [
    'play',
    'playing',
    'pause',
    'ended',
    'waiting',
    'error',
    'seeked',
    'loadedmetadata',
    'loadeddata',
    'canplay'
  ])
    root.addEventListener(
      type,
      (event) => {
        if (event.target !== context()?.player) return
        paint()
        stop()
        const status = root.querySelector('[data-stand-in-status]')
        if (status)
          status.textContent =
            type === 'waiting'
              ? 'Loading animation…'
              : type === 'error'
                ? 'Animation could not load.'
                : ''
        if (
          !['waiting', 'error', 'ended'].includes(type) &&
          context()?.player.paused === false
        )
          frame = requestAnimationFrame(tick)
      },
      true
    )
  window.addEventListener('pagehide', stop)
}
