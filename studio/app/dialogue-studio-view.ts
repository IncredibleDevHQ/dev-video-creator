// The practice panel's markup and the parts of it that follow playback:
// how big its stage can be, its one-moment timeline, what it says about the
// animation, and which word and moment are on show.
import type { Moment } from '../shared/model'
import { icon, phraseButtons, time } from './scene-timeline'

/** The practice panel: transport, timeline, read-along and extra dialogue. */
export const studioMarkup = () =>
  [
    '<div class="ds-transport">',
    '<div>',
    '<button type="button" data-ds="play">▶ Play',
    '</button>',
    '<button type="button" data-ds="replay" aria-label="Replay animation">↻',
    '</button>',
    '<time data-ds="time">',
    '</time>',
    '<div class="ds-scope" data-ds="scope" role="group" aria-label="What Play plays" hidden>',
    `<button type="button" data-ds-scope="scene" aria-pressed="true" aria-label="Whole scene">${icon('scene')}`,
    '</button>',
    `<button type="button" data-ds-scope="moment" aria-pressed="false" aria-label="This moment">${icon('moment')}`,
    '</button>',
    '</div>',
    '</div>',
    '<div class="ds-animation-state">',
    '<span data-ds="remaining">',
    '</span>',
    '<button type="button" class="primary" data-action="make-animation" data-ds-make hidden>Make the animation',
    '</button>',
    '<div class="ds-zoom" data-ds="zoom" role="group" aria-label="Timeline zoom" hidden>',
    '<button type="button" data-ds-zoom="out" aria-label="Zoom out" title="Zoom out">−',
    '</button>',
    '<button type="button" data-ds-zoom="fit" title="Fit the whole scene">Fit',
    '</button>',
    '<button type="button" data-ds-zoom="in" aria-label="Zoom in" title="Zoom in">+',
    '</button>',
    '</div>',
    '</div>',
    '</div>',
    '<div class="ds-tracks">',
    '<div class="ds-labels">',
    '<span>',
    '</span>',
    `<span>${icon('video')} Visual`,
    '</span>',
    `<span>${icon('text')} Voice`,
    '</span>',
    '</div>',
    '<div data-ds="scroll" class="ds-scroll">',
    '<div data-ds="timeline" class="ds-timeline">',
    '<div data-ds="ruler" class="ds-ruler">',
    '</div>',
    '<div class="ds-visual">',
    '<button type="button" data-ds="animation">',
    '</button>',
    '<div data-ds="hold" class="ds-hold">Last frame holds',
    '</div>',
    '<div data-ds="strip" class="ds-strip" aria-hidden="true" hidden>',
    '</div>',
    '<div data-ds="moments" class="ds-moments" hidden>',
    '</div>',
    '</div>',
    '<div data-ds="phrases" class="ds-phrases">',
    '</div>',
    '<div class="ds-boundary">',
    '<span data-ds="boundary">',
    '</span>',
    '</div>',
    '<div data-ds="cuts" class="ds-cuts" aria-hidden="true" hidden>',
    '</div>',
    '<div data-ds="playhead" class="ds-playhead">',
    '</div>',
    '<input type="range" data-ds="seek" aria-label="Dialogue preview position" min="0" step="0.05" value="0">',
    '</div>',
    '</div>',
    '</div>',
    '<div class="ds-prompter">',
    '<div class="ds-heading">',
    '<strong data-ds="mode">• Read along',
    '</strong>',
    '<small>Estimated pacing',
    '</small>',
    '<button type="button" data-ds="edit">Edit extra dialogue',
    '</button>',
    '</div>',
    '<div data-ds="read" class="ds-read">',
    '<span class="ds-caret">›',
    '</span>',
    '<p data-ds="words">',
    '</p>',
    '</div>',
    '<div data-ds="editor" hidden>',
    '<div class="ds-writing">',
    '<span data-ds="context">',
    '</span> ',
    '<span data-ds="input" contenteditable="plaintext-only" role="textbox" aria-label="Extra dialogue" aria-multiline="true">',
    '</span>',
    '</div>',
    '<div class="ds-tools">',
    '<label>Extra time ',
    '<input data-ds="length" type="range" aria-label="Extra time" min="5" max="30" step="5" value="10">',
    '<output data-ds="target">~10s',
    '</output>',
    '</label>',
    '<button type="button" data-ds="suggest">✧ Suggest continuation',
    '</button>',
    '<button type="button" data-ds="cancel">Cancel',
    '</button>',
    '<button type="button" data-ds="save" class="primary">Save extension',
    '</button>',
    '</div>',
    '<p class="ds-save-note">Animation stays unchanged. This moment will need a new recording.',
    '</p>',
    '</div>',
    '</div>',
    '<div data-ds="status" role="status" class="ds-status">',
    '</div>'
  ].join('')

