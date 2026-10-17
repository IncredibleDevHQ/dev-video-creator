// Select prose before serializing it. The page body is always larger than its
// article, so size must never let the site shell outrank an explicit article.
const CHROME = [
  'nav',
  'aside',
  'footer',
  'script',
  'style',
  'noscript',
  'template',
  'form',
  'iframe',
  'svg',
  'button',
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
  '[role="dialog"]',
  '[role="search"]',
  '[role="menu"]',
  '[hidden]',
  '[inert]',
  '[aria-hidden="true"]',
  '.share',
  '.social-share',
  '.comments',
  '.newsletter',
  '.sidebar',
  '.related-posts',
  '.related-articles',
  '.cookie-banner'
].join(', ')

const cleaned = (node: Element) => {
  const clone = node.cloneNode(true) as Element
  clone.querySelectorAll(CHROME).forEach((child) => child.remove())
  return clone
}

export const sourceContent = (document: Document): Element => {
  // Remove the site shell before looking for candidates: an article preview
  // inside a sidebar or a hidden mobile copy must not win the selection.
  const body = cleaned(document.body)
  for (const selector of [
    '[itemprop~="articleBody"]',
    'article, [role="article"]',
    'main, [role="main"]'
  ]) {
    const candidates = Array.from(body.querySelectorAll(selector))
      .filter((node) => (node.textContent || '').trim())
      .sort(
        (a, b) => (b.textContent || '').length - (a.textContent || '').length
      )
    if (candidates.length) return candidates[0]
  }
  // Pages without semantic content markup still retain their prose, tables,
  // and code. Strip only the page header; article headers hold real titles.
  body.querySelectorAll('header').forEach((node) => node.remove())
  return body
}
