/** Measure with the browser's actual font. Refuse overflow rather than silently
 * clipping factual labels or shrinking below the readable threshold. */
export function fitLabel(node: SVGTextElement, words: string, maxWidth: number, minFontSize = 20): { fontSize: number; width: number } {
  const previous = node.innerHTML
  const previousStyle = node.getAttribute('style')
  const fontSize = parseFloat(getComputedStyle(node).fontSize) || 24
  node.textContent = words
  let width = node.getComputedTextLength()
  const fitted = Math.min(fontSize, fontSize * maxWidth / Math.max(1, width))
  if (fitted < minFontSize) {
    node.innerHTML = previous
    if (previousStyle === null) node.removeAttribute('style'); else node.setAttribute('style', previousStyle)
    throw new Error(`Label needs more room. Shorten it or enlarge its object; fitting would shrink below ${minFontSize}px.`)
  }
  node.style.fontSize = `${fitted}px`
  width = node.getComputedTextLength()
  return { fontSize: fitted, width }
}
