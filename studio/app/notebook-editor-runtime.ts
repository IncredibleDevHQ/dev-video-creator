// TipTap and ProseMirror load only when a notebook's notes open for editing,
// so the start screen and the other stages do not download the editor.
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import CodeBlock from '@tiptap/extension-code-block'
import { Markdown } from '@tiptap/markdown'
import { TableKit } from '@tiptap/extension-table'
import Image from '@tiptap/extension-image'
import { codeFence } from '../shared/notes'

// A code block written back with a fence longer than any run of backticks
// in its code: a block that shows a fence keeps it (review 6: the save
// closed it early, and the notes after it turned to code).
const FencedCode = CodeBlock.extend({
  renderMarkdown: (node, h) => {
    const code = node.content ? h.renderChildren(node.content) : ''
    const fence = codeFence(code)
    return `${fence}${node.attrs?.language || ''}\n${code}\n${fence}`
  }
})

export const createNotebookEditor = (options: {
  element: HTMLElement
  content: string
  onUpdate: (editor: Editor) => void
  onSelectionUpdate: (editor: Editor) => void
}) =>
  new Editor({
    element: options.element,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false }, codeBlock: false }),
      FencedCode,
      Markdown,
      TableKit,
      Image
    ],
    content: options.content,
    contentType: 'markdown',
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-label': 'Notebook notes',
        'aria-multiline': 'true',
        spellcheck: 'true'
      }
    },
    onUpdate: ({ editor }) => options.onUpdate(editor),
    onSelectionUpdate: ({ editor }) => options.onSelectionUpdate(editor)
  })
