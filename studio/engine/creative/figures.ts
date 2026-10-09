// The figures a script says aloud, checked against the source. Seen live: a
// scene said "this frame reads four percent of the title and twenty-two of
// the chip", numbers no source gave. A figure over ten, or any number with a
// unit (percent, seconds), must be one the source or its brief states; a
// small count ("four things") is speech, and an example said as one ("Say a
// moment runs six seconds") is allowed.

const ONES: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19
}
const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90
}
const SCALES: Record<string, number> = {
  hundred: 100,
  thousand: 1000,
  million: 1e6
}
const UNIT =
  /^(percent|per|%|seconds?|secs?|s|ms|milliseconds?|minutes?|mins?|hours?|days?|x|times|px|pixels?|kb|mb|gb|requests?)$/i
const EXAMPLE =
  /\b(say|suppose|imagine|for example|for instance|e\.g\.|picture)\b/i

type Figure = { value: number; unit: boolean; said: string }

/** The numbers a text holds, said in digits or in words, with any unit. */
export const figuresIn = (text: string): Figure[] => {
  const tokens = text
    .toLowerCase()
    .replace(/(\d)\s*%/g, '$1 %')
    .replace(/(\d)(s|ms|x|px)\b/g, '$1 $2')
    .split(/[\s,;:!?()"“”]+|(?<=[a-z])-(?=[a-z])/)
    .map((token) => token.replace(/^[^\w%]+|[^\w%.]+$/g, '').replace(/\.$/, ''))
    .filter(Boolean)
  const figures: Figure[] = []
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]
    let value: number | null = null
    let end = index
    if (/^\d+(\.\d+)?$/.test(token)) value = Number(token)
    else if (token in ONES || token in TENS) {
      // Words: "twenty two", "one hundred", "five point eight".
      let total = 0
      let part = 0
      let at = index
      for (; at < tokens.length; at++) {
        const word = tokens[at]
        if (word in ONES) part += ONES[word]
        else if (word in TENS) part += TENS[word]
        else if (word in SCALES) part = Math.max(1, part) * SCALES[word]
        else if (word === 'and' && at > index) continue
        else break
        if (word in SCALES && SCALES[word] >= 1000) {
          total += part
          part = 0
        }
      }
      value = total + part
      end = at - 1
      if (tokens[end + 1] === 'point' && tokens[end + 2] in ONES) {
        value += ONES[tokens[end + 2]] / 10
        end += 2
      }
    }
    if (value === null) continue
    const next = tokens[end + 1] || ''
    const unit = UNIT.test(next)
    figures.push({
      value,
      unit,
      said: tokens.slice(index, end + (unit ? 2 : 1)).join(' ')
    })
    index = end
  }
  return figures
}

/** The figures a script says that its source does not give. */
export const unsupportedFigures = (spoken: string, source: string) => {
  const stated = figuresIn(source)
  const known = new Set(stated.map((figure) => figure.value))
  // "Four percent" needs a measured four, not "four things".
  const measured = new Set(
    stated.filter((figure) => figure.unit).map((figure) => figure.value)
  )
  const sentences = spoken.split(/(?<=[.!?])\s+/)
  return sentences.flatMap((sentence) =>
    EXAMPLE.test(sentence)
      ? []
      : figuresIn(sentence)
          .filter((figure) =>
            figure.unit
              ? !measured.has(figure.value)
              : figure.value > 10 && !known.has(figure.value)
          )
          .map((figure) => figure.said)
  )
}
