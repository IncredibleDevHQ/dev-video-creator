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
  /** The frame's width and height, for what the edge cuts. */
  frame?: [number, number]
  /** Each piece of text's own words, where they are, and whether the scene
   * shows them cut on purpose (data-intentional). */
  words?: Array<[number, number, number, number, string, number]>
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
      Math.round(r.left - frame.left), Math.round(r.top - frame.top), Math.round(r.width), Math.round(r.height),
      Math.round(shown * 20),
      element instanceof SVGGeometryElement ? Math.round(parseFloat(style.strokeDashoffset) || 0) : 0,
      own,
      style.fill + ' ' + style.backgroundColor + ' ' + style.stroke
    ])
  }
  // The words themselves, as the settled-frame check measures them: a text
  // block's own box can span the frame while its words sit well inside.
  const words = []
  const owners = new Set()
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent.replace(/\\s+/g, ' ').trim()
    const parent = node.parentElement
    if (!text || !parent || parent.closest('defs, clipPath, mask, marker, pattern, symbol, script, style, title, audio')) continue
    const owner = parent.closest('text') || parent
    if (owners.has(owner) || !((alpha.get(owner) || 0) >= 0.5)) continue
    owners.add(owner)
    let r
    if (owner instanceof SVGElement) r = owner.getBoundingClientRect()
    else {
      const range = document.createRange()
      range.selectNodeContents(node)
      r = range.getBoundingClientRect()
    }
    if (r.width < 1 || r.height < 1) continue
    words.push([
      Math.round(r.left - frame.left), Math.round(r.top - frame.top), Math.round(r.width), Math.round(r.height),
      text.slice(0, 40), owner.closest('[data-intentional]') ? 1 : 0
    ])
  }
  return { media, frame: [Math.round(frame.width), Math.round(frame.height)], elements, words }
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
  kind: 'frozen' | 'sparse' | 'empty' | 'cut'
  moment: string
  message: string
  /** For a sparse moment: how many changes it is short. */
  short?: number
}

const seconds = (value: number) => `${Math.round(value * 10) / 10} s`

type Element = NonNullable<Pose['elements'][number]>
/** The frame's area: given, else the largest thing drawn (its ground). */
const frameArea = (samples: Pose[]) =>
  samples[0]?.frame
    ? samples[0].frame[0] * samples[0].frame[1]
    : Math.max(
        1,
        ...samples.flatMap((sample) =>
          sample.elements.map((item) => (item ? item[2] * item[3] : 0))
        )
      )
/** Whether a sample shows anything: words, or a shape that is not the
 * ground, big enough to see. */
const showsSomething = (sample: Pose, area: number) =>
  sample.media ||
  sample.elements.some(
    (item) =>
      item &&
      item[4] >= 6 &&
      (item[6] ||
        (item[2] * item[3] < area * 0.8 && item[2] * item[3] >= area * 0.002))
  )
/** Words keep this far inside the frame, as at a moment's end (frame-checks). */
const SAFE_MARGIN = 16
/**
 * Words the frame's edge cuts or crowds: drawn, readable, in view but not
 * inside its safe area, as a push-in can leave them (review 6).
 */
const cutWords = (sample: Pose) => {
  const [width, height] = sample.frame || [0, 0]
  if (!width) return []
  // The words themselves where measured (an older sample has only its
  // elements' boxes); words cut on purpose are the scene's to show.
  const words: Array<[number, number, number, number, string]> = sample.words
    ? sample.words
        .filter((word) => !word[5])
        .map(([x, y, w, h, text]) => [x, y, w, h, text])
    : sample.elements
        .filter((item): item is Element =>
          Boolean(item && item[6] && item[4] >= 10)
        )
        .map((item) => [item[0], item[1], item[2], item[3], item[6]])
  return words.filter(([x, y, w, h]) => {
    const inside = x < width && y < height && x + w > 0 && y + h > 0
    const out =
      x < SAFE_MARGIN ||
      y < SAFE_MARGIN ||
      x + w > width - SAFE_MARGIN ||
      y + h > height - SAFE_MARGIN
    return inside && out
  })
}
/** The longest run of samples where a test holds, and where it starts. */
const longestRun = (samples: Pose[], test: (sample: Pose) => boolean) => {
  let run = 0,
    longest = 0,
    from = 0
  samples.forEach((sample, index) => {
    run = test(sample) ? run + 1 : 0
    if (run > longest) {
      longest = run
      from = index + 1 - run
    }
  })
  return { longest, from }
}

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
  // An empty frame while the voice speaks (review 6: a scene opened on one
  // word, then nothing, while the voice asked): blank samples a second or
  // more apart, first to last, so a picture that enters half a second in
  // passes. A gap of 1.5 s or more always spans that.
  const area = frameArea(samples)
  const blank = longestRun(samples, (sample) => !showsSomething(sample, area))
  const empty = (blank.longest - 1) * every
  if (empty >= 1)
    defects.push({
      kind: 'empty',
      moment: moment.id,
      message: `${moment.id} shows an empty frame for ${seconds(empty)} (${seconds(blank.from * every)} into the moment) while the voice speaks`
    })
  // Words cut by the frame's edge and held there, as a push-in can leave
  // them (review 6: "augmented LLM" became "mented LLM").
  const cut = longestRun(samples, (sample) => cutWords(sample).length > 0)
  if (cut.longest >= 2) {
    const words = cutWords(samples[cut.from])[0]?.[4] || 'a label'
    defects.push({
      kind: 'cut',
      moment: moment.id,
      message: `${moment.id} cuts “${words}” at the frame’s edge (${seconds(cut.from * every)} into the moment)`
    })
  }
  // Each run of visible change is one development of the picture.
  const developments = changes.filter(
    (change, index) => change === 'visible' && changes[index - 1] !== 'visible'
  ).length
  const length = moment.end - moment.start
  const needed = Math.floor(length / SECONDS_PER_CHANGE)
  if (needed > 0 && developments < needed)
    defects.push({
      kind: 'sparse',
      short: needed - developments,
      moment: moment.id,
      message: `${moment.id} changes its picture ${developments === 1 ? 'once' : `${developments} times`} in ${seconds(length)} (${needed - developments} short)`
    })
  return defects
}

const HOW: Record<MotionDefect['kind'], string> = {
  empty:
    'keep what the voice is talking about on screen: hold the question or the title until the next picture enters',
  cut: `keep a push-in’s target and its labels inside the frame’s safe area, at least ${SAFE_MARGIN} px from every edge for the whole move: zoom in less, or move the labels in`,
  frozen:
    'develop the picture there as the voice goes on: start the plan’s next change on the sentence that says it (CLOCK.json cues), rather than everything at the moment’s start',
  sparse: `give each idea the voice develops its own visible change as it is said, at least one every ${SECONDS_PER_CHANGE} s: a value travels its path, a bar fills as its number is said, a label moves to what it names, a part of a drawing acts`
}

/** The motion problems of one build, each said with what to do. */
export const motionProblems = (defects: MotionDefect[]) =>
  defects.map((defect) => `${defect.message}: ${HOW[defect.kind]}`)
