import { cx } from '@emotion/css'
import UniqueID from '@tiptap-pro/extension-unique-id'
import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import CodeBlock from './blocks/CodeBlock'
import ImageBlock from './blocks/ImageBlock'
import NoteBlock from './blocks/NoteBlock'
import Slab from './blocks/Slab'
import UploadBlock from './blocks/UploadBlock'
import VideoBlock from './blocks/VideoBlock'
import { getSuggestionItems } from './slashCommand/items'
import renderItems from './slashCommand/renderItems'
import { SlashCommands } from './slashCommand/SlashCommands'
import editorStyle from './style'
import CustomTypography from './utils/typography'
import { Block, Position, SimpleAST, useUtils } from './utils/utils'

const TipTap = ({
  handleActiveBlock,
  handleUpdateAst,
  handleUpdatePosition,
  initialContent,
}: {
  handleUpdatePosition?: (position: Position) => void
  handleUpdateAst?: (ast: SimpleAST, content: string) => void
  initialContent?: string
  handleActiveBlock?: (block?: Block) => void
}) => {
  const utils = useUtils()
  const [ast, setAST] = useState<SimpleAST>()

  const editor = useEditor({
    onUpdate: ({ editor }) => {
      const simpleAST = utils.getSimpleAST(editor.getJSON())
      setAST(simpleAST)
      handleUpdate()
      handleUpdateAst?.(simpleAST, editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: cx(
          'prose max-w-none w-full h-full border-none focus:outline-none',
          editorStyle
        ),
      },
    },
    autofocus: true,
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
        ],
      }),
      CustomTypography,
      StarterKit.configure({
        codeBlock: false,
        heading: {
          levels: [1, 2, 3],
        },
        bulletList: {
          itemTypeName: 'listItem',
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

          return ''
        },
      }),
      CodeBlock,
      ImageBlock.configure({
        inline: true,
      }),
      VideoBlock,
      UploadBlock,
      Slab,
      NoteBlock,
    ],
    content: ``,
  })

  const editorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!initialContent || !editor || editor.isDestroyed) return
    editor.commands.setContent(initialContent)

    const simpleAST = utils.getSimpleAST(editor.getJSON())
    handleUpdate()
    handleUpdateAst?.(simpleAST, editor.getHTML())
    setAST(simpleAST)
  }, [editor])

  const handleUpdate = useCallback(() => {
    if (!editor || editor.isDestroyed) return
    const transaction = editor.state.tr
    editor.state.doc.descendants((node, pos) => {
      const { id } = node.attrs
      if (node.attrs.id !== id) {
        transaction.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          id,
        })
      }
    })
    transaction.setMeta('preventUpdate', true)
    editor.view.dispatch(transaction)
  }, [editor])

  useEffect(() => {
    if (!editor || !editorRef.current || editor.isDestroyed) return

    const nodeAttrs = (editor.state.selection.$from as any).path[3]?.attrs
    if (nodeAttrs && ast && nodeAttrs.id) {
      const block = ast.blocks.find(
        (b) => b.id === nodeAttrs.id || b.nodeIds?.includes(nodeAttrs.id)
      )
      handleActiveBlock?.(block)
    } else {
      handleActiveBlock?.()
    }
    handleUpdatePosition?.({
      x: editor?.view.coordsAtPos(editor.state.selection.anchor)?.left || 0,
      y:
        editor?.view.coordsAtPos(editor.state.selection.anchor)?.top -
          editorRef.current?.getBoundingClientRect().y +
          150 || 0,
    })
  }, [editor?.state.selection.anchor, editorRef.current])

  return (
    <div className="pb-32 bg-white mt-4" ref={editorRef}>
      <EditorContent editor={editor} />
    </div>
  )
}

export default TipTap
