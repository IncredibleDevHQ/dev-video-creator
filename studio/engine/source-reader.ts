import { storeAsset } from './persistence'
// Assemble a web source from prose, branding and host documents.
import { parseHTML } from 'linkedom'
import { hsl } from './source-colours'
import { sourceContent } from './source-content'
import {
  articleText,
  cutArticle,
  extractionOf,
  FALLBACK_PALETTE,
  type SourceRead
} from './source-document'
import {
  assertPublicUrl,
  fetchText,
  fetchBinary,
  renderedRead,
  absolute
} from './source-fetch'
import {
  BROWSER_COLOURS,
  GENERIC_FONTS,
  Tally,
  hexOf,
  isNeutral,
  cssColours,
  cleanFontName,
  cssFonts
} from './source-brand'
import { githubDocumentOf, readGithubDocument } from './source-github'
import { Refusal } from './refusal'
export const readSourceUrl = async (
  raw: string,
  options: { projectId?: string } = {}
): Promise<SourceRead> => {
  const target = assertPublicUrl(raw)
  const hosted = githubDocumentOf(target)
  if (hosted) {
    const document = await readGithubDocument(
      hosted,
      target.toString(),
      options
    )
    if (document) return document
  }
  const warnings: string[] = []
  const html = await fetchText(target.toString(), 3 * 1024 * 1024)
  if (
    !/html/i.test(html.contentType) &&
    !/<html/i.test(html.text.slice(0, 2000))
  )
    throw new Refusal('That link is not a web page')
  const base = html.finalUrl
  const { document } = parseHTML(html.text)
  const meta = (name: string) =>
    document
      .querySelector(`meta[property="${name}"]`)
      ?.getAttribute('content') ||
    document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ||
    ''
  const title = (
    meta('og:title') ||
    document.querySelector('title')?.textContent ||
    document.querySelector('h1')?.textContent ||
    ''
  )
    .trim()
    .slice(0, 160)
  const description = (meta('og:description') || meta('description') || '')
    .trim()
    .slice(0, 400)
  const site = (meta('og:site_name') || target.hostname.replace(/^www\./, ''))
    .trim()
    .slice(0, 80)

  const container = sourceContent(document)
  const article = articleText(container, base)
  const headings = article.headings
  let text = article.text
  // What the read cut, said before anything is planned from it.
  const cuts = [...article.notes]
  // Where the read stops, and what it leaves out, said: at a paragraph's
  // end, never inside a table or code (review 6: line ends a page kept as
  // Windows writes them made a long article fail here).
  const cut = cutArticle(text)
  text = cut.text
  if (cut.left) {
    const kept = cut.kept
    const stopsIn = [...kept.matchAll(/^#{1,4} (.+)$/gm)].pop()?.[1] || ''
    const left = headings.length - [...kept.matchAll(/^#{1,4} /gm)].length
    cuts.push(
      `The article was long; the first ${kept.length.toLocaleString('en')} characters were read${stopsIn ? ` — it stops in “${stopsIn}”` : ''}${left > 0 ? `, and ${left} later section${left === 1 ? ' was' : 's were'} left out` : ''}`
    )
  }
  warnings.push(...cuts)
  if (text.length < 400)
    warnings.push(
      'Little readable text was found on the page; the outline may be thin'
    )

  // images and logo candidates
  const images: SourceRead['images'] = []
  const pushImage = (url: string, alt: string) => {
    if (
      !url ||
      images.some((image) => image.url === url) ||
      (/\.svg(\?|$)/i.test(url) === false && /data:/.test(url))
    )
      return
    images.push({ url, alt: alt.slice(0, 120) })
  }
  ;[meta('og:image'), meta('twitter:image')].forEach((url) =>
    pushImage(absolute(url, base), 'cover')
  )
  Array.from(container.querySelectorAll('img'))
    .slice(0, 40)
    .forEach((img) => {
      const src = absolute(
        img.getAttribute('src') || img.getAttribute('data-src'),
        base
      )
      if (src && !/data:/.test(src))
        pushImage(src, img.getAttribute('alt') || '')
    })
  const logos: SourceRead['logos'] = []
  const pushLogo = (url: string, source: string) => {
    if (url && !logos.some((logo) => logo.url === url))
      logos.push({ url, source })
  }
  const iconLinks = Array.from(document.querySelectorAll('link[rel]')).filter(
    (link) => /icon/i.test(link.getAttribute('rel') || '')
  )
  iconLinks
    .map((link) => ({
      href: absolute(link.getAttribute('href'), base),
      size:
        Number((link.getAttribute('sizes') || '0x0').split('x')[0]) ||
        (/apple-touch/i.test(link.getAttribute('rel') || '') ? 180 : 32),
      rel: link.getAttribute('rel') || ''
    }))
    .sort((a, b) => b.size - a.size)
    .forEach((link) => pushLogo(link.href, link.rel))
  Array.from(
    document.querySelectorAll(
      'header img, nav img, a[href="/"] img, [class*="logo" i] img, img[class*="logo" i], img[alt*="logo" i]'
    )
  )
    .slice(0, 6)
    .forEach((img) => {
      pushLogo(
        absolute(img.getAttribute('src') || img.getAttribute('data-src'), base),
        'header'
      )
    })
  pushLogo(absolute('/favicon.ico', base), 'favicon')

  // colours and fonts, from the stylesheets and from the rendered page
  const colours = new Tally()
  const fontTally = new Map<string, number>()
  const themeColor = hexOf(meta('theme-color')) || ''
  if (themeColor) colours.add(themeColor, 60)
  Array.from(document.querySelectorAll('style')).forEach((style) => {
    cssColours(style.textContent || '', colours, 1)
    cssFonts(style.textContent || '', fontTally, 1)
  })
  Array.from(document.querySelectorAll('[style]'))
    .slice(0, 400)
    .forEach((element) =>
      cssColours(element.getAttribute('style') || '', colours, 0.5)
    )
  const sheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map((link) => absolute(link.getAttribute('href'), base))
    .filter((href) => href && new URL(href).hostname === target.hostname)
    .slice(0, 3)
  for (const href of sheets) {
    try {
      const css = await fetchText(href, 400 * 1024, 8_000)
      cssColours(css.text, colours, 1)
      cssFonts(css.text, fontTally, 1)
    } catch {
      warnings.push(`A stylesheet could not be read: ${new URL(href).pathname}`)
    }
  }
  const rendered = await renderedRead(target.toString())
  const grounds = new Tally()
  const inks = new Tally()
  if (rendered) {
    rendered.backgrounds.forEach(([colour, weight]) =>
      grounds.add(hexOf(colour), weight)
    )
    rendered.inks.forEach(([colour, weight]) => inks.add(hexOf(colour), weight))
    rendered.fonts.forEach(([rawFamily, weight]) => {
      const family = cleanFontName(rawFamily)
      const key = family.toLowerCase()
      if (family && !GENERIC_FONTS.has(key) && !/icon|awesome/i.test(key))
        fontTally.set(family, (fontTally.get(family) || 0) + weight * 4)
    })
    // rendered colours join the candidate tally with their real prominence
    rendered.backgrounds
      .slice(0, 12)
      .forEach(([colour, weight]) =>
        colours.add(hexOf(colour), Math.sqrt(weight))
      )
    rendered.inks
      .slice(0, 12)
      .forEach(([colour, weight]) =>
        colours.add(hexOf(colour), Math.sqrt(weight))
      )
  } else
    warnings.push(
      'The page could not be rendered for its painted colours; stylesheet colours were used'
    )

  const ground =
    grounds.top(1)[0]?.hex ||
    (colours.top(40).find((c) => hsl(c.hex).l > 0.9)?.hex ?? '#ffffff')
  const inkCandidates = inks.top(6).map((c) => c.hex)
  const textColour =
    inkCandidates.find((hex) => Math.abs(hsl(hex).l - hsl(ground).l) > 0.4) ||
    (hsl(ground).l > 0.5 ? '#1a1a1a' : '#f2f2f2')
  // A browser's own link colours are not a brand's (F5 of the Perplexity
  // review): a page that paints none of its own has no brand colours.
  const saturated = colours
    .top(60)
    .filter(
      (c) =>
        !isNeutral(c.hex) &&
        c.hex !== ground &&
        c.hex !== textColour &&
        !BROWSER_COLOURS.has(c.hex)
    )
  // an accent has to carry on a dark video ground: prefer saturated colours of middling lightness over a brand's near-black navy
  const carries = (hex: string) => {
    const { s, l } = hsl(hex)
    return s >= 0.35 && l >= 0.28 && l <= 0.78
  }
  const accentRead = Boolean(
    (themeColor && !isNeutral(themeColor) && carries(themeColor)) ||
    saturated.length
  )
  const accent =
    themeColor && !isNeutral(themeColor) && carries(themeColor)
      ? themeColor
      : saturated.find((c) => carries(c.hex))?.hex ||
        saturated[0]?.hex ||
        FALLBACK_PALETTE.accent
  const secondary =
    saturated.find(
      (c) => c.hex !== accent && Math.abs(hsl(c.hex).h - hsl(accent).h) > 25
    )?.hex ||
    saturated.find((c) => c.hex !== accent)?.hex ||
    accent
  const candidatesOut = [
    { hex: ground, weight: 0, role: 'ground' as const },
    { hex: textColour, weight: 0, role: 'text' as const },
    { hex: accent, weight: 0, role: 'accent' as const },
    { hex: secondary, weight: 0, role: 'secondary' as const },
    ...saturated
      .slice(0, 10)
      .filter((c) => ![ground, textColour, accent, secondary].includes(c.hex))
  ]

  const fontsSeen = [...fontTally.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([family]) => family)
    .slice(0, 6)
  const headingFont = cleanFontName(rendered?.headingFont || '')
  const bodyFont = cleanFontName(rendered?.bodyFont || '')
  // A site that names no font of its own uses the system's, which every
  // browser shows as it is (review 6: Segoe UI and Consolas stood in).
  const display =
    headingFont && !GENERIC_FONTS.has(headingFont.toLowerCase())
      ? headingFont
      : fontsSeen[0] || 'system-ui'
  const body =
    bodyFont && !GENERIC_FONTS.has(bodyFont.toLowerCase())
      ? bodyFont
      : fontsSeen[1] || fontsSeen[0] || 'system-ui'
  const mono =
    fontsSeen.find((f) =>
      /mono|code|courier|menlo|consolas|jetbrains|fira/i.test(f)
    ) || 'ui-monospace'

  // keep the best two logo candidates locally so the render can stage them
  for (const logo of logos.slice(0, 2)) {
    const file = await fetchBinary(logo.url, 1024 * 1024)
    if (!file) continue
    const extension = /svg/.test(file.contentType)
      ? '.svg'
      : /png/.test(file.contentType)
        ? '.png'
        : /jpe?g/.test(file.contentType)
          ? '.jpg'
          : /webp/.test(file.contentType)
            ? '.webp'
            : /x-icon|vnd\.microsoft\.icon/.test(file.contentType)
              ? '.ico'
              : ''
    if (!extension || extension === '.ico') continue
    try {
      const stored = await storeAsset({
        body: file.buffer,
        contentType: file.contentType,
        projectId: options.projectId,
        kind: 'brand-logo',
        extension
      })
      logo.localUrl = `/objects/${stored.objectKey}`
    } catch {
      /* the original url still works for preview */
    }
  }

  return {
    kind: 'url',
    url: base,
    site,
    title,
    description,
    text,
    words: text.split(/\s+/).filter(Boolean).length,
    headings: headings.slice(0, 60),
    images: images.slice(0, 12),
    ...(article.byline ? { byline: article.byline } : {}),
    logos: logos.slice(0, 6),
    palette: {
      candidates: candidatesOut,
      ground,
      text: textColour,
      accent,
      secondary,
      themeColor,
      provenance: accentRead ? 'extracted' : 'fallback',
      from: accentRead
        ? target.hostname.replace(/^www\./, '')
        : `${target.hostname.replace(/^www\./, '')} showed no brand colours`
    },
    fonts: { display, body, mono, seen: fontsSeen },
    warnings,
    extraction: {
      ...extractionOf(text, headings.length, site),
      tables: article.tables,
      codeBlocks: article.codeBlocks,
      notes: cuts
    }
  }
}
