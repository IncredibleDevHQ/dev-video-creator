import type { Moment, Scene } from '../shared/model'
import {
  dialogueBoundary,
  dialogueWordAt,
  wordsOf,
  estimateSpeech
} from '../shared/dialogue'
import { escape } from './ui'
import { api } from './api'
import { drawFrame, drawnFrame, nearestFrame } from './filmstrip'
import { animationSecond } from '../shared/scene-time'
import type { Snapshot } from '../shared/api'
type Context = {
  projectId: string
  scene: Scene
  index: number
  second: number
  busy: boolean
  recording: boolean
  label: string
  /** The scene's animation: not made yet, being made, or ready to play. */
  animation?: 'none' | 'making' | 'ready'
  /** In practice, what Play plays: this moment, or the whole scene. */
  scope?: Scope
}
type Scope = 'moment' | 'scene'
/** What the studio asks of the page around it. */
type Host = {
  /** Choose what Play plays. */
  scope: (next: Scope) => void
  /**
   * Playing the whole scene, the moment on show changed: the page shows its
   * number and overlay without drawing everything again.
   */
  moment: (index: number) => void
}
const icon = (name: string) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true">${name === 'video' ? '<rect x="3" y="6" width="12" height="12" rx="3"/><path d="m15 10 6-3v10l-6-3"/>' : name === 'text' ? '<path d="M5 6h14M5 12h10M5 18h14"/>' : '<path d="M12 5v14M5 12h14"/>'}</svg>`
const time = (n: number) =>
  `${Math.floor(Math.max(0, n) / 60)}:${(Math.max(0, n) % 60).toFixed(1).padStart(4, '0')}`