/** Give the stage the room the practice panel leaves, at 16 by 9. */
export function fitStage(root: HTMLElement) {
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

/** One moment's timeline: its ruler, its animation, and its phrases. */
export function momentTimeline(
  m: Moment,
  b: number,
  a: number,
  length: number,
  extra: string,
  animated: boolean
) {
  return {
    ruler: Array.from({ length: Math.ceil(a / 2) }, (_, i) =>
      i * 2 >= b - 0.5 && i * 2 < b + 1.5
        ? ''
        : `<span style="left:${((i * 2) / a) * 100}%">${time(i * 2).replace('.0', '')}</span>`
    ).join(''),
    animation: `${icon('video')}<span>${animated ? 'Animation' : 'Wireframe · animation not made yet'} <small>${b.toFixed(1)}s</small></span><span>↔</span>`,
    phrases:
      phraseButtons(m, 0, a, b, length, extra) +
      (!extra && m.camera !== 'none'
        ? `<button type="button" class="ds-add" data-ds="add" style="left:calc(${(b / a) * 100}% + 6px);right:0">${icon('plus')} Keep talking</button>`
        : '')
  }
}

/** What the transport says about the animation, until and once it plays. */
export function animationNote(state: {
  animated: boolean
  making: boolean
  scene: boolean
  held: boolean
  holds: boolean
  index: number
  count: number
  left: number
}) {
  if (!state.animated)
    return state.making
      ? 'Making the animation… it plays here when ready'
      : 'No animation yet · the words play over the wireframe'
  if (state.held && (state.holds || !state.scene))
    return 'Animation holds · keep speaking'
  return state.scene
    ? `Moment ${state.index + 1} of ${state.count}`
    : `${Math.max(0, state.left).toFixed(1)}s of animation left`
}

/** Mark the moment on show on the whole scene's timeline. */
export function markMoment(panel: HTMLElement, index: number) {
  panel.querySelectorAll<HTMLElement>('[data-ds-moment]').forEach((part, i) => {
    part.classList.toggle('is-current', i === index)
    if (i === index) part.setAttribute('aria-current', 'step')
    else part.removeAttribute('aria-current')
  })
}

/** A timeline too long to fit scrolls along with the playhead, a view at a time. */
export function followPlayhead(scroll: HTMLElement, width: number, x: number) {
  const view = scroll.clientWidth
  if (width <= view + 1) return
  if (x > scroll.scrollLeft + view * 0.8 || x < scroll.scrollLeft)
    scroll.scrollTo?.({ left: Math.max(0, x - view * 0.2), behavior: 'smooth' })
}

/**
 * Mark the word being read, and bring it into view when it is new: gently
 * while playing, so the eye can follow the lines, and straight there after a
 * jump. True when the word was brought into view.
 */
export function markWord(
  panel: HTMLElement,
  read: HTMLElement,
  active: number,
  bring: boolean,
  smooth: boolean
) {
  panel.querySelectorAll<HTMLElement>('[data-ds-word]').forEach((el, i) => {
    el.classList.toggle('current', i === active)
    el.classList.toggle('read', i < active)
    el.toggleAttribute('aria-current', i === active)
    if (i !== active || !bring) return
    const r = el.getBoundingClientRect(),
      v = read.getBoundingClientRect()
    if (r.bottom > v.bottom - 12 || r.top < v.top + 5) {
      const top = read.scrollTop + r.top - v.top - 20
      if (read.scrollTo)
        read.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' })
      else read.scrollTop = top
    }
  })
}

/**
 * Turn the panel's controls on or off together. Before the scene has an
 * animation, Play still plays: the words read along over the wireframe (a
 * disabled Play said nothing about why).
 */
export function enableControls(
  root: HTMLElement,
  panel: HTMLElement,
  off: boolean,
  editing: boolean
) {
  root
    .querySelectorAll<HTMLButtonElement>(
      '[data-action=practice-start],[data-action=practice-replay],[data-action=record-moment]'
    )
    .forEach((button) => (button.disabled = editing))
  panel
    .querySelectorAll<
      HTMLButtonElement | HTMLInputElement
    >('[data-ds="animation"],[data-ds="play"],[data-ds="replay"],[data-ds="seek"],[data-jump],.ds-add,[data-ds-moment],[data-ds-scope]')
    .forEach((control) => (control.disabled = off))
}

/** Draw the timeline again at a new width, keeping one point of it still. */
export function keepPoint(
  scroll: HTMLElement,
  timeline: HTMLElement,
  at: number,
  redraw: () => void
) {
  const before = timeline.clientWidth,
    fraction = before ? (scroll.scrollLeft + at) / before : 0
  redraw()
  scroll.scrollLeft = Math.max(0, fraction * timeline.clientWidth - at)
}
