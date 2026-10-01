import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { removeRepeatedTitle } from '../shared/source-title'

export const sourceMarkdown = (source: string, title?: string) =>
  DOMPurify.sanitize(
    marked.parse(removeRepeatedTitle(source, title), {
      async: false,
      breaks: false
    }),
    {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ['form', 'input', 'button', 'style', 'iframe']
    }
  )
