import { WebSocketStatus } from '@hocuspocus/provider'
import { EditorContent } from '@tiptap/react'
import React, { useContext, useEffect, useRef } from 'react'
import { IoAddOutline } from 'react-icons/io5'
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton'
import { EditorContext } from '../components/EditorProvider'
import { Block, Position, SimpleAST } from './utils/utils'

const TipTap = ({
  handleActiveBlock,
  handleUpdatePosition,
  ast,
  initialRender,
}: {
  handleUpdatePosition?: (position: Position) => void
  handleActiveBlock?: (block?: Block) => void
  ast: SimpleAST | undefined
  initialRender: React.MutableRefObject<boolean>
}) => {
  const editorRef = useRef<HTMLDivElement>(null)

  const { editor, dragHandleRef, providerWebsocketState } =
    useContext(EditorContext) || {}

  useEffect(() => {
    if (!editor || !editorRef.current || editor.isDestroyed || !ast) return
    const x = editor.state.selection.from
    let n = editor.state.doc.nodeAt(x)
    if (n?.isText) {
      n = editor.state.doc.childBefore(x).node
    }
    let nodeAttrs = n?.attrs

    if (!n) {
      const path = (editor.state.selection.$from as any).path[3]
      if (path?.content?.size > 0) {
        nodeAttrs = (editor.state.selection.$from as any).path[3]?.attrs
      }
    }
    const block = ast?.blocks.find(
      (b) => b.id === nodeAttrs?.id || b.nodeIds?.includes(nodeAttrs?.id)
    )
    if (nodeAttrs && ast && nodeAttrs.id && block) {
      handleActiveBlock?.(block)
      handleUpdatePosition?.({
        x: editor?.view.coordsAtPos(editor.state.selection.anchor)?.left || 0,
        y:
          editor?.view.coordsAtPos(editor.state.selection.anchor)?.top -
            editorRef.current?.getBoundingClientRect().y +
            175 || 0,
      })
    } else {
      handleActiveBlock?.(undefined)
    }
  }, [editor?.state.selection.anchor, editorRef.current])

  return (
    <div className="pb-32 bg-white mt-4" ref={editorRef}>
      <div
        style={{
          zIndex: 0,
        }}
        ref={dragHandleRef}
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
      {editor && providerWebsocketState === WebSocketStatus.Connecting && (
        <TipTapSkeleton
          status={providerWebsocketState}
          initialRender={initialRender}
        />
      )}
      {editor && providerWebsocketState !== WebSocketStatus.Connecting && (
        <EditorContent editor={editor} />
      )}
    </div>
  )
}

const TipTapSkeleton = ({
  status,
  initialRender,
}: {
  status: WebSocketStatus
  initialRender: React.MutableRefObject<boolean>
}) => {
  useEffect(() => {
    if (status === WebSocketStatus.Connected && initialRender.current) {
      // eslint-disable-next-line no-param-reassign
      initialRender.current = false
    }
  }, [initialRender])

  return (
    <div
      style={{
        display: !initialRender.current ? 'none' : 'block',
      }}
    >
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
    </div>
  )
}

export default TipTap
