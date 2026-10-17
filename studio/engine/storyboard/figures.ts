// Figures on screen. Every Hyperframes frame preset tells its workers to draw
// a slot (`— figure —`, `{metric}`, `NN%`) wherever the script gives no
// figure, "until the script supplies them". Nothing in the studio fills a
// slot later: the planner, the shots and the frames all read that rule in
// frame.md, and a slot reached the still as drawn (Ep 3 of the live Jev
// series run showed “NN%” in two frames). The studio's frame.md asks for the
// figure or none, and a pose or a frame that shows a slot is refused.

const RULE = [
  '## Numerals & Claims (hard rule)',
  '',
  'Never invent figures, financials, percentages, dates or counts at frame scale. A figure on screen',
  'is one the script or a page’s evidence gives, and the storyboard names it in the frame that shows',
  'it. Nothing fills a slot later: where no figure is given, design the number out (a word, a label, a',
  'bar or a chip without a value), never a placeholder such as `— figure —`, `{metric}` or `NN%`.',
  'Ordinals, counters and catalogue numbers are decorative chrome.'
].join('\n')

const AUDIT =
  '- **Fabrication** — every numeral traces to the script or a page’s evidence; where none does, the number is designed out, never a placeholder.'

const SECTION = /^## Numerals & Claims\b[^\n]*\n[\s\S]*?(?=^## |(?![\s\S]))/m

/** frame.md with the studio's rule on figures in place of the preset's. */
export const studioFigures = (frame: string) => {
  const ruled = SECTION.test(frame)
    ? frame.replace(SECTION, (section, at: number) =>
        at + section.length < frame.length ? `${RULE}\n\n` : `${RULE}\n`
      )
    : `${frame.trimEnd()}\n\n${RULE}\n`
  return ruled.replace(/^- \*\*Fabrication\*\*.*$/gm, AUDIT)
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '—',
  ndash: '–',
  minus: '−',
  times: '×',
  uarr: '↑',
  darr: '↓',
  percnt: '%',
  lcub: '{',
  rcub: '}'
}

const decode = (text: string) =>
  text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] !== '#') return ENTITIES[name.toLowerCase()] ?? whole
    const code = /^#x/i.test(name)
      ? parseInt(name.slice(2), 16)
      : Number(name.slice(1))
    return code <= 0x10ffff ? String.fromCodePoint(code) : whole
  })

/** What a composition puts on screen in words: its markup's text and the
 * strings its scripts hold (a line typed in, a counter's label). */
const shownText = (html: string) => {
  const strings = [
    ...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)
  ].flatMap((script) =>
    [...script[1].matchAll(/(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/g)].map(
      (literal) => literal[2]
    )
  )
  const markup = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
  return [markup, ...strings].map(decode)
}

/** The slots the presets name, and the shapes a worker draws them in. */
const SLOTS = [
  /(?:[—–]|--)\s*figure\s*(?:[—–]|--)/iu,
  /(?<!\$)\{\s*(?:metric|figure|stat|kpi)\s*\}/iu,
  /(?<![\p{L}\p{N}])[+−-]?(?:N{1,4}|X{2,4})(?:[.,](?:N{1,3}|X{1,3}))?\s?(?:%|ms(?!\p{L})|[×x](?![\p{L}\p{N}]))/u,
  /(?<![\p{L}\p{N}])N{1,2}\s+(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(?!\p{L})/u,
  /(?<![\p{L}\p{N}])N\s?m(?![\p{L}\p{N}])/u,
  /(?<![\p{L}\p{N}])[+−-]N\s*\/\s*[+−-]M(?![\p{L}\p{N}])/u,
  /[↑↓▲▼]\s*[—–](?!\s*\p{N})/u,
  /(?<!\p{N})[—–]\s*%/u,
  /lorem ipsum/iu
]

/** The placeholders a composition shows where a figure goes, in order. */
export const slotsIn = (html: string) => {
  const found = new Set<string>()
  for (const text of shownText(html))
    for (const match of SLOTS.map((slot) => slot.exec(text))
      .filter((match) => match !== null)
      .sort((one, other) => one.index - other.index))
      found.add(match[0].trim())
  return [...found].slice(0, 3)
}
