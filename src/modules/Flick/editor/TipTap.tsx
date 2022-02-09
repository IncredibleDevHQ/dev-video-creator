import { cx } from '@emotion/css'
import { HocuspocusProvider } from '@hocuspocus/provider'
import UniqueID from '@tiptap-pro/extension-unique-id'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import Focus from '@tiptap/extension-focus'
import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { IoAddOutline } from 'react-icons/io5'
import { useRecoilValue } from 'recoil'
import * as Y from 'yjs'
import config from '../../../config'
import { databaseUserState } from '../../../stores/user.store'
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
import { DragHandler } from './utils/drag'
import CustomTypography from './utils/typography'
import { Block, Position, SimpleAST, useUtils } from './utils/utils'

const yDoc = new Y.Doc()

const provider = new HocuspocusProvider({
  document: yDoc,
  url: config.hocusPocus.server,
  name: `flick-doc-${window.location.href.split('/').pop()}`,
})

function generateLightColorHex() {
  let color = '#'
  for (let i = 0; i < 3; i += 1)
    color += `0${Math.floor(((1 + Math.random()) * 16 ** 2) / 2).toString(
      16
    )}`.slice(-2)
  return color
}

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
  const user = useRecoilValue(databaseUserState)
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
      Collaboration.configure({
        document: yDoc,
      }),
      CollaborationCursor.configure({
        provider,
        user: {
          name: user?.displayName || 'Anonymous',
          color: generateLightColorHex(),
        },
      }),
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
      DragHandler(),
      Focus,
      CustomTypography,
      StarterKit.configure({
        history: false,
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

          if (node.type.name === 'paragraph') {
            const selectedNode = editor.view.domAtPos(
              editor.state.selection.from
            ).node
            if (
              selectedNode.nodeName === 'P' &&
              selectedNode.firstChild?.parentElement?.classList.contains(
                'has-focus'
              ) &&
              selectedNode.firstChild?.parentElement.id === node.attrs.id
            ) {
              return 'Type / for commands'
            }
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
  })

  const editorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return () => {
      editor?.destroy()
      provider.destroy()
    }
  }, [])

  useEffect(() => {
    if (!initialContent || !editor || editor.isDestroyed) return
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
      <div id="drag-handle" className="flex items-center text-gray-300">
        <div className="cursor-pointer flex-shrink-0 hover:bg-gray-100 hover:text-gray-400 rounded-sm p-1">
          <IoAddOutline size={20} className="" />
        </div>
        <span
          style={{
            cursor: 'grab',
          }}
          className="text-xl hover:bg-gray-100 hover:text-gray-400 px-1 rounded-sm"
        >
          ⠿
        </span>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}

export default TipTap
