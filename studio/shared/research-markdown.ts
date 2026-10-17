import { marked, Renderer } from 'marked'
const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
/** Same renderer in the browser and engine, so excerpt offsets survive
 * Markdown formatting. Raw HTML and remote images are never executed. */
const renderer = new Renderer()
Object.assign(renderer, {
  html() {
    return ''
  },
  image({ text }: import('marked').Tokens.Image) {
    return escape(text)
  },
  link(this: Renderer, { href, tokens }: import('marked').Tokens.Link) {
    const label = this.parser.parseInline(tokens)
    return /^https?:\/\//i.test(href)
      ? `<a href="${escape(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`
      : label
  }
})
export const researchHtml = (source: string): string =>
  marked.parse(source, { async: false, renderer })
