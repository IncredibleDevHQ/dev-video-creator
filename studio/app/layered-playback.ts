/** A single transport belongs to the composed canvas, never the camera region. */
export function layeredControls() {
  return '<div class="layered-controls" aria-label="Scene playback"><button type="button" data-layered-play aria-label="Play recording">▶</button><time data-layered-time>0:00</time><label class="sr" for="layered-seek">Recording position</label><input id="layered-seek" data-layered-seek type="range" min="0" max="100" step="0.1" value="0" disabled><button type="button" data-layered-mute aria-label="Mute recording">Sound on</button><button type="button" data-layered-fullscreen aria-label="Fullscreen scene">⛶</button></div>'
}
const time = (value: number) =>
  `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`
export function layeredPlayback(
  root: HTMLElement,
  synchronize: (second: number, playing: boolean) => void
) {
  let frame = 0
  const player = () =>
    root.querySelector<HTMLVideoElement>(
      '[data-saved-presenter],[data-take-player]'
    )
  const stop = () => {
    cancelAnimationFrame(frame)
    frame = 0
  }
  const paint = () => {
    const media = player(),
      controls = root.querySelector('.layered-controls')
    if (!media || !controls) return
    const duration =
      Number.isFinite(media.duration) && media.duration > 0
        ? media.duration
        : Number(media.dataset.reviewDuration) || 0
    const clock = controls.querySelector('[data-layered-time]')
    if (clock)
      clock.textContent = `${time(media.currentTime)} / ${time(duration)}`
    const seek = controls.querySelector<HTMLInputElement>(
      '[data-layered-seek]'
    )!
    seek.disabled = !duration
    seek.value = String(duration ? (media.currentTime / duration) * 100 : 0)
    const play = controls.querySelector<HTMLButtonElement>(
      '[data-layered-play]'
    )!
    play.textContent = media.paused ? '▶' : 'Ⅱ'
    play.setAttribute(
      'aria-label',
      media.paused ? 'Play recording' : 'Pause recording'
    )
    const mute = controls.querySelector<HTMLButtonElement>(
      '[data-layered-mute]'
    )!
    mute.textContent = media.muted ? 'Sound off' : 'Sound on'
    mute.setAttribute(
      'aria-label',
      media.muted ? 'Unmute recording' : 'Mute recording'
    )
    synchronize(media.currentTime, !media.paused && !media.ended)
  }
  const tick = () => {
    paint()
    const media = player()
    if (media?.isConnected && !media.paused && !media.ended)
      frame = requestAnimationFrame(tick)
    else stop()
  }
  root.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLElement>(
      '[data-layered-play],[data-layered-mute],[data-layered-fullscreen]'
    )
    if (!button) return
    const media = player()
    if (!media) return
    if (button.hasAttribute('data-layered-play')) {
      if (media.paused) void media.play().catch(() => {})
      else media.pause()
    }
    if (button.hasAttribute('data-layered-mute')) media.muted = !media.muted
    if (button.hasAttribute('data-layered-fullscreen'))
      void media
        .closest<HTMLElement>('.video-stage')
        ?.requestFullscreen()
        .catch(() => {})
    paint()
  })
  root.addEventListener('input', (event) => {
    const target = event.target as HTMLInputElement,
      media = player()
    if (target.matches('[data-layered-seek]') && media) {
      const duration =
        Number.isFinite(media.duration) && media.duration > 0
          ? media.duration
          : Number(media.dataset.reviewDuration) || 0
      if (duration)
        media.currentTime =
          (Math.max(0, Math.min(100, Number(target.value))) / 100) * duration
      paint()
    }
  })
  for (const type of [
    'play',
    'pause',
    'ended',
    'loadedmetadata',
    'loadeddata',
    'durationchange',
    'seeked',
    'timeupdate'
  ])
    root.addEventListener(
      type,
      (event) => {
        if (event.target !== player()) return
        paint()
        if (type === 'play') {
          stop()
          frame = requestAnimationFrame(tick)
        } else if (type === 'pause' || type === 'ended') stop()
      },
      true
    )
  window.addEventListener('pagehide', stop)
  return paint
}
