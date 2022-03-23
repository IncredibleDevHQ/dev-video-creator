import { cx } from '@emotion/css'
import UniqueID from '@tiptap-pro/extension-unique-id'
import { Editor as CoreEditor } from '@tiptap/core'
import CharacterCount from '@tiptap/extension-character-count'
import Focus from '@tiptap/extension-focus'
import Placeholder from '@tiptap/extension-placeholder'
import { Editor, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import React, { useEffect, useRef } from 'react'
import CodeBlock from '../editor/blocks/CodeBlock'
import ImageBlock from '../editor/blocks/ImageBlock'
import VideoBlock from '../editor/blocks/VideoBlock'
import { getSuggestionItems } from '../editor/slashCommand/items'
import renderItems from '../editor/slashCommand/renderItems'
import { SlashCommands } from '../editor/slashCommand/SlashCommands'
import editorStyle from '../editor/style'
import { DragHandler } from '../editor/utils/drag'
import { TrailingNode } from '../editor/utils/trailingNode'
import CustomTypography from '../editor/utils/typography'

export const EditorContext = React.createContext<{
  editor: Editor | null
  dragHandleRef: React.RefObject<HTMLDivElement>
} | null>(null)

export function generateLightColorHex() {
  let color = '#'
  for (let i = 0; i < 3; i += 1)
    color += `0${Math.floor(((1 + Math.random()) * 16 ** 2) / 2).toString(
      16
    )}`.slice(-2)
  return color
}

export const EditorProvider = ({
  children,
  handleUpdate,
}: {
  children: JSX.Element
  handleUpdate?: (editor: CoreEditor) => void
}): JSX.Element => {
  const dragRef = useRef<HTMLDivElement>(null)
  const editor = useEditor({
    onUpdate: ({ editor }) => {
      handleUpdate?.(editor)
    },
    editorProps: {
      attributes: {
        class: cx(
          'prose prose-sm max-w-none w-full h-full border-none focus:outline-none',
          editorStyle
        ),
      },
    },
    autofocus: 'start',
    extensions: [
      UniqueID.configure({
        attributeName: 'id',
        types: [
          'paragraph',
          'blockquote',
          'heading',
          'bulletList',
          'orderedList',
          'codeBlock',
          'video',
          'image',
        ],
      }),
      DragHandler(dragRef.current),
      Focus,
      CustomTypography,
      StarterKit.configure({
        codeBlock: false,
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
        bulletList: {
          itemTypeName: 'listItem',
        },
        dropcursor: {
          width: 3.5,
          color: '#C3E2F0',
          class: 'transition-all duration-200 ease-in-out',
        },
      }),
      SlashCommands.configure({
        suggestion: {
          items: getSuggestionItems,
          render: renderItems,
        },
      }),
      Placeholder.configure({
        showOnlyWhenEditable: true,
        includeChildren: true,
        showOnlyCurrent: false,
        emptyEditorClass: 'is-editor-empty',
        placeholder: ({ node, editor }) => {
          const headingPlaceholders: {
            [key: number]: string
          } = {
            1: 'Heading 1',
            2: 'Heading 2',
            3: 'Heading 3',
            4: 'Heading 4',
            5: 'Heading 5',
            6: 'Heading 6',
          }

          if (node.type.name === 'heading') {
            const level = node.attrs.level as number
            return headingPlaceholders[level]
          }

          if (
            node.type.name === 'paragraph' &&
            editor.getJSON().content?.length === 1
          ) {
            return 'Type / to get started'
          }

          if (node.type.name === 'paragraph') {
            const selectedNode = editor.view.domAtPos(
              editor.state.selection.from
            ).node
            if (
              selectedNode.nodeName === 'P' &&
              selectedNode.firstChild?.parentElement?.id === node.attrs.id
            ) {
              return 'Type / for commands'
            }
          }

          return ''
        },
      }),
      CodeBlock,
      ImageBlock.configure({
        inline: false,
      }),
      VideoBlock,
      TrailingNode,
      CharacterCount.configure({
        limit: 20000,
      }),
    ],
    content: ``,
  })

  useEffect(() => {
    return () => {
      editor?.destroy()
    }
  }, [])

  return (
    <EditorContext.Provider
      value={{
        editor,
        dragHandleRef: dragRef,
      }}
    >
      {children}
    </EditorContext.Provider>
  )
}
export default EditorProvider
