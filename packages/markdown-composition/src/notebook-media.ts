import type { TiptapDocument, TiptapNode } from './types'

const MEDIA_NODE_TYPES = new Set(['image', 'screenRecording'])

// blob: URLs only resolve inside the browser session that created them, so a
// persisted one can never load again. Reset the node to the retryable
// upload-failed state instead of storing a permanently dead source.
export const sanitizeNotebookMedia = (document: TiptapDocument): boolean => {
  let changed = false
  const visit = (node: TiptapNode) => {
    const src = node.attrs?.src
    if (
      MEDIA_NODE_TYPES.has(node.type) &&
      typeof src === 'string' &&
      src.startsWith('blob:')
    ) {
      node.attrs = { ...node.attrs, src: '', status: 'error' }
      changed = true
    }
    node.content?.forEach(visit)
  }
  visit(document)
  return changed
}