/** One controller owns preview media, timeline, and inline dialogue edits. */
export function dialogueStudio(
  root: HTMLElement,
  current: () => Context | null,
  update: (second: number) => void,
  saved: (snapshot: Snapshot) => void,
  host?: Host
) {
  let panel: HTMLElement | null = null,
    key = '',
    editing = false,
    draft = '',
    completion = '',
    target = 10,
    request = 0,
    suggesting = false,
    saving = false,
    ai = false
  let playing = false,
    position = 0,
    extraEpoch = 0,
    // The words run on a clock past the animation's end, and before the
    // scene has an animation: when it started, and from where.
    clocked = false,
    clockFrom = 0,
    // Playing the whole scene, the animation was set rolling and should be.
    rolling = false,
    // The word last scrolled to, and where each moment's words begin.
    shownWord = -1,
    wordStarts: number[] = [],
    // The whole scene's timeline: 1 fits the scene in view, more zooms in.
    zoom = 1,
    // What the filmstrip was drawn for, so drawing again keeps its frames.
    stripKey = '',
    frame = 0,
    playRequest = 0,
    debounce: ReturnType<typeof setTimeout> | undefined
  const $ = <T extends HTMLElement = HTMLElement>(name: string) =>
    panel!.querySelector<T>(`[data-ds="${name}"]`)!
  const ctx = () => {
    const c = current()
    return c ? { ...c, moment: c.scene.moments[c.index] } : null
  }
  const video = () =>
    root.querySelector<HTMLVideoElement>('[data-rehearsal-animation]')
  const text = () =>
    editing ? (draft + completion).trim() : ctx()?.moment.extension?.text || ''
  const boundary = () => (ctx() ? dialogueBoundary(ctx()!.moment) : 0)
  // Playing the whole scene, one panel shows every moment on the scene's
  // clock: nothing is rebuilt as one moment follows another.
  const through = () => {
    const c = ctx()
    return Boolean(
      host && c?.scope === 'scene' && c.scene.moments.length > 1 && !editing
    )
  }
  const sceneStart = () => ctx()?.scene.moments[0]?.start ?? 0
  const total = () =>
    through()
      ? (ctx()!.scene.moments.at(-1)?.end ?? 0) - sceneStart()
      : editing
        ? boundary() + estimateSpeech(text())
        : ctx()
          ? ctx()!.moment.end - ctx()!.moment.start
          : 0
  const axis = () => (through() ? total() : Math.max(boundary() + 2, total()))
  /** The moment playing at a second of the scene. */
  const momentAt = (second: number) => {
    const moments = ctx()?.scene.moments || []
    const index = moments.findIndex((moment) => second < moment.end)
    return index < 0 ? Math.max(0, moments.length - 1) : index
  }
  /** The animation, when it is ready and matches the scene's moments. */
  const animated = () => {
    const c = ctx(),
      v = video()
    return c &&
      v &&
      c.scene.animation?.moments.length === c.scene.moments.length
      ? v
      : null
  }
  function readDraft() {
    const field = $('input')
    const value = field.innerText
        .replace(/\u200b/g, '')
        .replace(/\u00a0/g, ' '),
      pending = field.querySelector('[data-completion]')?.textContent || ''
    return pending && value.endsWith(pending)
      ? value.slice(0, -pending.length)
      : value
  }
  function materialize() {
    const pending = $('input').querySelector('[data-completion]')
    if (pending) pending.removeAttribute('data-completion')
    completion = ''
    draft = readDraft()
    const next = document.createElement('span')
    next.dataset.completion = ''
    $('input').append(next)
    request++
  }
  function focusEnd() {
    const field = $('input')
    field.focus()
    const r = document.createRange()
    r.selectNodeContents(field)
    const pending = field.querySelector('[data-completion]')
    if (pending) r.setEndBefore(pending)
    r.collapse(false)
    getSelection()?.removeAllRanges()
    getSelection()?.addRange(r)
    field.scrollIntoView({ block: 'nearest' })
  }
  function status(message: string) {
    if (panel) $('status').textContent = message
  }
  function stop() {
    playing = false
    rolling = false
    clocked = false
    extraEpoch = 0
    playRequest++
    video()?.pause()
    cancelAnimationFrame(frame)
    paint()
  }
  /**
   * Playing the whole scene, keep the animation on the scene's clock: it plays
   * straight on from one moment into the next, and holds its last frame only
   * while a moment's words run past its animation. False when something
   * outside paused it (a browser pauses a muted clip in a hidden page).
   */
  function follow(v: HTMLVideoElement, live: boolean) {
    const c = ctx()!,
      at = sceneStart() + position,
      index = momentAt(at),
      moment = c.scene.moments[index],
      base = c.scene.animation!.moments[index],
      length = dialogueBoundary(moment),
      local = at - moment.start,
      holding =
        local >= length - 0.02 &&
        (moment.end - moment.start > length + 0.05 ||
          index === c.scene.moments.length - 1),
      target = holding
        ? base.end - 0.04
        : base.start +
          Math.max(0, Math.min(1, local / length)) * (base.end - base.start),
      rate = Math.max(0.25, Math.min(4, (base.end - base.start) / length))
    if (!live || holding) {
      rolling = false
      if (!v.paused) v.pause()
      if (Math.abs(v.playbackRate - rate) > 0.001) v.playbackRate = rate
      if (!v.seeking && Math.abs(v.currentTime - target) > 0.04)
        v.currentTime = target
      return true
    }
    if (rolling && v.paused) return false
    // A little behind or ahead, the animation catches up by playing a touch
    // faster or slower; only when far off does it jump.
    const drift = v.seeking ? 0 : target - v.currentTime
    if (Math.abs(drift) > 1) v.currentTime = target
    const nudged = Math.max(
      0.25,
      Math.min(4, rate * (1 + Math.max(-0.15, Math.min(0.15, drift * 0.6))))
    )
    if (Math.abs(v.playbackRate - nudged) > 0.01) v.playbackRate = nudged
    if (v.paused) void v.play().catch(() => {})
    rolling = true
    return true
  }
  /** Tell the page which moment is on show, once it changes. */
  function showAt(second: number) {
    const c = ctx(),
      index = momentAt(second)
    if (c && index !== c.index) host?.moment(index)
  }
  function seek(at: number) {
    const c = ctx(),
      v = video(),
      base = c?.scene.animation?.moments[c.index]
    if (!c) return
    const resume = playing
    stop()
    if (through()) {
      position = Math.max(0, Math.min(total(), at))
      const animation = animated()
      if (animation) follow(animation, false)
      showAt(sceneStart() + position)
      update(sceneStart() + position)
      paint()
      if (resume) void play()
      return
    }
    position = Math.max(0, Math.min(total(), at))
    if (v && base)
      v.currentTime = Math.min(
        base.end - 0.08,
        base.start +
          Math.min(1, position / boundary()) * (base.end - base.start)
      )
    update(c.moment.start + position)
    paint()
    if (resume) void play()
  }
  async function play() {
    const c = ctx(),
      v = video(),
      base = c?.scene.animation?.moments[c.index]
    if (!c || editing || c.busy) return
    if (position >= total() - 0.03) seek(0)
    const token = ++playRequest
    // The whole scene runs on its own clock, and the animation follows it.
    if (through()) {
      const animation = animated()
      if (animation) {
        follow(animation, false)
        const at = sceneStart() + position,
          moment = c.scene.moments[momentAt(at)]
        if (at - moment.start < dialogueBoundary(moment) - 0.02)
          try {
            await animation.play()
            if (token !== playRequest) return
            rolling = true
          } catch {
            status('Could not play animation. Press Play to retry.')
            return
          }
      }
      clocked = true
      clockFrom = position
      extraEpoch = performance.now()
      playing = true
      status('')
      tick()
      return
    }
    // Past the animation, or before the scene has one, the words run on a
    // clock: over the animation's last frame, or over the wireframe.
    if (!v || !base || position >= boundary()) {
      clocked = true
      clockFrom = position
      extraEpoch = performance.now()
      playing = true
      status('')
      tick()
      return
    }
    if (
      Math.abs(
        v.currentTime -
          (base.start + (position / boundary()) * (base.end - base.start))
      ) > 0.12
    )
      v.currentTime =
        base.start + (position / boundary()) * (base.end - base.start)
    v.playbackRate = Math.max(
      0.25,
      Math.min(4, (base.end - base.start) / boundary())
    )
    try {
      await v.play()
      if (token !== playRequest) return
      playing = true
      status('')
      tick()
    } catch {
      status('Could not play animation. Press Play to retry.')
    }
  }
  function tick() {
    if (!playing) return
    if (through()) {
      position = Math.min(
        total(),
        clockFrom + (performance.now() - extraEpoch) / 1000
      )
      const animation = animated()
      if (animation && !follow(animation, true)) {
        playing = false
        status('Playback paused. Press Play to continue.')
        paint()
        return
      }
      showAt(sceneStart() + position)
      update(sceneStart() + position)
      paint()
      if (position >= total() - 0.01) {
        position = total()
        stop()
        return
      }
      frame = requestAnimationFrame(tick)
      return
    }
    const c = ctx(),
      v = video(),
      base = c?.scene.animation?.moments[c.index]
    if (!c || (!clocked && (!v || !base))) {
      stop()
      return
    }
    if (clocked)
      position = Math.min(
        total(),
        clockFrom + (performance.now() - extraEpoch) / 1000
      )
    else if (v && base && !v.seeking) {
      // Paused from outside before its end (a browser pauses a muted clip
      // in a hidden page): show Play again, not Pause over a still frame.
      if (v.paused && v.currentTime < base.end - 0.08) {
        playing = false
        status('Playback paused. Press Play to continue.')
        paint()
        return
      }
      position = Math.max(
        0,
        Math.min(
          boundary(),
          ((v.currentTime - base.start) / (base.end - base.start)) * boundary()
        )
      )
      if (v.currentTime >= base.end - 0.08 || v.ended) {
        v.pause()
        v.currentTime = base.end - 0.08
        position = boundary()
        if (total() > boundary()) {
          clocked = true
          clockFrom = boundary()
          extraEpoch = performance.now()
        }
      }
    }
    update(c.moment.start + position)
    paint()
    if (position >= total() - 0.01) {
      position = total()
      playing = false
      v?.pause()
      paint()
      return
    }
    frame = requestAnimationFrame(tick)
  }
  /** One moment's phrases on the Voice track, from where it starts there. */
  function phraseButtons(
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
  const wordSpans = (m: Moment) =>
    wordsOf(m.extension?.baseLines ?? m.lines)
      .map((w) => `<span data-ds-word>${escape(w)}</span>`)
      .join(' ') +
    (m.extension
      ? `<span class="ds-divider">Animation holds · keep talking</span>${wordsOf(
          m.extension.text
        )
          .map(
            (w) =>
              `<span data-ds-word class="ds-extra-word">${escape(w)}</span>`
          )
          .join(' ')}`
      : '')
  /**
   * The whole scene on one timeline: each moment's animation on the Visual
   * track, every phrase on the Voice track, and one playhead across them all.
   */
  function sceneTimeline(c: NonNullable<ReturnType<typeof ctx>>) {
    const moments = c.scene.moments,
      start = sceneStart(),
      a = axis(),
      view = $('scroll').clientWidth || 600,
      width = Math.round(view * zoom),
      perSecond = width / a,
      step =
        [0.5, 1, 2, 5, 10, 15, 30, 60, 120].find((n) => n * perSecond >= 52) ??
        120
    $('timeline').style.width = `${width}px`
    $('ruler').innerHTML = Array.from(
      { length: Math.ceil(a / step) },
      (_, i) => i * step
    )
      .filter((at) => at === 0 || at <= a - step / 2)
      .map(
        (at) =>
          `<span style="left:${(at / a) * 100}%">${time(start + at).replace('.0', '')}</span>`
      )
      .join('')
    // The Visual track is a filmstrip of the animation across the scene.
    const src = animated()?.getAttribute('src') || '',
      tile = 80,
      strip = src ? `${src}|${width}|${key}` : ''
    if (strip !== stripKey) {
      stripKey = strip
      $('strip').innerHTML = src
        ? Array.from({ length: Math.ceil(width / tile) }, (_, i) => {
            let at = 0
            try {
              at = animationSecond(
                c.scene,
                start + Math.min(a, ((i + 0.5) * tile) / perSecond),
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
        : ''
      for (const img of $('strip').querySelectorAll<HTMLImageElement>(
        'img[data-drawing]'
      ))
        void drawFrame(
          src,
          Number(img.dataset.frame),
          () => img.isConnected
        ).then((url) => {
          if (!img.isConnected) return
          img.src = url
          img.removeAttribute('data-drawing')
        })
    }
    $('strip').hidden = !src
    // Moments are parts of the one timeline, cut apart by a line.
    $('moments').innerHTML = moments
      .map((m, i) => {
        const length = m.end - m.start,
          b = dialogueBoundary(m)
        return `<button type="button" class="ds-moment" data-ds-moment="${i}" style="left:${((m.start - start) / a) * 100}%;width:${(length / a) * 100}%" aria-label="Moment ${i + 1}, from ${time(m.start)}" title="Moment ${i + 1} · ${escape(m.lines)}"><b>${i + 1}</b>${
          src ? '' : '<span>Wireframe</span>'
        }${
          length - b > 0.05
            ? `<span class="ds-moment-hold" style="left:${(b / length) * 100}%"></span>`
            : ''
        }</button>`
      })
      .join('')
    $('cuts').innerHTML = moments
      .slice(1)
      .map((m) => `<i style="left:${((m.start - start) / a) * 100}%"></i>`)
      .join('')
    $('phrases').innerHTML = moments
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
    const most = zoomMost()
    $('zoom')
      .querySelectorAll<HTMLButtonElement>('[data-ds-zoom]')
      .forEach((button) => {
        button.disabled =
          button.dataset.dsZoom === 'in' ? zoom >= most - 0.001 : zoom <= 1
      })
    if (editing) return
    wordStarts = []
    shownWord = -1
    let count = 0
    $('words').innerHTML = moments
      .map((m, i) => {
        wordStarts[i] = count
        count +=
          wordsOf(m.extension?.baseLines ?? m.lines).length +
          (m.extension ? wordsOf(m.extension.text).length : 0)
        return `<span class="ds-moment-words"><span class="ds-mark" aria-hidden="true">${i + 1}</span>${wordSpans(m)}</span>`
      })
      .join(' ')
  }
  /** The closest zoom: about a quarter of a second to every 65 pixels. */
  const zoomMost = () =>
    Math.max(1, (260 * total()) / ($('scroll').clientWidth || 600))
  /** Zoom the scene's timeline, keeping the playhead (or the pointer) still. */
  function setZoom(next: number, anchor?: number) {
    if (!panel || !through()) return
    const value = Math.max(1, Math.min(zoomMost(), next))
    if (Math.abs(value - zoom) < 0.001) return
    const scroll = $('scroll'),
      before = $('timeline').clientWidth,
      at =
        anchor ??
        (Math.min(position, total()) / Math.max(axis(), 0.01)) * before -
          scroll.scrollLeft,
      fraction = before ? (scroll.scrollLeft + at) / before : 0
    zoom = value
    timeline()
    scroll.scrollLeft = Math.max(0, fraction * $('timeline').clientWidth - at)
  }
  function timeline() {
    if (!panel) return
    const c = ctx()
    if (!c) return
    const m = c.moment,
      scene = through()
    $('animation').hidden = scene
    $('hold').hidden = scene || !text()
    $('moments').hidden = !scene
    $('cuts').hidden = !scene
    $('zoom').hidden = !scene
    if (!scene) $('strip').hidden = true
    $('boundary').parentElement!.hidden = scene
    if (scene) sceneTimeline(c)
    else {
      const b = boundary(),
        a = axis()
      $('timeline').style.setProperty('--boundary', `${(b / a) * 100}%`)
      $('timeline').style.width =
        `${Math.max($('scroll').clientWidth, a * 65)}px`
      $('ruler').innerHTML = Array.from({ length: Math.ceil(a / 2) }, (_, i) =>
        i * 2 >= b - 0.5 && i * 2 < b + 1.5
          ? ''
          : `<span style="left:${((i * 2) / a) * 100}%">${time(i * 2).replace('.0', '')}</span>`
      ).join('')
      $('boundary').textContent = 'Animation ends'
      $('animation').innerHTML =
        `${icon('video')}<span>${video() ? 'Animation' : 'Wireframe · animation not made yet'} <small>${b.toFixed(1)}s</small></span><span>↔</span>`
      $('phrases').innerHTML =
        phraseButtons(m, 0, a, b, total(), text()) +
        (!text() && m.camera !== 'none'
          ? `<button type="button" class="ds-add" data-ds="add" style="left:calc(${(b / a) * 100}% + 6px);right:0">${icon('plus')} Keep talking</button>`
          : '')
      if (!editing) {
        $('words').innerHTML = wordSpans(m)
        shownWord = -1
      }
    }
    $('seek').setAttribute('max', String(total()))
    const choosing = Boolean(host && c.scope && c.scene.moments.length > 1)
    $('scope').hidden = !choosing
    panel
      .querySelectorAll<HTMLButtonElement>('[data-ds-scope]')
      .forEach((button) => {
        button.setAttribute(
          'aria-pressed',
          String(button.dataset.dsScope === (c.scope || 'moment'))
        )
        button.disabled = editing || c.busy
      })
    $('save').toggleAttribute('disabled', saving || (!text() && !m.extension))
    $('edit').hidden = scene || !m.extension || editing || c.busy
    panel.classList.toggle('is-editing', editing)
    panel.classList.toggle('is-scene', scene)
    $('read').hidden = editing
    $('editor').hidden = !editing
    root
      .querySelectorAll<HTMLButtonElement>(
        '[data-action=practice-start],[data-action=practice-replay],[data-action=record-moment]'
      )
      .forEach((button) => (button.disabled = editing))
    // Before the scene has an animation, Play still plays: the words read
    // along over the wireframe (a disabled Play said nothing about why).
    $('animation').toggleAttribute('disabled', editing || c.busy)
    $('play').toggleAttribute('disabled', editing || c.busy)
    $('replay').toggleAttribute('disabled', editing || c.busy)
    $('seek').toggleAttribute('disabled', editing || c.busy)
    panel
      .querySelectorAll<HTMLButtonElement>(
        '[data-jump],.ds-add,[data-ds-moment]'
      )
      .forEach((el) => (el.disabled = editing || c.busy))
    paint()
    layout()
  }
  function paint(at?: number) {
    if (!panel) return
    const c = ctx()
    if (!c) return
    const scene = through(),
      from = scene ? sceneStart() : c.moment.start
    if (at !== undefined && !playing && !editing)
      position = Math.max(0, at - from)
    const second = from + Math.min(position, total()),
      index = scene ? momentAt(second) : c.index,
      moment = c.scene.moments[index] || c.moment,
      ended = position >= total() - 0.02,
      // The whole scene reads the scene's clock.
      shown = scene ? sceneStart() : 0
    $('time').textContent = `${time(shown + position)} / ${time(
      shown + total()
    )}`
    $('seek').setAttribute(
      'aria-valuetext',
      `${(shown + position).toFixed(1)} of ${(shown + total()).toFixed(1)} seconds`
    )
    $('play').textContent = playing
      ? 'Ⅱ Pause'
      : ended
        ? scene
          ? '▶ Replay scene'
          : '▶ Replay'
        : '▶ Play'
    $('replay').setAttribute(
      'aria-label',
      scene ? 'Play the scene from the start' : 'Replay animation'
    )
    $('playhead').style.left =
      `${(Math.min(position, total()) / axis()) * 100}%`
    ;($('seek') as HTMLInputElement).value = String(Math.min(position, total()))
    $('mode').textContent = c.label
    if (scene) {
      panel
        .querySelectorAll<HTMLElement>('[data-ds-moment]')
        .forEach((block, i) => {
          block.classList.toggle('is-current', i === index)
          block.classList.toggle('is-played', i < index)
          if (i === index) block.setAttribute('aria-current', 'step')
          else block.removeAttribute('aria-current')
        })
      // A scene too long to fit scrolls along, a view at a time.
      const scroll = $('scroll'),
        width = $('timeline').clientWidth,
        view = scroll.clientWidth
      if (playing && width > view + 1) {
        const x = (Math.min(position, total()) / axis()) * width
        if (x > scroll.scrollLeft + view * 0.8 || x < scroll.scrollLeft)
          scroll.scrollTo?.({
            left: Math.max(0, x - view * 0.2),
            behavior: 'smooth'
          })
      }
    }
    // Until the scene has its animation, say so, and offer to make it here.
    const making = c.animation === 'making',
      held = second - moment.start >= dialogueBoundary(moment) - 0.08
    $('remaining').textContent = video()
      ? scene
        ? held && moment.end - moment.start > dialogueBoundary(moment) + 0.05
          ? 'Animation holds · keep speaking'
          : `Moment ${index + 1} of ${c.scene.moments.length}`
        : held
          ? 'Animation holds · keep speaking'
          : `${Math.max(0, boundary() - position).toFixed(1)}s of animation left`
      : making
        ? 'Making the animation… it plays here when ready'
        : 'No animation yet · the words play over the wireframe'
    const make = panel.querySelector<HTMLButtonElement>('[data-ds-make]')
    if (make) make.hidden = Boolean(video()) || making || editing
    if (editing) return
    const active = scene
      ? (wordStarts[index] ?? 0) + dialogueWordAt(moment, second)
      : dialogueWordAt(c.moment, second)
    panel.querySelectorAll<HTMLElement>('[data-ds-word]').forEach((el, i) => {
      el.classList.toggle('current', i === active)
      el.classList.toggle('read', i < active)
      el.toggleAttribute('aria-current', i === active)
      // Scroll once per word: gently while playing, so the eye can follow
      // the lines, and straight there after a jump.
      if (i === active && active !== shownWord) {
        shownWord = active
        const read = $('read'),
          r = el.getBoundingClientRect(),
          v = read.getBoundingClientRect()
        if (r.bottom > v.bottom - 12 || r.top < v.top + 5) {
          const top = read.scrollTop + r.top - v.top - 20
          if (read.scrollTo)
            read.scrollTo({ top, behavior: playing ? 'smooth' : 'auto' })
          else read.scrollTop = top
        }
      }
    })
  }
  function open() {
    const c = ctx()
    if (!c || c.busy || editing || through()) return
    stop()
    seek(boundary())
    editing = true
    draft = c.moment.extension?.text || ''
    completion = ''
    target = Math.max(10, Math.ceil(estimateSpeech(draft) / 5) * 5)
    ai = false
    $('input').innerHTML =
      escape(draft || '\u200b') + '<span data-completion></span>'
    $('context').textContent = c.moment.extension?.baseLines ?? c.moment.lines
    ;($('length') as HTMLInputElement).max = String(Math.max(30, target + 10))
    ;($('length') as HTMLInputElement).value = String(target)
    $('target').textContent = `~${target}s`
    status('')
    timeline()
    focusEnd()
  }
  function invalidate() {
    request++
    clearTimeout(debounce)
    completion = ''
    $('input').querySelector('[data-completion]')?.replaceChildren()
    draft = readDraft()
    timeline()
  }
  async function suggest() {
    const c = ctx()
    if (!c || !editing || suggesting) return
    ai = true
    suggesting = true
    const token = ++request,
      typed = readDraft()
    status('Writing a suggestion…')
    $('suggest').setAttribute('disabled', '')
    try {
      const result = await api.suggestExtension(
        c.projectId,
        c.scene.id,
        c.moment.id,
        typed,
        target,
        c.moment.recordingKey
      )
      if (token !== request || !editing) return
      completion = (typed && !/\s$/.test(typed) ? ' ' : '') + result.text.trim()
      let pending = $('input').querySelector('[data-completion]')
      if (!pending) {
        pending = document.createElement('span')
        pending.setAttribute('data-completion', '')
        $('input').append(pending)
      }
      pending.textContent = completion
      draft = typed
      timeline()
      status('Tab to accept · click any suggested word to edit')
    } catch (e) {
      if (token === request)
        status(
          e instanceof Error
            ? e.message
            : 'Suggestion unavailable. Keep typing your own dialogue.'
        )
    } finally {
      suggesting = false
      if (panel) $('suggest').removeAttribute('disabled')
      if (token !== request && editing && ai) {
        clearTimeout(debounce)
        debounce = setTimeout(() => void suggest(), 800)
      }
    }
  }
  function layout() {
    const area = root.querySelector<HTMLElement>('.has-dialogue-studio'),
      stage = area?.querySelector<HTMLElement>('.video-stage')
    if (!area || !stage) return
    const style = getComputedStyle(area),
      children = [...area.children].filter(
        (el) =>
          el !== stage &&
          getComputedStyle(el).display !== 'none' &&
          getComputedStyle(el).position !== 'absolute'
      )
    const available =
      area.clientHeight -
      parseFloat(style.paddingTop) -
      parseFloat(style.paddingBottom) -
      children.reduce((n, el) => {
        const s = getComputedStyle(el)
        return (
          n +
          el.getBoundingClientRect().height +
          parseFloat(s.marginTop) +
          parseFloat(s.marginBottom)
        )
      }, 0) -
      parseFloat(style.gap) * children.length
    const height = Math.max(
      80,
      Math.min(
        available,
        ((area.clientWidth -
          parseFloat(style.paddingLeft) -
          parseFloat(style.paddingRight)) /
          16) *
          9
      )
    )
    stage.style.width = `${(height * 16) / 9}px`
    stage.style.height = `${height}px`
  }
  const resize = new ResizeObserver(() => {
    if (panel?.isConnected) layout()
  })
  resize.observe(root)
  window.addEventListener('resize', layout)
  function mount() {
    const c = ctx()
    if (!c) {
      stop()
      panel?.remove()
      panel = null
      key = ''
      editing = false
      request++
      return
    }
    // The whole scene keeps one panel from moment to moment.
    const scene = through(),
      next = scene
        ? `${c.projectId}/${c.scene.id}/scene/${c.scene.moments
            .map((m) => `${m.id}:${m.recordingKey}`)
            .join(',')}`
        : `${c.projectId}/${c.scene.id}/${c.moment.id}/${c.moment.recordingKey}`
    if (key !== next) {
      stop()
      panel?.remove()
      panel = null
      key = next
      editing = false
      request++
      shownWord = -1
      position = Math.max(0, c.second - (scene ? sceneStart() : c.moment.start))
    }
    if (!panel) {
      panel = document.createElement('section')
      panel.className = 'dialogue-studio'
      panel.setAttribute('aria-label', 'Synchronized animation and dialogue')
      panel.innerHTML = `
   <div class="ds-transport"><div><button type="button" data-ds="play">▶ Play</button><button type="button" data-ds="replay" aria-label="Replay animation">↻</button><time data-ds="time"></time><div class="ds-scope" data-ds="scope" role="group" aria-label="Play" hidden><button type="button" data-ds-scope="moment" aria-pressed="true">This moment</button><button type="button" data-ds-scope="scene" aria-pressed="false">Whole scene</button></div></div><div class="ds-animation-state"><span data-ds="remaining"></span><button type="button" class="primary" data-action="make-animation" data-ds-make hidden>Make the animation</button><div class="ds-zoom" data-ds="zoom" role="group" aria-label="Timeline zoom" hidden><button type="button" data-ds-zoom="out" aria-label="Zoom out" title="Zoom out">−</button><button type="button" data-ds-zoom="fit" title="Fit the whole scene">Fit</button><button type="button" data-ds-zoom="in" aria-label="Zoom in" title="Zoom in">+</button></div></div></div>
   <div class="ds-tracks"><div class="ds-labels"><span></span><span>${icon('video')} Visual</span><span>${icon('text')} Voice</span>\
</div>\
<div data-ds="scroll" class="ds-scroll">\
<div data-ds="timeline" class="ds-timeline">\
<div data-ds="ruler" class="ds-ruler">\
</div>\
<div class="ds-visual">\
<button type="button" data-ds="animation">\
</button>\
<div data-ds="hold" class="ds-hold">Last frame holds</div>\
<div data-ds="strip" class="ds-strip" aria-hidden="true" hidden>\
</div>\
<div data-ds="moments" class="ds-moments" hidden>\
</div>\
</div>\
<div data-ds="phrases" class="ds-phrases">\
</div>\
<div class="ds-boundary">\
<span data-ds="boundary">\
</span>\
</div>\
<div data-ds="cuts" class="ds-cuts" aria-hidden="true" hidden>\
</div>\
<div data-ds="playhead" class="ds-playhead">\
</div>\
<input type="range" data-ds="seek" aria-label="Dialogue preview position" min="0" step="0.05" value="0">\
</div>\
</div>\
</div>
   <div class="ds-prompter">\
<div class="ds-heading">\
<strong data-ds="mode">• Read along</strong>\
<small>Estimated pacing</small>\
<button type="button" data-ds="edit">Edit extra dialogue</button>\
</div>\
<div data-ds="read" class="ds-read">\
<span class="ds-caret">›</span>\
<p data-ds="words">\
</p>\
</div>\
<div data-ds="editor" hidden>\
<div class="ds-writing">\
<span data-ds="context">\
</span> <span data-ds="input" contenteditable="plaintext-only" role="textbox" aria-label="Extra dialogue" aria-multiline="true">\
</span>\
</div>\
<div class="ds-tools">\
<label>Extra time <input data-ds="length" type="range" aria-label="Extra time" min="5" max="30" step="5" value="10">\
<output data-ds="target">~10s</output>\
</label>\
<button type="button" data-ds="suggest">✧ Suggest continuation</button>\
<button type="button" data-ds="cancel">Cancel</button>\
<button type="button" data-ds="save" class="primary">Save extension</button>\
</div>\
<p class="ds-save-note">Animation stays unchanged. This moment will need a new recording.</p>\
</div>\
</div>\
<div data-ds="status" role="status" class="ds-status">\
</div>`
      panel.addEventListener('click', (event) => {
        const button = (event.target as Element).closest<HTMLButtonElement>(
          'button'
        )
        if (!button || button.disabled) return
        const action = button.dataset.ds
        if (action === 'play') {
          if (playing) stop()
          else void play()
        }
        if (action === 'replay' || action === 'animation') {
          seek(0)
          void play()
        }
        if (button.dataset.dsScope)
          host?.scope(button.dataset.dsScope === 'scene' ? 'scene' : 'moment')
        if (button.dataset.dsZoom)
          setZoom(
            button.dataset.dsZoom === 'fit'
              ? 1
              : zoom * (button.dataset.dsZoom === 'in' ? 1.6 : 1 / 1.6)
          )
        // A moment on the whole scene's timeline: play on from its start.
        if (button.dataset.dsMoment) {
          const moment = ctx()?.scene.moments[Number(button.dataset.dsMoment)]
          if (moment) seek(moment.start - sceneStart())
        }
        if (button.dataset.jump) seek(Number(button.dataset.jump))
        if (action === 'add' || action === 'edit') open()
        if (action === 'suggest') void suggest()
        if (action === 'cancel') {
          editing = false
          request++
          timeline()
          status('')
        }
        if (action === 'save' && !saving) {
          const c = ctx()
          if (!c) return
          saving = true
          button.disabled = true
          const value = (readDraft() + completion).trim()
          status('Saving dialogue…')
          void api
            .extension(
              c.projectId,
              c.scene.id,
              c.moment.id,
              value,
              c.moment.recordingKey
            )
            .then((result) => {
              editing = false
              request++
              saved(result)
              status('Saved · record this moment again')
            })
            .catch((e) => status(e.message))
            .finally(() => {
              saving = false
              button.disabled = false
            })
        }
      })
      $('seek').addEventListener('input', () =>
        seek(Number(($('seek') as HTMLInputElement).value))
      )
      // Ctrl or ⌘ with the wheel, or a pinch, zooms the scene's timeline.
      $('scroll').addEventListener(
        'wheel',
        (event) => {
          if (!through() || !(event.ctrlKey || event.metaKey)) return
          event.preventDefault()
          setZoom(
            zoom * Math.exp(-event.deltaY / 300),
            event.clientX - $('scroll').getBoundingClientRect().left
          )
        },
        { passive: false }
      )
      $('length').addEventListener('input', () => {
        target = Number(($('length') as HTMLInputElement).value)
        $('target').textContent = `~${target}s`
        invalidate()
        debounce = setTimeout(() => void suggest(), 700)
      })
      $('input').addEventListener('beforeinput', () => {
        if (completion) materialize()
        request++
      })
      $('input').addEventListener('pointerup', () => {
        const selection = getSelection(),
          pending = $('input').querySelector('[data-completion]')
        if (
          completion &&
          pending &&
          selection?.rangeCount &&
          (pending.contains(selection.anchorNode) ||
            (!selection.isCollapsed &&
              selection.getRangeAt(0).intersectsNode(pending)))
        ) {
          materialize()
          timeline()
        }
      })
      $('input').addEventListener('input', (event) => {
        draft = readDraft()
        completion = ''
        timeline()
        clearTimeout(debounce)
        if (ai && !(event as InputEvent).isComposing)
          debounce = setTimeout(() => void suggest(), 1200)
      })
      $('input').addEventListener('keydown', (event) => {
        if (event.key === 'Tab' && completion) {
          event.preventDefault()
          materialize()
          focusEnd()
          timeline()
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          invalidate()
        }
      })
    }
    const actions = root.querySelector('.video-actions')
    actions?.before(panel)
    root.querySelector('.practice-panel')?.remove()
    root.querySelector('.recording-script')?.setAttribute('hidden', '')
    root.querySelector('[data-animation-status]')?.setAttribute('hidden', '')
    root.querySelector('.video-stage .layered-controls')?.remove()
    root.querySelector('.stage-area')?.classList.add('has-dialogue-studio')
    if (c.busy && playing) stop()
    timeline()
    paint(c.second)
    layout()
  }
  root.addEventListener(
    'click',
    (event) => {
      if (
        (event.target as Element).closest(
          '[data-action="practice-start"],[data-action="practice-replay"],[data-action="record-moment"],[data-action="practice"]'
        )
      )
        stop()
    },
    true
  )
  window.addEventListener('pagehide', stop)
  return {
    mount,
    paint,
    stop,
    isPlaying: () => playing,
    isEditing: () => editing
  }
}
