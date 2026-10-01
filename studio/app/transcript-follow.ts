import { dialogueWordAt } from '../shared/dialogue'
import type { Moment } from '../shared/model'
import { escape } from './ui'
export const transcriptWords = (text: string) =>
  (text.match(/\S+|\s+/g) || [])
    .map((part) =>
      /^\s+$/.test(part)
        ? part
        : `<span data-transcript-word>${escape(part)}</span>`
    )
    .join('')
export function wordAt(
  lines: string,
  start: number,
  end: number,
  second: number
) {
  const words = lines.trim().split(/\s+/).filter(Boolean)
  if (!words.length || second < start || end <= start) return -1
  return Math.min(
    words.length - 1,
    Math.floor(Math.max(0, (second - start) / (end - start)) * words.length)
  )
}
const followed = new WeakMap<HTMLElement, string>()
export function followTranscript(
  root: HTMLElement,
  moments: Moment[],
  second: number,
  index: number
) {
  const moment = moments[index]
  if (!moment) return
  const active = dialogueWordAt(moment, second)
  root.querySelectorAll<HTMLElement>('[data-prompter]').forEach((script) => {
    let currentWord: HTMLElement | undefined
    script
      .querySelectorAll<HTMLElement>('[data-transcript-word]')
      .forEach((word, i) => {
        word.classList.toggle('spoken-word', i === active)
        word.classList.toggle('word-read', i < active)
        if (i === active) {
          word.setAttribute('aria-current', 'true')
          currentWord = word
        } else word.removeAttribute('aria-current')
      })
    if (currentWord) {
      const box = currentWord.getBoundingClientRect(),
        view = script.getBoundingClientRect()
      if (box.top < view.top || box.bottom > view.bottom)
        script.scrollTop += box.top - view.top - view.height / 3
    }
  })
  let current: HTMLElement | undefined
  root
    .querySelectorAll<HTMLElement>('[data-transcript-moment]')
    .forEach((section) => {
      const selected = Number(section.dataset.transcriptMoment) === index
      section.classList.toggle('current', selected)
      section
        .querySelectorAll<HTMLElement>('[data-transcript-word]')
        .forEach((word, i) => {
          const on = selected && i === active
          word.classList.toggle('spoken-word', on)
          if (on) {
            word.setAttribute('aria-current', 'true')
            current = word
          } else word.removeAttribute('aria-current')
        })
    })
  const scroller = root.querySelector<HTMLElement>('.transcript-scroll')
  if (scroller && current) {
    scroller.style.setProperty(
      '--transcript-tail',
      `${Math.max(120, scroller.clientHeight - 100)}px`
    )
    const box = current.getBoundingClientRect(),
      view = scroller.getBoundingClientRect()
    const key = `${moment.recordingKey}:${moment.id}`
    const changed = followed.get(root) !== key
    followed.set(root, key)
    const section = current.closest<HTMLElement>('[data-transcript-moment]')
    if (changed && section)
      scroller.scrollTop += section.getBoundingClientRect().top - view.top - 12
    else if (
      box.top < view.top + 16 ||
      box.bottom > view.top + view.height * 0.55
    )
      scroller.scrollTop += box.top - view.top - view.height * 0.25
  }
}
