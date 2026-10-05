import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Code,
  Undo2,
  Redo2,
  createElement
} from 'lucide'
import type { Editor } from '@tiptap/core'
const tools = [
  ['bold', 'Bold', Bold],
  ['italic', 'Italic', Italic],
  ['bulletList', 'Bullet list', List],
  ['orderedList', 'Numbered list', ListOrdered],
  ['blockquote', 'Quote', Quote],
  ['codeBlock', 'Code block', Code],
  ['undo', 'Undo', Undo2],
  ['redo', 'Redo', Redo2]
] as const
export const notebookToolbar =
  () => `<div class="notebook-toolbar" role="toolbar" aria-label="Format notes">
<select data-note-block aria-label="Text style"><option value="paragraph">Text</option><option value="1">Heading 1</option><option value="2">Heading 2</option><option value="3">Heading 3</option></select>
<span class="toolbar-divider"></span>${tools.map(([id, label, icon]) => `<button type="button" data-note-command="${id}" aria-label="${label}" title="${label}" ${id !== 'undo' && id !== 'redo' ? 'aria-pressed="false"' : ''}>${createElement(icon, { width: 17, height: 17, 'aria-hidden': 'true' }).outerHTML}</button>`).join('')}
<span class="note-edit-status" data-note-save role="status" aria-live="polite">Saved</span></div>`
export const updateNotebookToolbar = (root: HTMLElement, editor: Editor) => {
  root
    .querySelectorAll<HTMLButtonElement>('[data-note-command]')
    .forEach((button) => {
      const name = button.dataset.noteCommand!
      if (name === 'undo') button.disabled = !editor.can().undo()
      else if (name === 'redo') button.disabled = !editor.can().redo()
      else button.setAttribute('aria-pressed', String(editor.isActive(name)))
    })
  const select = root.querySelector<HTMLSelectElement>('[data-note-block]')
  if (select)
    select.value = editor.isActive('heading')
      ? String(editor.getAttributes('heading').level)
      : 'paragraph'
}
export const runNotebookCommand = (editor: Editor, command: string) => {
  const chain = editor.chain().focus()
  switch (command) {
    case 'bold':
      return chain.toggleBold().run()
    case 'italic':
      return chain.toggleItalic().run()
    case 'bulletList':
      return chain.toggleBulletList().run()
    case 'orderedList':
      return chain.toggleOrderedList().run()
    case 'blockquote':
      return chain.toggleBlockquote().run()
    case 'codeBlock':
      return chain.toggleCodeBlock().run()
    case 'undo':
      return chain.undo().run()
    case 'redo':
      return chain.redo().run()
  }
}
