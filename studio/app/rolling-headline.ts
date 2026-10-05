import { gsap } from 'gsap'
import logo from './assets/incredible-logo.svg'

const phrases = [
  {
    text: 'Your most Incredible ideas',
    emphasis: 'Incredible',
    reveal: 1.8,
    hold: 4.2
  },
  { text: 'Shared by you!', emphasis: 'you', reveal: 1.3, hold: 3.8 },
  {
    text: 'As Incredibly as you can Imagine!',
    emphasis: 'Incredibly',
    reveal: 2.2,
    hold: 4.6
  }
]

const phraseLetters = (text: string, emphasis: string) =>
  text
    .split(' ')
    .map(
      (word) =>
        `<span class="headline-word">${Array.from(word, (letter, index) => `<span class="headline-letter${word.replace(/[.!?]$/, '') === emphasis && index < emphasis.length ? ' is-emphasized' : ''}">${letter}</span>`).join('')}</span>`
    )
    .join(' ')

export const rollingHeadline = () => `<h1 class="rolling-headline">
<span class="sr">${phrases.map(({ text }) => (text.endsWith('!') ? text : `${text}.`)).join(' ')}</span>
<span class="headline-static" aria-hidden="true">${phrases.map(({ text, emphasis }) => `<span>${text.replace(emphasis, `<em>${emphasis}</em>`)}</span>`).join('')}</span>
<span class="headline-track" aria-hidden="true">
${phrases.map(({ text, emphasis }) => `<span class="headline-line">${phraseLetters(text, emphasis)}</span>`).join('')}
<span class="headline-logo"><img src="${logo}" alt=""></span>
</span></h1>`

type Letter = { element: HTMLElement; edge: number }
type Row = { start: number; end: number; y: number; letters: Letter[] }

/** Measure natural word wrapping, so large type stays large on narrow screens. */
const measureRows = (line: HTMLElement, track: HTMLElement, size: number) => {
  const origin = track.getBoundingClientRect()
  const rows: Row[] = []
  for (const element of line.querySelectorAll<HTMLElement>(
    '.headline-letter'
  )) {
    const rect = element.getBoundingClientRect()
    const y = rect.top - origin.top + (rect.height - size) / 2
    let row = rows.at(-1)
    if (!row || Math.abs(row.y - y) > 2) {
      row = {
        start: rect.left - origin.left - size - 9,
        end: 0,
        y,
        letters: []
      }
      rows.push(row)
    }
    const edge = rect.right - origin.left
    row.letters.push({ element, edge })
    row.end = edge + 9
  }
  return rows
}

/** Distance drives rotation and typing; line returns never cross readable text. */
export const animateRollingHeadline = (headline: HTMLElement) => {
  const track = headline.querySelector<HTMLElement>('.headline-track')!
  const logo = headline.querySelector<HTMLElement>('.headline-logo')!
  const image = logo.querySelector('img')!
  const lines = Array.from(
    headline.querySelectorAll<HTMLElement>('.headline-line')
  )
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
  let timeline: gsap.core.Timeline | undefined
  let paused = false
  let disposed = false

  const build = () => {
    if (disposed) return
    const progress = timeline?.progress()
    timeline?.kill()
    timeline = undefined
    if (reduce.matches) return

    const size = logo.offsetWidth
    const move = gsap.quickSetter(logo, 'x', 'px')
    const lift = gsap.quickSetter(logo, 'y', 'px')
    const roll = gsap.quickSetter(image, 'rotation', 'deg')
    timeline = gsap.timeline({ repeat: -1, repeatDelay: 0.2, paused: true })
    gsap.set(lines, { opacity: 0 })
    let at = 0
    let firstRead = 0

    lines.forEach((line, index) => {
      const rows = measureRows(line, track, size)
      const length = rows.reduce((total, row) => total + row.end - row.start, 0)
      const letters = line.querySelectorAll<HTMLElement>('.headline-letter')
      gsap.set(letters, { opacity: 0 })
      timeline!.set(lines, { opacity: 0 }, at).set(line, { opacity: 1 }, at)
      let rotationDistance = 0
      const passes = rows.map((row) => {
        const cursor = { x: row.start }
        const baseRotation = rotationDistance
        rotationDistance += row.end - row.start
        let visibleCount = -1
        const draw = () => {
          move(cursor.x)
          lift(row.y)
          roll(
            ((baseRotation + cursor.x - row.start) / (size / 2)) *
              (180 / Math.PI)
          )
          const count = row.letters.filter(
            ({ edge }) => edge + 9 <= cursor.x + 0.1
          ).length
          if (count === visibleCount) return
          row.letters.forEach(({ element }, i) => {
            element.style.opacity = i < count ? '1' : '0'
          })
          visibleCount = count
        }
        return { row, cursor, draw }
      })
      const place = (row: Row, x: number, jump: boolean) => {
        if (jump) {
          timeline!.to(logo, { opacity: 0, duration: 0.1 }, at)
          at += 0.1
        }
        timeline!
          .set(logo, { x, y: row.y }, at)
          .to(logo, { opacity: 1, duration: 0.1 }, at)
      }

      passes.forEach(({ row, cursor, draw }, rowIndex) => {
        place(row, row.start, rowIndex > 0)
        const duration =
          phrases[index].reveal * ((row.end - row.start) / length)
        timeline!.fromTo(
          cursor,
          { x: row.start },
          {
            x: row.end,
            duration,
            ease: 'power1.inOut',
            immediateRender: false,
            onUpdate: draw
          },
          at
        )
        at += duration
      })
      if (index === 0) firstRead = at
      at += phrases[index].hold
      ;[...passes].reverse().forEach(({ row, cursor, draw }, rowIndex) => {
        place(row, row.end, rowIndex > 0)
        const duration = 0.8 * ((row.end - row.start) / length)
        timeline!.to(
          cursor,
          { x: row.start, duration, ease: 'power2.inOut', onUpdate: draw },
          at
        )
        at += duration
      })
      at += 0.2
    })
    // Give first-time visitors a complete headline immediately, then begin the rolls.
    if (progress === undefined) timeline.seek(firstRead, false)
    else timeline.progress(progress, false)
    timeline.paused(paused || document.hidden)
  }

  const resize = new ResizeObserver(build)
  resize.observe(headline)
  reduce.addEventListener('change', build)
  void document.fonts.ready.then(build)
  build()
  return {
    pause(value: boolean) {
      paused = value
      timeline?.paused(value || reduce.matches)
    },
    dispose() {
      disposed = true
      timeline?.kill()
      resize.disconnect()
      reduce.removeEventListener('change', build)
    }
  }
}
