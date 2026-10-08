// The motion check: a scene is a film, not slides that animate once and
// freeze. Seen live (8 Oct): 64–80% of every scene was one still frame,
// holds ran to 9.4 s, and a 47 s scene had 17 tweens, most of them fades —
// the "slideshow" Hyperframes names as an explainer's first failure. Each
// moment is sampled every half second in the same browser as the settled
// frames; a moment that freezes while the voice speaks, or whose picture
// barely develops, is refused with what to do.

/** One sample: every element's place, opacity and paint, in DOM order. */
export type Pose = {
  /** A playing video or canvas fills part of the frame: it moves itself. */
  media: boolean
  elements: Array<
    null | [number, number, number, number, number, number, string, string]
  >
}

export const SAMPLE_EVERY = 0.5
/** The longest a frame may stay exactly still while the voice speaks. */
export const LONGEST_STILL = 3
/** A moment's picture develops at least this often (a visible change). */
export const SECONDS_PER_CHANGE = 4

// Played in the page: each element's box, opacity (with its ancestors'),
// stroke offset (a line drawing itself), own words (a count) and paint.
export const POSE = `(() => {
  const root = document.querySelector('[data-composition-id]')
  if (!root) return null
  const frame = root.getBoundingClientRect()
  const alpha = new Map()
  let media = false
  const elements = []
  for (const element of root.querySelectorAll('*')) {
    if (element.closest('defs, clipPath, mask, marker, pattern, symbol, script, style, title, audio')) {
      elements.push(null)
      continue
    }
    const style = getComputedStyle(element)
    const above = alpha.has(element.parentElement) ? alpha.get(element.parentElement) : 1
    const shown = style.display === 'none' || style.visibility === 'hidden' ? 0 : above * Number(style.opacity)
    alpha.set(element, shown)
    const r = element.getBoundingClientRect()
    if (shown < 0.05 || (r.width < 2 && r.height < 2)) {
      elements.push(null)
      continue
    }
    const tag = element.tagName.toLowerCase()
    if ((tag === 'video' || tag === 'canvas') && r.width * r.height > 0.05 * frame.width * frame.height)
      media = true
    const own = [...element.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim())
      ? element.textContent.replace(/\\s+/g, ' ').trim().slice(0, 40)
      : ''
    elements.push([
      Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height),
      Math.round(shown * 20),
      element instanceof SVGGeometryElement ? Math.round(parseFloat(style.strokeDashoffset) || 0) : 0,
      own,
      style.fill + ' ' + style.backgroundColor + ' ' + style.stroke
    ])
  }
  return { media, elements }
})()`

/**
 * How one sample differs from the next: not at all, slightly (a drift, a
 * jitter, a slow push step), or visibly (something appears, goes, moves
 * across, grows, fills, draws, counts or changes colour).
 */
export const poseChange = (a: Pose, b: Pose): 'same' | 'slight' | 'visible' => {
  if (a.media || b.media) return 'visible'
  if (a.elements.length !== b.elements.length) return 'visible'
  let slight = false
  for (let index = 0; index < a.elements.length; index++) {
    const x = a.elements[index],
      y = b.elements[index]
    if (!x && !y) continue
    if (!x || !y) {
      const [, , w, h] = (x || y)!
      if (w * h >= 400) return 'visible'
      slight = true
      continue
    }
    const size = Math.max(x[2] * x[3], y[2] * y[3])
    const moved = Math.max(Math.abs(x[0] - y[0]), Math.abs(x[1] - y[1]))
    const grew = Math.max(
      Math.abs(x[2] - y[2]) / Math.max(x[2], 1),
      Math.abs(x[3] - y[3]) / Math.max(x[3], 1)
    )
    if (
      x[6] !== y[6] ||
      Math.abs(x[5] - y[5]) >= 20 ||
      (size >= 400 &&
        (moved >= 24 ||
          grew >= 0.12 ||
          Math.abs(x[4] - y[4]) >= 6 ||
          x[7] !== y[7]))
    )
      return 'visible'
    if (x.some((value, at) => value !== y[at])) slight = true
  }
  return slight ? 'slight' : 'same'
}

export type MotionDefect = {
  kind: 'frozen' | 'sparse'
  moment: string
  message: string
}

const seconds = (value: number) => `${Math.round(value * 10) / 10} s`

/** What is wrong with one moment's motion, from its samples. */
export const motionDefects = (
  moment: { id: string; start: number; end: number },
  samples: Pose[],
  every = SAMPLE_EVERY
): MotionDefect[] => {
  if (samples.length < 2) return []
  // A moment that mostly plays a video moves by itself.
  if (samples.filter((sample) => sample.media).length > samples.length / 2)
    return []
  const changes = samples
    .slice(1)
    .map((sample, index) => poseChange(samples[index], sample))
  const defects: MotionDefect[] = []
  let run = 0,
    longest = 0,
    from = 0
  changes.forEach((change, index) => {
    run = change === 'same' ? run + 1 : 0
    if (run > longest) {
      longest = run
      from = index + 1 - run
    }
  })
  if (longest * every > LONGEST_STILL)
    defects.push({
      kind: 'frozen',
      moment: moment.id,
      message: `${moment.id} holds one still frame for ${seconds(longest * every)} (${seconds(from * every)} to ${seconds((from + longest) * every)} into the moment)`
    })
  // Each run of visible change is one development of the picture.
  const developments = changes.filter(
    (change, index) => change === 'visible' && changes[index - 1] !== 'visible'
  ).length
  const length = moment.end - moment.start
  const needed = Math.floor(length / SECONDS_PER_CHANGE)
  if (needed > 0 && developments < needed)
    defects.push({
      kind: 'sparse',
      moment: moment.id,
      message: `${moment.id} changes its picture ${developments === 1 ? 'once' : `${developments} times`} in ${seconds(length)}`
    })
  return defects
}

const HOW: Record<MotionDefect['kind'], string> = {
  frozen:
    'develop the picture there as the voice goes on: start the plan’s next change on the sentence that says it (CLOCK.json cues), rather than everything at the moment’s start',
  sparse: `give each idea the voice develops its own visible change as it is said, at least one every ${SECONDS_PER_CHANGE} s: a value travels its path, a bar fills as its number is said, a label moves to what it names, a part of a drawing acts`
}

/** The motion problems of one build, each said with what to do. */
export const motionProblems = (defects: MotionDefect[]) =>
  defects.map((defect) => `${defect.message}: ${HOW[defect.kind]}`)
