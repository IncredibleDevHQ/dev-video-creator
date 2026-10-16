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
import { assertPublicUrl, fetchText, absolute } from './source-fetch'
import { readSiteBrand } from './site-brand'
import {
  BROWSER_COLOURS,
  Tally,
  hexOf,
  isNeutral,
  cssColours,
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
  // The rendered page, read for how its colours are used, the faces it
  // sets text in, its logo and its open font files (site-brand.ts).
  const brand = await readSiteBrand(target.toString())
  if (brand)
    brand.palette.forEach((colour, at) =>
      colours.add(colour.toLowerCase(), 24 - at)
    )
  else
    warnings.push(
      'The page could not be rendered for its painted colours; stylesheet colours were used'
    )
  const lower = (value?: string) => value?.toLowerCase()
  const ground =
    lower(brand?.roles?.ground) ||
    (colours.top(40).find((c) => hsl(c.hex).l > 0.9)?.hex ?? '#ffffff')
  const textColour =
    lower(brand?.roles?.text) || (hsl(ground).l > 0.5 ? '#1a1a1a' : '#f2f2f2')
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
  // Without a rendered read, an accent has to carry on a video ground:
  // saturated colours of middling lightness over a near-black navy.
  const carries = (hex: string) => {
    const { s, l } = hsl(hex)
    return s >= 0.35 && l >= 0.28 && l <= 0.78
  }
  const accentRead = Boolean(
    brand?.roles?.accent ||
    (themeColor && !isNeutral(themeColor) && carries(themeColor)) ||
    saturated.length
  )
  const accent =
    lower(brand?.roles?.accent) ||
    (themeColor && !isNeutral(themeColor) && carries(themeColor)
      ? themeColor
      : saturated.find((c) => carries(c.hex))?.hex ||
        saturated[0]?.hex ||
        FALLBACK_PALETTE.accent)
  const secondary =
    lower(brand?.roles?.second) ||
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

  const fontsSeen =
    brand?.fonts.seen ||
    [...fontTally.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([family]) => family)
      .slice(0, 6)
  // A site that names no font of its own uses the system's, which every
  // browser shows as it is (review 6: Segoe UI and Consolas stood in).
  const display = brand?.fonts.display || fontsSeen[0] || 'system-ui'
  const body = brand?.fonts.body || fontsSeen[1] || fontsSeen[0] || 'system-ui'
  const mono =
    brand?.fonts.mono ||
    fontsSeen.find((f) =>
      /mono|code|courier|menlo|consolas|jetbrains|fira/i.test(f)
    ) ||
    'ui-monospace'

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
    ...(brand
      ? {
          brand: {
            fontFiles: brand.fontFiles,
            ...(brand.logo ? { logo: brand.logo } : {}),
            ...(brand.symbol ? { symbol: brand.symbol } : {})
          }
        }
      : {}),
    warnings,
    extraction: {
      ...extractionOf(text, headings.length, site),
      tables: article.tables,
      codeBlocks: article.codeBlocks,
      notes: cuts
    }
  }
}
