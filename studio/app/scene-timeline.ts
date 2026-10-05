// The practice timeline's pieces, drawn as markup: a moment's phrases and
// words, and the whole scene as one long timeline (ruler, filmstrip, moments
// cut apart by a line), plus where the animation stands at a scene second.
import type { Moment, Scene } from '../shared/model'
import { dialogueBoundary, wordsOf } from '../shared/dialogue'
import { animationSecond } from '../shared/scene-time'
import { drawFrame, drawnFrame, nearestFrame } from './filmstrip'
import { escape } from './ui'

const icons: Record<string, string> = {
  video:
    '<rect x="3" y="6" width="12" height="12" rx="3"/><path d="m15 10 6-3v10l-6-3"/>',
  text: '<path d="M5 6h14M5 12h10M5 18h14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  // The whole scene: one bar, cut into its moments.
  scene:
    '<rect x="2.5" y="5.5" width="19" height="13" rx="2.5"/><path d="M8.8 5.5v13M15.2 5.5v13"/>',
  // One moment: the same bar, with only its part filled.
  moment:
    '<rect x="2.5" y="5.5" width="19" height="13" rx="2.5" opacity=".45"/><rect x="8.8" y="5.5" width="6.4" height="13" fill="currentColor" stroke="none"/>'
}

export const icon = (name: string) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] ?? icons.plus}</svg>`

export const time = (n: number) =>
  `${Math.floor(Math.max(0, n) / 60)}:${(Math.max(0, n) % 60).toFixed(1).padStart(4, '0')}`

/** One moment's phrases on the Voice track, from where it starts there. */
export function phraseButtons(
  m: Moment,
  from: number,
  a: number,
  b: number,
  length: number,
  extra: string
) {
  const base = m.extension?.baseLines ?? m.lines,
    phrases = base.match(/[^,.;!?]+[,.;!?]*/g) || [base],
    count = wordsOf(base).length
  let word = 0
  return (
    phrases
      .map((phrase) => {
        const at = (word / count) * b
        word += wordsOf(phrase).length
        return `<button type="button" data-jump="${from + at}" style="left:${((from + at) / a) * 100}%;width:calc(${(((word / count) * b - at) / a) * 100}% - 4px)" title="${escape(phrase.trim())}">${escape(phrase.trim())}</button>`
      })
      .join('') +
    (extra
      ? `<button type="button" class="ds-extra" data-jump="${from + b}" style="left:${((from + b) / a) * 100}%;width:calc(${((length - b) / a) * 100}% - 4px)">${escape(extra)}</button>`
      : '')
  )
}

/** One moment's words for the read-along, with any extra dialogue. */
export const wordSpans = (m: Moment) =>
  wordsOf(m.extension?.baseLines ?? m.lines)
    .map((w) => `<span data-ds-word>${escape(w)}</span>`)
    .join(' ') +
  (m.extension
    ? `<span class="ds-divider">Animation holds · keep talking</span>${wordsOf(
        m.extension.text
      )
        .map(
          (w) => `<span data-ds-word class="ds-extra-word">${escape(w)}</span>`
        )
        .join(' ')}`
    : '')

/** Every moment's words, each after its number, and where each one begins. */
export function sceneWords(moments: Moment[]) {
  const starts: number[] = []
  let count = 0
  const html = moments
    .map((m, i) => {
      starts[i] = count
      count +=
        wordsOf(m.extension?.baseLines ?? m.lines).length +
        (m.extension ? wordsOf(m.extension.text).length : 0)
      return `<span class="ds-moment-words"><span class="ds-mark" aria-hidden="true">${i + 1}</span>${wordSpans(m)}</span>`
    })
    .join(' ')
  return { html, starts }
}

/**
 * The whole scene on one timeline: the ruler, the moments as parts of it
 * cut apart by a line, and every phrase on the Voice track.
 */
export function sceneParts(
  moments: Moment[],
  a: number,
  perSecond: number,
  film: boolean
) {
  const start = moments[0]?.start ?? 0,
    step =
      [0.5, 1, 2, 5, 10, 15, 30, 60, 120].find((n) => n * perSecond >= 52) ??
      120
  return {
    ruler: Array.from({ length: Math.ceil(a / step) }, (_, i) => i * step)
      .filter((at) => at === 0 || at <= a - step / 2)
      .map(
        (at) =>
          `<span style="left:${(at / a) * 100}%">${time(start + at).replace('.0', '')}</span>`
      )
      .join(''),
    moments: moments
      .map((m, i) => {
        const length = m.end - m.start,
          b = dialogueBoundary(m)
        return `<button type="button" class="ds-moment" data-ds-moment="${i}" style="left:${((m.start - start) / a) * 100}%;width:${(length / a) * 100}%" aria-label="Moment ${i + 1}, from ${time(m.start)}" title="Moment ${i + 1} · ${escape(m.lines)}"><b>${i + 1}</b>${
          film ? '' : '<span>Wireframe</span>'
        }${
          length - b > 0.05
            ? `<span class="ds-moment-hold" style="left:${(b / length) * 100}%"></span>`
            : ''
        }</button>`
      })
      .join(''),
    cuts: moments
      .slice(1)
      .map((m) => `<i style="left:${((m.start - start) / a) * 100}%"></i>`)
      .join(''),
    phrases: moments
      .map((m) =>
        phraseButtons(
          m,
          m.start - start,
          a,
          dialogueBoundary(m),
          m.end - m.start,
          m.extension?.text || ''
        )
      )
      .join('')
  }
}

/**
 * The filmstrip's tiles across the scene: frames already drawn show at once,
 * the nearest drawn frame stands in for the rest until they are drawn.
 */
export function filmstripTiles(
  scene: Scene,
  src: string,
  a: number,
  width: number,
  tile: number
) {
  const start = scene.moments[0]?.start ?? 0
  return Array.from({ length: Math.ceil(width / tile) }, (_, i) => {
    let at = 0
    try {
      at = animationSecond(
        scene,
        start + Math.min(a, ((i + 0.5) * tile * a) / width),
        true
      )
    } catch {
      // An animation for other moments draws no frames.
    }
    const frame = Math.round(at * 4) / 4,
      url = drawnFrame(src, frame),
      near = url ? undefined : nearestFrame(src, frame)
    return `<img alt="" data-frame="${frame}" style="left:${i * tile}px"${
      url || near ? ` src="${url || near}"` : ''
    }${url ? '' : ' data-drawing'}>`
  }).join('')
}

/** The moment playing at a second of the scene (the last, once it ends). */
export const momentIndexAt = (moments: Moment[], second: number) => {
  const index = moments.findIndex((moment) => second < moment.end)
  return index < 0 ? Math.max(0, moments.length - 1) : index
}

/**
 * Where the animation stands at a second of the scene: it plays straight on
 * from one moment into the next, and holds its last frame only while a
 * moment's words run on past its animation (or the scene has ended).
 */
export function animationAt(scene: Scene, second: number) {
  const moments = scene.moments,
    index = momentIndexAt(moments, second),
    moment = moments[index],
    base = scene.animation!.moments[index],
    length = dialogueBoundary(moment),
    local = second - moment.start,
    holding =
      local >= length - 0.02 &&
      (moment.end - moment.start > length + 0.05 ||
        index === moments.length - 1)
  return {
    index,
    holding,
    target: holding
      ? base.end - 0.04
      : base.start +
        Math.max(0, Math.min(1, local / length)) * (base.end - base.start),
    rate: Math.max(0.25, Math.min(4, (base.end - base.start) / length))
  }
}

/** Lay the filmstrip's tiles, and draw the frames they still wait for. */
export function fillFilmstrip(
  strip: HTMLElement,
  scene: Scene,
  src: string,
  a: number,
  width: number
) {
  strip.innerHTML = src ? filmstripTiles(scene, src, a, width, 80) : ''
  for (const img of strip.querySelectorAll<HTMLImageElement>(
    'img[data-drawing]'
  ))
    void drawFrame(src, Number(img.dataset.frame), () => img.isConnected).then(
      (url) => {
        if (!img.isConnected) return
        img.src = url
        img.removeAttribute('data-drawing')
      }
    )
}

/**
 * Keep the animation on the scene's clock at a second of the scene. Paused
 * (or holding a frame), it shows that frame; playing, a little behind or
 * ahead, it catches up by playing a touch faster or slower, and jumps only
 * when far off. Says whether it should now be rolling, and whether
 * something outside paused it (a browser pauses a muted clip in a hidden
 * page) while it was.
 */
export function steerAnimation(
  v: HTMLVideoElement,
  scene: Scene,
  second: number,
  live: boolean,
  rolling: boolean
) {
  const { holding, target, rate } = animationAt(scene, second)
  if (!live || holding) {
    if (!v.paused) v.pause()
    if (Math.abs(v.playbackRate - rate) > 0.001) v.playbackRate = rate
    if (!v.seeking && Math.abs(v.currentTime - target) > 0.04)
      v.currentTime = target
    return { rolling: false, stopped: false }
  }
  if (rolling && v.paused) return { rolling, stopped: true }
  const drift = v.seeking ? 0 : target - v.currentTime
  if (Math.abs(drift) > 1) v.currentTime = target
  const nudged = Math.max(
    0.25,
    Math.min(4, rate * (1 + Math.max(-0.15, Math.min(0.15, drift * 0.6))))
  )
  if (Math.abs(v.playbackRate - nudged) > 0.01) v.playbackRate = nudged
  if (v.paused) void v.play().catch(() => {})
  return { rolling: true, stopped: false }
}
