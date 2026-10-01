import { marked } from 'marked'
import DOMPurify from 'dompurify'

export const sourceMarkdown = (source: string) =>
  DOMPurify.sanitize(marked.parse(source, { async: false, breaks: false }), {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['form', 'input', 'button', 'style', 'iframe']
  })
