/** @vitest-environment happy-dom */

import { Editor, JSONContent } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { afterEach, describe, expect, it } from 'vitest'
import NodeIdentifier from './index'

const editors: Editor[] = []

const flushIdentifierRepair = async () => {
  await new Promise<void>(resolve => {
    queueMicrotask(resolve)
  })
}

const createEditor = (content: JSONContent) => {
  const element = document.createElement('div')
  document.body.appendChild(element)

  const editor = new Editor({
    element,
    content,
    extensions: [
      StarterKit,
      NodeIdentifier.configure({
        types: ['paragraph', 'heading', 'bulletList', 'orderedList'],
      }),
    ],
  })

  editors.push(editor)
  return editor
}

const topLevelIdentifiers = (editor: Editor) =>
  editor.getJSON().content?.map(node => node.attrs?.id as string) || []

afterEach(() => {
  editors.splice(0).forEach(editor => editor.destroy())
  document.body.innerHTML = ''
})

describe('NodeIdentifier', () => {
  it('repairs missing IDs and preserves valid existing IDs', async () => {
    const editor = createEditor({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1, id: 'keep-me' },
          content: [{ type: 'text', text: 'Title' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Body' }],
        },
      ],
    })

    await flushIdentifierRepair()

    const identifiers = topLevelIdentifiers(editor)
    expect(identifiers[0]).toBe('keep-me')
    expect(identifiers[1]).toEqual(expect.any(String))
    expect(editor.getHTML()).toContain('id="keep-me"')
  })

  it('regenerates duplicate IDs', async () => {
    const editor = createEditor({
      type: 'doc',
      content: [
        { type: 'paragraph', attrs: { id: 'duplicate' } },
        { type: 'paragraph', attrs: { id: 'duplicate' } },
      ],
    })

    await flushIdentifierRepair()
    const identifiers = topLevelIdentifiers(editor)
    expect(identifiers[0]).toBe('duplicate')
    expect(identifiers[1]).not.toBe('duplicate')
  })

  it('gives a split node a fresh ID', async () => {
    const editor = createEditor({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { id: 'original' },
          content: [{ type: 'text', text: 'Hello world' }],
        },
      ],
    })

    await flushIdentifierRepair()
    editor.commands.setTextSelection(7)
    editor.commands.splitBlock()
    await flushIdentifierRepair()

    const identifiers = topLevelIdentifiers(editor)
    expect(identifiers).toHaveLength(2)
    expect(identifiers[0]).toBe('original')
    expect(identifiers[1]).not.toBe('original')
  })
})
