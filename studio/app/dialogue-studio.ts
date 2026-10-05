import type { Moment, Scene } from '../shared/model'
import {
  dialogueBoundary,
  dialogueWordAt,
  wordsOf,
  estimateSpeech
} from '../shared/dialogue'
import { escape } from './ui'
import { api } from './api'
import type { Snapshot } from '../shared/api'
type Context = {
  projectId: string
  scene: Scene
  index: number
  second: number
  busy: boolean
  recording: boolean
  label: string
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
  saved: (snapshot: Snapshot) => void
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
  const total = () =>
    editing
      ? boundary() + estimateSpeech(text())
      : ctx()
        ? ctx()!.moment.end - ctx()!.moment.start
        : 0
  const axis = () => Math.max(boundary() + 2, total())
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
    clocked = false
    extraEpoch = 0
    playRequest++
    video()?.pause()
    cancelAnimationFrame(frame)
    paint()
  }
  function seek(at: number) {
    const c = ctx(),
      v = video(),
      base = c?.scene.animation?.moments[c.index]
    if (!c) return
    const resume = playing
    stop()
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
  function timeline() {
    if (!panel) return
    const c = ctx()
    if (!c) return
    const m = c.moment,
      b = boundary(),
      a = axis(),
      base = m.extension?.baseLines ?? m.lines
    $('timeline').style.setProperty('--boundary', `${(b / a) * 100}%`)
    $('timeline').style.width = `${Math.max($('scroll').clientWidth, a * 65)}px`
    $('ruler').innerHTML = Array.from({ length: Math.ceil(a / 2) }, (_, i) =>
      i * 2 >= b - 0.5 && i * 2 < b + 1.5
        ? ''
        : `<span style="left:${((i * 2) / a) * 100}%">${time(i * 2).replace('.0', '')}</span>`
    ).join('')
    $('boundary').textContent = 'Animation ends'
    $('animation').innerHTML =
      `${icon('video')}<span>${video() ? 'Animation' : 'Wireframe · animation not made yet'} <small>${b.toFixed(1)}s</small></span><span>↔</span>`
    $('hold').hidden = !text()
    const phrases = base.match(/[^,.;!?]+[,.;!?]*/g) || [base]
    let word = 0
    const count = wordsOf(base).length
    $('phrases').innerHTML =
      phrases
        .map((phrase) => {
          const from = (word / count) * b
          word += wordsOf(phrase).length
          return `<button type="button" data-jump="${from}" style="left:${(from / a) * 100}%;width:calc(${(((word / count) * b - from) / a) * 100}% - 4px)" title="${escape(phrase.trim())}">${escape(phrase.trim())}</button>`
        })
        .join('') +
      (text()
        ? `<button type="button" class="ds-extra" data-jump="${b}" style="left:${(b / a) * 100}%;width:calc(${((total() - b) / a) * 100}% - 4px)">${escape(text())}</button>`
        : m.camera !== 'none'
          ? `<button type="button" class="ds-add" data-ds="add" style="left:calc(${(b / a) * 100}% + 6px);right:0">${icon('plus')} Keep talking</button>`
          : '')
    $('seek').setAttribute('max', String(total()))
    $('seek').setAttribute(
      'aria-valuetext',
      `${position.toFixed(1)} of ${total().toFixed(1)} seconds`
    )
    if (!editing)
      $('words').innerHTML =
        wordsOf(base)
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
    $('save').toggleAttribute('disabled', saving || (!text() && !m.extension))
    $('edit').hidden = !m.extension || editing || c.busy
    panel.classList.toggle('is-editing', editing)
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
      .querySelectorAll<HTMLButtonElement>('[data-jump],.ds-add')
      .forEach((el) => (el.disabled = editing || c.busy))
    paint()
    layout()
  }
  function paint(at?: number) {
    if (!panel) return
    const c = ctx()
    if (!c) return
    if (at !== undefined && !playing && !editing)
      position = Math.max(0, at - c.moment.start)
    $('time').textContent = `${time(position)} / ${time(total())}`
    $('play').textContent = playing
      ? 'Ⅱ Pause'
      : position >= total() - 0.02
        ? '▶ Replay'
        : '▶ Play'
    $('playhead').style.left =
      `${(Math.min(position, total()) / axis()) * 100}%`
    ;($('seek') as HTMLInputElement).value = String(Math.min(position, total()))
    $('mode').textContent = c.label
    $('remaining').textContent = !video()
      ? 'No animation yet · the words play over the wireframe'
      : position >= boundary() - 0.08
        ? 'Animation holds · keep speaking'
        : `${Math.max(0, boundary() - position).toFixed(1)}s of animation left`
    if (editing) return
    const active = dialogueWordAt(c.moment, c.moment.start + position)
    panel.querySelectorAll<HTMLElement>('[data-ds-word]').forEach((el, i) => {
      el.classList.toggle('current', i === active)
      el.classList.toggle('read', i < active)
      el.toggleAttribute('aria-current', i === active)
      if (i === active) {
        const r = el.getBoundingClientRect(),
          v = $('read').getBoundingClientRect()
        if (r.bottom > v.bottom - 12 || r.top < v.top + 5)
          $('read').scrollTop += r.top - v.top - 20
      }
    })
  }
  function open() {
    const c = ctx()
    if (!c || c.busy || editing) return
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
        (el) => el !== stage && getComputedStyle(el).display !== 'none'
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
    const next = `${c.projectId}/${c.scene.id}/${c.moment.id}/${c.moment.recordingKey}`
    if (key !== next) {
      stop()
      panel?.remove()
      panel = null
      key = next
      editing = false
      request++
      position = Math.max(0, c.second - c.moment.start)
    }
    if (!panel) {
      panel = document.createElement('section')
      panel.className = 'dialogue-studio'
      panel.setAttribute('aria-label', 'Synchronized animation and dialogue')
      panel.innerHTML = `
   <div class="ds-transport"><div><button type="button" data-ds="play">▶ Play</button><button type="button" data-ds="replay" aria-label="Replay animation">↻</button><time data-ds="time"></time></div><span data-ds="remaining"></span></div>
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
</div>\
<div data-ds="phrases" class="ds-phrases">\
</div>\
<div class="ds-boundary">\
<span data-ds="boundary">\
</span>\
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
