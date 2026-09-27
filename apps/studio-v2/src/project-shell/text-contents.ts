// The Text notebook's contents (the Open Slide pass): its headings, as a
// short list beside the article. Choosing one brings it into view, and the
// section being read is marked as the article scrolls. It is drawn from the
// article as the editor shows it; nothing here changes the article.
export const createTextContents = (nav: HTMLElement, article: () => HTMLElement | null, scroller: HTMLElement) => {
  let headings: HTMLElement[] = []
  let drawn = ''
  const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  // The section being read: the last heading above the top of the view.
  const mark = () => {
    if (nav.hidden) return
    const top = scroller.getBoundingClientRect().top + 32
    let current = headings[0] || null
    for (const heading of headings) {
      if (heading.getBoundingClientRect().top <= top) current = heading
      else break
    }
    nav.querySelectorAll<HTMLButtonElement>('button[data-heading]').forEach(button => {
      const on = headings[Number(button.dataset.heading)] === current
      if (on) button.setAttribute('aria-current', 'location')
      else button.removeAttribute('aria-current')
    })
  }
  const render = (on: boolean) => {
    const root = article()
    headings = on && root ? [...root.querySelectorAll<HTMLElement>(':scope > h1, :scope > h2, :scope > h3')].filter(heading => heading.textContent?.trim()) : []
    // A contents list is worth having from two sections on.
    nav.hidden = headings.length < 2
    const key = JSON.stringify(headings.map(heading => [heading.tagName, heading.textContent]))
    if (key !== drawn) {
      drawn = key
      const list = document.createElement('ol')
      headings.forEach((heading, index) => {
        const item = document.createElement('li')
        item.className = `text-contents-${heading.tagName.toLowerCase()}`
        const button = document.createElement('button')
        button.type = 'button'
        button.dataset.heading = String(index)
        button.textContent = heading.textContent?.trim() || ''
        button.addEventListener('click', () => headings[index]?.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' }))
        item.append(button)
        list.append(item)
      })
      const label = document.createElement('p')
      label.className = 'text-contents-label'
      label.textContent = 'Contents'
      nav.replaceChildren(label, list)
    }
    mark()
  }
  let frame = 0
  scroller.addEventListener('scroll', () => {
    if (frame) return
    frame = window.requestAnimationFrame(() => {
      frame = 0
      mark()
    })
  }, { passive: true })
  return { render }
}
