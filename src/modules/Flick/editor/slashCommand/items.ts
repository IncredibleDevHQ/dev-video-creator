/* eslint-disable @typescript-eslint/no-unused-vars */
import { Editor, Range } from '@tiptap/core'

export enum SuggestionItemType {
  Formatting = 'FORMATTING',
  // Elements = 'ELEMENTS',
  Blocks = 'BLOCKS',
  Interactions = 'INTERACTIONS',
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
  return (
    [
      {
        title: 'H1',
        description: 'Heading 1',
        shortcut: '#',
        type: SuggestionItemType.Formatting,
        command: ({ editor, range }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .setNode('heading', { level: 1 })
            .run()
        },
      },
      {
        title: 'H2',
        description: 'Heading 2',
        shortcut: '##',
        type: SuggestionItemType.Formatting,
        command: ({ editor, range }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .setNode('heading', { level: 2 })
            .run()
        },
      },
      {
        title: 'H3',
        description: 'Heading 3',
        shortcut: '###',
        type: SuggestionItemType.Formatting,
        command: ({ editor, range }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .setNode('heading', { level: 3 })
            .run()
        },
      },
      {
        title: 'Text',
        description: 'Plain text',
        shortcut: null,
        type: SuggestionItemType.Formatting,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setNode('paragraph').run()
        },
      },
      {
        title: 'Code',
        description: 'Add a code block',
        shortcut: '```',
        type: SuggestionItemType.Blocks,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleCodeBlock().run()
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
            .setImage({
              src: '',
            })
            .run()
        },
      },
      {
        title: 'Screengrab',
        description: 'Record a screen',
        shortcut: null,
        type: SuggestionItemType.Blocks,
        command: ({ editor, range }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent('<video type="recording"><p></p></video>')
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
            .insertContent('<video><p></p></video>')
            .run()
        },
      },
      {
        title: 'List',
        description: 'List of items',
        shortcut: null,
        type: SuggestionItemType.Blocks,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleBulletList().run()
        },
      },
      {
        title: 'CodeSandbox',
        description: 'Embed CodeSandbox',
        shortcut: null,
        type: SuggestionItemType.Interactions,
        command: ({ editor, range }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent(
              '<interaction type="codesandbox"><p></p></interaction>'
            )
            .run()
        },
      },
      {
        title: 'StackBlitz',
        description: 'Embed StackBlitz',
        shortcut: null,
        type: SuggestionItemType.Interactions,
        command: ({ editor, range }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent(
              '<interaction type="stackblitz"><p></p></interaction>'
            )
            .run()
        },
      },
      {
        title: 'Replit',
        description: 'Embed Replit',
        shortcut: null,
        type: SuggestionItemType.Interactions,
        command: ({ editor, range }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent('<interaction type="replit"><p></p></interaction>')
            .run()
        },
      },
    ] as SuggestionItem[]
  )
    .filter((item) =>
      item.title.toLowerCase().startsWith(props.query.toLowerCase())
    )
    .slice(0, 12)
}
