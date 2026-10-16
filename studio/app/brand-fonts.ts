// A look's own faces, loaded for the page: a site's open fonts are stored
// by the studio, and the drawn wireframes set text in them by name. The
// rules are rewritten only when the faces change.
import type { BrandFontFile } from '../shared/settings'

const FORMATS: Record<BrandFontFile['format'], string> = {
  woff2: 'woff2',
  woff: 'woff',
  truetype: 'truetype',
  opentype: 'opentype'
}

/** One @font-face per file, a variable face over its weight range. */
export const fontFaces = (files: BrandFontFile[]) =>
  files
    .map(
      (file) =>
        `@font-face{font-family:${JSON.stringify(file.family)};font-weight:${Array.isArray(file.weight) ? file.weight.join(' ') : file.weight};font-style:${file.style};font-display:swap;src:url("/objects/${encodeURIComponent(file.objectKey)}") format("${FORMATS[file.format]}")}`
    )
    .join('\n')

/** Each face once. One file can serve several weights, so a face is its
 * file, its weight and its style. */
export const uniqueFaces = (files: BrandFontFile[]) => {
  const seen = new Set<string>()
  return files.filter((file) => {
    const face = `${file.objectKey}|${String(file.weight)}|${file.style}`
    return seen.has(face) ? false : seen.add(face)
  })
}

/** Makes the page load these faces (and stop loading any others). */
export const syncBrandFonts = (files: BrandFontFile[]) => {
  const css = fontFaces(uniqueFaces(files))
  let style = document.getElementById('brand-fonts')
  if (!style) {
    if (!css) return
    style = document.createElement('style')
    style.id = 'brand-fonts'
    document.head.append(style)
  }
  if (style.textContent !== css) style.textContent = css
}
