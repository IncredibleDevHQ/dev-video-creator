// Play controls under the scene, not on it: the browser's own controls sat on
// top of the slide's footer (review 5). The moment strip below seeks.
import type { AppContext } from './app-context'

const clock = (seconds: number) =>
  Number.isFinite(seconds)
    ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
    : '0:00'

const paint = (root: HTMLElement) => {
  const player = root.querySelector<HTMLVideoElement>('[data-scene-player]')
  const bar = root.querySelector<HTMLElement>('.player-bar')
  if (!player || !bar) return
  const toggle = bar.querySelector<HTMLButtonElement>(
    '[data-action="player-toggle"]'
  )!
  toggle.textContent = player.paused ? '▶ Play' : 'Ⅱ Pause'
  toggle.setAttribute('aria-label', player.paused ? 'Play' : 'Pause')
  bar.querySelector('[data-player-time]')!.textContent =
    `${clock(player.currentTime)} / ${clock(player.duration)}`
}

/** Add the bar under a scene player after each render. */
export const syncPlayerBar = (root: HTMLElement) => {
  const player = root.querySelector<HTMLVideoElement>('[data-scene-player]')
  if (!player) return
  player.removeAttribute('controls')
  if (!root.querySelector('.player-bar'))
    root
      .querySelector('.video-stage')
      ?.insertAdjacentHTML(
        'afterend',
        '<div class="player-bar"><button type="button" data-action="player-toggle">▶ Play</button><span class="player-time" data-player-time>0:00 / 0:00</span></div>'
      )
  paint(root)
}

export const installPlayerBar = (app: AppContext) => {
  const toggle = () => {
    const player = app.root.querySelector<HTMLVideoElement>(
      '[data-scene-player]'
    )
    if (!player) return
    if (player.paused) void player.play().catch(app.error)
    else player.pause()
  }
  app.root.addEventListener('click', (event) => {
    const target = event.target as Element
    if (
      target.closest('[data-action="player-toggle"]') ||
      target.closest('[data-scene-player]')
    )
      toggle()
  })
  for (const type of ['play', 'pause', 'timeupdate', 'loadedmetadata', 'ended'])
    app.root.addEventListener(
      type,
      (event) => {
        if ((event.target as Element).matches?.('[data-scene-player]'))
          paint(app.root)
      },
      true
    )
}
