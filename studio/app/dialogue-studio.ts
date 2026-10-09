import {
  dialogueBoundary,
  dialogueWordAt,
  estimateSpeech
} from '../shared/dialogue'
import { escape } from './ui'
import { api } from './api'
import {
  fillFilmstrip,
  momentIndexAt,
  sceneParts,
  sceneWords,
  steerAnimation,
  time,
  wordSpans
} from './scene-timeline'
import {
  animationNote,
  caretToEnd,
  enableControls,
  fitStage,
  followPlayhead,
  keepPoint,
  markMoment,
  markWord,
  momentTimeline,
  placePanel,
  spotlight,
  studioMarkup,
  takeSuggestion,
  transportWords,
  typedDraft
} from './dialogue-studio-view'
import type { Snapshot } from '../shared/api'
import type { Context, Host } from './dialogue-studio-types'
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
  // In practice the scene's map is on show whatever Play plays: positions
  // count from the scene's start, and nothing is rebuilt between moments.
  const mapped = () => {
    const c = ctx()
    return Boolean(host && c?.scope && c.scene.moments.length > 1 && !editing)
  }
  const through = () => mapped() && ctx()!.scope === 'scene'
  const sceneStart = () => ctx()?.scene.moments[0]?.start ?? 0
  const total = () =>
    mapped()
      ? (ctx()!.scene.moments.at(-1)?.end ?? 0) - sceneStart()
      : editing
        ? boundary() + estimateSpeech(text())
        : ctx()
          ? ctx()!.moment.end - ctx()!.moment.start
          : 0
  const axis = () => (mapped() ? total() : Math.max(boundary() + 2, total()))
  /** What Play plays: the whole scene, or the moment on show. */
  const span = (): [number, number] => {
    const c = ctx()!
    return !mapped()
      ? [0, total()]
      : through()
        ? [0, total()]
        : [c.moment.start - sceneStart(), c.moment.end - sceneStart()]
  }
  /** The moment playing at a second of the scene. */
  const momentAt = (second: number) =>
    momentIndexAt(ctx()?.scene.moments || [], second)
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
  const readDraft = () => typedDraft($('input'))
  function materialize() {
    takeSuggestion($('input'))
    completion = ''
    draft = readDraft()
    request++
  }
  const focusEnd = () => caretToEnd($('input'))
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
  /** Keep the animation on the scene's clock; false if paused from outside. */
  function follow(v: HTMLVideoElement, live: boolean) {
    const next = steerAnimation(
      v,
      ctx()!.scene,
      sceneStart() + position,
      live,
      rolling
    )
    rolling = next.rolling
    return !next.stopped
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
    if (mapped()) {
      position = Math.max(0, Math.min(total(), at))
      const animation = animated()
      if (animation) follow(animation, false)
      if (through()) showAt(sceneStart() + position)
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
  /** A point on the map; practising one moment, a point in another picks it. */
  function jumpTo(at: number) {
    const c = ctx(),
      index = momentAt(sceneStart() + at)
    if (c && !through() && index !== c.index) {
      stop()
      host?.pick(index)
    }
    seek(at)
  }
  async function play() {
    const c = ctx(),
      v = video(),
      base = c?.scene.animation?.moments[c.index]
    if (!c || editing || c.busy) return
    const [from, to] = span()
    if (position < from - 0.01 || position >= to - 0.03) seek(from)
    const token = ++playRequest
    // On the map, Play runs on the scene's clock and the animation follows.
    if (mapped()) {
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
    if (mapped()) {
      const [, to] = span()
      position = Math.min(
        to,
        clockFrom + (performance.now() - extraEpoch) / 1000
      )
      const animation = animated()
      if (animation && !follow(animation, true)) {
        playing = false
        status('Playback paused. Press Play to continue.')
        paint()
        return
      }
      if (through()) showAt(sceneStart() + position)
      update(sceneStart() + position)
      paint()
      if (position >= to - 0.01) {
        position = to
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
  /**
   * The whole scene on one timeline: each moment's animation on the Visual
   * track, every phrase on the Voice track, and one playhead across them all.
   */
  function sceneTimeline(c: NonNullable<ReturnType<typeof ctx>>) {
    const a = axis(),
      width = Math.round(($('scroll').clientWidth || 600) * zoom),
      // The Visual track is a filmstrip of the animation across the scene.
      src = animated()?.getAttribute('src') || '',
      parts = sceneParts(c.scene.moments, a, width / a, Boolean(src)),
      strip = src ? `${src}|${width}|${key}` : ''
    $('timeline').style.width = `${width}px`
    $('ruler').innerHTML = parts.ruler
    if (strip !== stripKey) {
      stripKey = strip
      fillFilmstrip($('strip'), c.scene, src, a, width)
    }
    $('strip').hidden = !src
    $('moments').innerHTML = parts.moments
    $('cuts').innerHTML = parts.cuts
    $('phrases').innerHTML = parts.phrases
    const most = zoomMost()
    $('zoom')
      .querySelectorAll<HTMLButtonElement>('[data-ds-zoom]')
      .forEach((button) => {
        button.disabled =
          button.dataset.dsZoom === 'in' ? zoom >= most - 0.001 : zoom <= 1
      })
    if (editing) return
    const words = sceneWords(c.scene.moments)
    $('words').innerHTML = words.html
    wordStarts = words.starts
    shownWord = -1
  }
  /** The closest zoom: about a quarter of a second to every 65 pixels. */
  const zoomMost = () =>
    Math.max(1, (260 * total()) / ($('scroll').clientWidth || 600))
  /** Zoom the scene's timeline, keeping the playhead (or the pointer) still. */
  function setZoom(next: number, anchor?: number) {
    if (!panel || !mapped()) return
    const value = Math.max(1, Math.min(zoomMost(), next))
    if (Math.abs(value - zoom) < 0.001) return
    keepPoint(
      $('scroll'),
      $('timeline'),
      anchor ??
        (Math.min(position, total()) / Math.max(axis(), 0.01)) *
          $('timeline').clientWidth -
          $('scroll').scrollLeft,
      () => {
        zoom = value
        timeline()
      }
    )
  }
  function timeline() {
    if (!panel) return
    const c = ctx()
    if (!c) return
    const m = c.moment,
      scene = mapped(),
      one = scene && !through()
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
        a = axis(),
        width = Math.max($('scroll').clientWidth, a * 65),
        parts = momentTimeline(m, b, a, total(), text(), !!video(), width / a)
      $('timeline').style.setProperty('--boundary', `${(b / a) * 100}%`)
      $('timeline').style.width = `${width}px`
      $('ruler').innerHTML = parts.ruler
      $('boundary').textContent = 'Animation ends'
      $('animation').innerHTML = parts.animation
      $('phrases').innerHTML = parts.phrases
      if (!editing) {
        $('words').innerHTML = wordSpans(m)
        shownWord = -1
      }
    }
    $('seek').setAttribute('max', String(total()))
    $('scope').hidden = !(host && c.scope && c.scene.moments.length > 1)
    panel
      .querySelectorAll<HTMLButtonElement>('[data-ds-scope]')
      .forEach((button) =>
        button.setAttribute(
          'aria-pressed',
          String(button.dataset.dsScope === (c.scope || 'moment'))
        )
      )
    if (scene) spotlight($('spot'), one, ...span(), total())
    else $('spot').hidden = true
    $('save').toggleAttribute('disabled', saving || (!text() && !m.extension))
    // One moment's extra dialogue is edited from its practice, on its own
    // timeline: carried on, or started for a moment on camera.
    $('edit').hidden =
      !(one ? m.extension || m.camera !== 'none' : !scene && m.extension) ||
      editing ||
      c.busy
    $('edit').textContent = m.extension
      ? 'Edit extra dialogue'
      : '+ Keep talking'
    panel.classList.toggle('is-editing', editing)
    panel.classList.toggle('is-scene', scene)
    panel.classList.toggle('is-one-moment', one)
    $('read').hidden = editing
    $('editor').hidden = !editing
    enableControls(root, panel, editing || c.busy, editing)
    paint()
    layout()
  }
  function paint(at?: number) {
    if (!panel) return
    const c = ctx()
    if (!c) return
    const scene = mapped(),
      whole = through(),
      from = scene ? sceneStart() : c.moment.start
    if (at !== undefined && !playing && !editing)
      position = Math.max(0, at - from)
    const second = from + Math.min(position, total()),
      index = whole ? momentAt(second) : c.index,
      moment = c.scene.moments[index] || c.moment,
      // The map reads the scene's clock.
      shown = scene ? sceneStart() : 0,
      words = transportWords({
        playing,
        ended: position >= span()[1] - 0.02,
        map: scene,
        whole
      })
    $('time').textContent = `${time(shown + position)} / ${time(
      shown + total()
    )}`
    $('seek').setAttribute(
      'aria-valuetext',
      `${(shown + position).toFixed(1)} of ${(shown + total()).toFixed(1)} seconds`
    )
    $('play').textContent = words.play
    $('replay').setAttribute('aria-label', words.replay)
    $('playhead').style.left =
      `${(Math.min(position, total()) / axis()) * 100}%`
    ;($('seek') as HTMLInputElement).value = String(Math.min(position, total()))
    $('mode').textContent = c.label
    if (scene) {
      markMoment(panel, index)
      if (playing)
        followPlayhead(
          $('scroll'),
          $('timeline').clientWidth,
          (Math.min(position, total()) / axis()) * $('timeline').clientWidth
        )
    }
    // Until the scene has its animation, say so, and offer to make it here.
    const making = c.animation === 'making',
      length = dialogueBoundary(moment)
    $('remaining').textContent = animationNote({
      animated: Boolean(video()),
      making,
      scene: whole,
      held: second - moment.start >= length - 0.08,
      holds: moment.end - moment.start > length + 0.05,
      index,
      count: c.scene.moments.length,
      left: moment.start + length - second
    })
    if (editing) return
    const active = scene
      ? (wordStarts[index] ?? 0) +
        dialogueWordAt(moment, Math.min(second, moment.end - 0.001))
      : dialogueWordAt(c.moment, second)
    markWord(panel, $('read'), active, active !== shownWord, playing)
    shownWord = active
  }
  function open() {
    const c = ctx()
    if (!c || c.busy || editing || through()) return
    stop()
    editing = true
    draft = c.moment.extension?.text || ''
    completion = ''
    seek(boundary())
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
  const layout = () => fitStage(root)
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
    // Practice keeps one panel for the scene, from moment to moment.
    const scene = Boolean(host && c.scope && c.scene.moments.length > 1),
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
      panel.innerHTML = studioMarkup()
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
          seek(span()[0])
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
        // A moment on the map: on from its start, or practise it alone.
        if (button.dataset.dsMoment) {
          const moment = ctx()?.scene.moments[Number(button.dataset.dsMoment)]
          if (moment) jumpTo(moment.start - sceneStart())
        }
        if (button.dataset.jump)
          (mapped() ? jumpTo : seek)(Number(button.dataset.jump))
        if (action === 'add' || action === 'edit') open()
        if (action === 'suggest') void suggest()
        if (action === 'cancel') {
          editing = false
          request++
          const c = ctx()
          if (c)
            position = Math.max(
              0,
              c.second - (mapped() ? sceneStart() : c.moment.start)
            )
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
        (mapped() ? jumpTo : seek)(
          Number(($('seek') as HTMLInputElement).value)
        )
      )
      // Ctrl or ⌘ with the wheel, or a pinch, zooms the scene's timeline.
      $('scroll').addEventListener(
        'wheel',
        (event) => {
          if (!mapped() || !(event.ctrlKey || event.metaKey)) return
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
    placePanel(root, panel)
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
