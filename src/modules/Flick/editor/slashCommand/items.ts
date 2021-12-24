/* eslint-disable @typescript-eslint/no-unused-vars */
import { Editor, Range } from '@tiptap/core'

export enum SuggestionItemType {
  Formatting = 'FORMATTING',
  // Elements = 'ELEMENTS',
  Blocks = 'BLOCKS',
}

export interface SuggestionItem {
  title: string
  description: string
  type: SuggestionItemType
  shortcut: string | null
  command: (props: { editor: Editor; range: Range; props: any }) => void
}

export const getSuggestionItems = (props: {
  query: string
  editor: Editor
}) => {
  return [
    // {
    //   title: 'Custom',
    //   command: ({ editor, range }) => {
    //     editor
    //       .chain()
    //       .focus()
    //       .deleteRange(range)
    //       .insertContent('<custom-block><p>test</p></custom-block>')
    //       .run()
    //   },
    // },
    // {
    //   title: 'H2',
    //   description: 'Fragment title',
    //   shortcut: '##',
    //   type: SuggestionItemType.Formatting,
    //   command: ({ editor, range }) => {
    //     editor
    //       .chain()
    //       .focus()
    //       .deleteRange(range)
    //       .setNode('heading', { level: 2 })
    //       .run()
    //   },
    // },
    // {
    //   title: 'H3',
    //   description: 'Block title',
    //   shortcut: '###',
    //   type: SuggestionItemType.Formatting,
    //   command: ({ editor, range }) => {
    //     editor
    //       .chain()
    //       .focus()
    //       .deleteRange(range)
    //       .setNode('heading', { level: 3 })
    //       .run()
    //   },
    // },
    // {
    //   title: 'Text',
    //   description: 'Plain text',
    //   shortcut: null,
    //   type: SuggestionItemType.Formatting,
    //   command: ({ editor, range }) => {
    //     editor.chain().focus().deleteRange(range).setNode('paragraph').run()
    //   },
    // },
    {
      title: 'Code',
      description: 'Add a code block',
      shortcut: '```',
      type: SuggestionItemType.Blocks,
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent(
            `<slab type="code"><h2></h2><p></p><pre><code></code></pre><note><p></p></note></slab><p></p>`
          )
          .run()
      },
    },
    {
      title: 'Image',
      description: 'Upload an image',
      shortcut: null,
      type: SuggestionItemType.Blocks,
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent(
            '<slab type="image"><h2></h2><p></p><upload type="image"></p></upload><note><p></p></note></slab><p></p>'
          )
          .run()
      },
    },
    {
      title: 'Video',
      description: 'Upload a video',
      shortcut: null,
      type: SuggestionItemType.Blocks,
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent(
            '<slab type="video"><h2></h2><p></p><upload type="video"></p></upload><note><p></p></note></slab><p></p>'
          )
          .run()
      },
    },
    {
      title: 'List',
      description: 'List of items',
      shortcut: null,
      type: SuggestionItemType.Blocks,
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent(
            '<slab type="list"><h2></h2><p></p><ul><li><p></p></li></ul><note><p></p></note></slab><p></p>'
          )
          .run()
        // editor.chain().focus().deleteRange(range).toggleBulletList().run()
      },
    },
  ] as SuggestionItem[]
}
