// How large a teaser frame's words are drawn (review 8, round 2: the type
// sizes for a phone were only asked for, never checked, so a rebuilt teaser
// whose words stayed small was offered as finished). A frame drawn again
// for a teaser's shape is read in a browser at its canvas: every run of
// words, at the size it is drawn, scaled as its parents scale it. One under
// the label size the dispatch asks for keeps the frame small.

/** Type for a phone on a teaser's 1080-wide canvas, in px: the frame agent
 * is asked for it, and a frame drawn again is measured against it. */
export const PHONE_TYPE = { headline: 96, body: 48, label: 36 }

export type Words = { text: string; px: number }

/** The composition's markup without its template and scripts: what it
 * shows from the start, its words all there (only their entrances move). */
const shown = (html: string) =>
  html
    .replace(/<\/?template\b[^>]*>/gi, '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')

/** Each run of words each frame shows and the size it is drawn at, in px
 * on its canvas, read in one headless browser. */
export const typeSizes = async (
  frames: string[],
  canvas: { width: number; height: number }
): Promise<Words[][]> => {
  const { default: puppeteer } = await import('puppeteer')
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox'],
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false
  })
  try {
    const page = await browser.newPage()
    await page.setViewport(canvas)
    const sizes: Words[][] = []
    for (const html of frames) {
      await page.setContent(
        `<!doctype html><html><body style="margin:0">${shown(html)}</body></html>`,
        { waitUntil: 'domcontentloaded' }
      )
      sizes.push(await page.evaluate(measure))
    }
    return sizes
  } finally {
    await browser.close().catch(() => {})
  }
}

/** In the page: each run of words and the size it is drawn at. */
const measure = () => {
  const found: Array<{ text: string; px: number }> = []
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  while (walk.nextNode()) {
    const node = walk.currentNode
    const text = (node.textContent || '').replace(/\s+/g, ' ').trim()
    const element = node.parentElement
    if (!text || !element || element.closest('style,title,noscript')) continue
    let px = parseFloat(getComputedStyle(element).fontSize) || 16
    // Scaled by its parents: an SVG's view box, a transform.
    if (element instanceof SVGGraphicsElement) {
      const matrix = element.getScreenCTM()
      if (matrix) px *= Math.hypot(matrix.c, matrix.d)
    } else if (element instanceof HTMLElement && element.offsetHeight) {
      const drawn = element.getBoundingClientRect().height
      if (drawn) px *= drawn / element.offsetHeight
    }
    found.push({ text: text.slice(0, 48), px: Math.round(px * 10) / 10 })
  }
  return found
}

/** The words drawn under the label size (every teaser canvas is 1080 px
 * wide, as the sizes are given for). */
export const smallType = (words: Words[]) =>
  words.filter((item) => item.px < PHONE_TYPE.label - 0.5)

/** What the frame agent hears of words drawn small, in a line. */
export const smallTypeLine = (small: Words[]) =>
  small.length
    ? `Words under ${PHONE_TYPE.label} px, too small on a phone: ${small
        .slice(0, 4)
        .map((item) => `“${item.text}” ${item.px} px`)
        .join(
          ', '
        )}${small.length > 4 ? ` and ${small.length - 4} more` : ''}. Make labels ${PHONE_TYPE.label} px or more, body ${PHONE_TYPE.body} px or more.`
    : ''
