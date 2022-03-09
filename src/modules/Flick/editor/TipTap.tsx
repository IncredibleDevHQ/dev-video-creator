import { cx } from '@emotion/css'
import { HocuspocusProvider, WebSocketStatus } from '@hocuspocus/provider'
import UniqueID from '@tiptap-pro/extension-unique-id'
import CharacterCount from '@tiptap/extension-character-count'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import Focus from '@tiptap/extension-focus'
import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { IoAddOutline } from 'react-icons/io5'
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton'
import { useRecoilState, useRecoilValue } from 'recoil'
import * as Y from 'yjs'
import { useSetFlickNotDirtyMutation } from '../../../generated/graphql'
import { databaseUserState } from '../../../stores/user.store'
import { newFlickStore } from '../store/flickNew.store'
import CodeBlock from './blocks/CodeBlock'
import ImageBlock from './blocks/ImageBlock'
import VideoBlock from './blocks/VideoBlock'
import { getSuggestionItems } from './slashCommand/items'
import renderItems from './slashCommand/renderItems'
import { SlashCommands } from './slashCommand/SlashCommands'
import editorStyle from './style'
import { DragHandler } from './utils/drag'
import { TrailingNode } from './utils/trailingNode'
import CustomTypography from './utils/typography'
import { Block, Position, SimpleAST, useUtils } from './utils/utils'

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
  provider,
  yDoc,
  providerStatus,
}: {
  handleUpdatePosition?: (position: Position) => void
  handleUpdateAst?: (ast: SimpleAST, content: string) => void
  handleActiveBlock?: (block?: Block) => void
  provider: HocuspocusProvider
  yDoc: Y.Doc
  providerStatus: string | undefined
}) => {
  const user = useRecoilValue(databaseUserState)
  const [{ flick }, setFlickStore] = useRecoilState(newFlickStore)
  const utils = useUtils()
  const [ast, setAST] = useState<SimpleAST>()

  const [markNotDirty] = useSetFlickNotDirtyMutation()

  const dragRef = useRef<HTMLDivElement>(null)

  const editor = useEditor(
    {
      onUpdate: ({ editor }) => {
        utils.getSimpleAST(editor.getJSON()).then((simpleAST) => {
          setAST(simpleAST)
          handleUpdate()
          handleUpdateAst?.(simpleAST, editor.getHTML())
        })
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
            'image',
          ],
        }),
        DragHandler(dragRef.current),
        Focus,
        CustomTypography,
        StarterKit.configure({
          history: false,
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
    },
    [user?.displayName]
  )

  const editorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return () => {
      editor?.destroy()
      provider.destroy()
    }
  }, [])

  useEffect(() => {
    if (
      !flick ||
      !flick.dirty ||
      !flick.md ||
      !editor ||
      editor.isDestroyed ||
      providerStatus !== WebSocketStatus.Connected
    )
      return

    setFlickStore((prev) => ({
      ...prev,
      flick: {
        ...flick,
        dirty: false,
      },
    }))
    markNotDirty({
      variables: {
        id: flick.id,
      },
    })
    editor?.commands.setContent(flick.md)
  }, [flick, editor, providerStatus])

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

    const x = editor.state.selection.from
    let n = editor.state.doc.nodeAt(x)
    if (n?.isText) {
      n = editor.state.doc.childBefore(x).node
    }
    let nodeAttrs = n?.attrs

    if (!n) {
      nodeAttrs = (editor.state.selection.$from as any).path[3]?.attrs
    }
    const block = ast?.blocks.find(
      (b) => b.id === nodeAttrs?.id || b.nodeIds?.includes(nodeAttrs?.id)
    )
    if (nodeAttrs && ast && nodeAttrs.id && block) {
      handleActiveBlock?.(block)
    } else {
      handleActiveBlock?.()
    }
    handleUpdatePosition?.({
      x: editor?.view.coordsAtPos(editor.state.selection.anchor)?.left || 0,
      y:
        editor?.view.coordsAtPos(editor.state.selection.anchor)?.top -
          editorRef.current?.getBoundingClientRect().y +
          175 || 0,
    })
  }, [editor?.state.selection.anchor, editorRef.current])

  return (
    <div className="pb-32 bg-white mt-4" ref={editorRef}>
      <div
        ref={dragRef}
        id="drag-handle"
        className="hidden items-center text-gray-300 transition-all duration-75 ease-in-out"
      >
        <div className="cursor-pointer flex-shrink-0 hover:bg-gray-100 hover:text-gray-400 rounded-sm p-1">
          <IoAddOutline size={20} className="" />
        </div>
        <span
          style={{
            cursor: 'grab',
          }}
          className="text-xl hover:bg-gray-100 hover:text-gray-400 px-1 rounded-sm cursor-move"
        >
          ⠿
        </span>
      </div>

      {providerStatus !== WebSocketStatus.Connected && (
        <SkeletonTheme>
          <div className="flex flex-col">
            <Skeleton height={30} />
            <Skeleton height={30} width={400} />
            <Skeleton height={30} width={450} />
            <Skeleton height={30} width={200} />
            <Skeleton height={30} className="mt-12" />
            <Skeleton height={30} width={600} />
            <Skeleton height={30} width={650} />
            <Skeleton height={30} />
            <Skeleton height={30} width={600} />
            <Skeleton height={30} width={650} />

            <Skeleton height={30} className="mt-12" />
            <Skeleton height={30} width={400} />
            <Skeleton height={30} width={450} />
            <Skeleton height={30} width={200} />
            <Skeleton height={30} className="mt-12" />
            <Skeleton height={30} width={600} />
            <Skeleton height={30} width={650} />
            <Skeleton height={30} />
            <Skeleton height={30} width={600} />
            <Skeleton height={30} width={650} />
          </div>
        </SkeletonTheme>
      )}
      {providerStatus === WebSocketStatus.Connected && (
        <EditorContent editor={editor} />
      )}
    </div>
  )
}

export default TipTap
