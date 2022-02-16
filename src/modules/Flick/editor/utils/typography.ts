import { Editor } from '@tiptap/core'
import Typography from '@tiptap/extension-typography'
import { marked } from 'marked'
import { Plugin } from 'prosemirror-state'

export default Typography.extend({
  addProseMirrorPlugins() {
    return [pastePlugin(this.editor)]
  },

  addGlobalAttributes() {
    return [
      {
        types: [
          'paragraph',
          'blockquote',
          'heading',
          'bulletList',
          'codeBlock',
          'orderedList',
          'image',
          'codeBlock',
          'video',
        ],
        attributes: {
          id: {
            default: null,
          },
        },
      },
    ]
  },
})

const pastePlugin = (editor: Editor) => {
  return new Plugin({
    props: {
      handlePaste(view, event) {
        const text = event.clipboardData?.getData('text/plain')
        if (isMarkdown(text || '')) {
          const md = marked.parse(text || '', {
            gfm: true,
            smartLists: true,
            smartypants: true,
          })
          const { selection } = view.state
          editor.commands.insertContentAt(selection.anchor, md, {
            parseOptions: {
              preserveWhitespace: true,
            },
          })
          return true
        }
        return false
      },
    },
  })
}

function isMarkdown(text: string): boolean {
  // code-ish
  const fences = text.match(/^```/gm)
  if (fences && fences.length > 1) return true

  // link-ish
  if (text.match(/\[[^]+\]\(https?:\/\/\S+\)/gm)) return true
  if (text.match(/\[[^]+\]\(\/\S+\)/gm)) return true

  // heading-ish
  if (text.match(/^#{1,6}\s+\S+/gm)) return true

  // list-ish
  const listItems = text.match(/^[\d-*].?\s\S+/gm)
  if (listItems && listItems.length > 1) return true

  return false
}
