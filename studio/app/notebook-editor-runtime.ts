// TipTap and ProseMirror load only when a notebook's notes open for editing,
// so the start screen and the other stages do not download the editor.
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { TableKit } from '@tiptap/extension-table'
import Image from '@tiptap/extension-image'

export const createNotebookEditor = (options: {
  element: HTMLElement
  content: string
  onUpdate: (editor: Editor) => void
  onSelectionUpdate: (editor: Editor) => void
}) =>
  new Editor({
    element: options.element,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
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
