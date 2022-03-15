import { WebSocketStatus } from '@hocuspocus/provider'
import { EditorContent } from '@tiptap/react'
import React, { useContext, useEffect, useRef } from 'react'
import { IoAddOutline } from 'react-icons/io5'
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton'
import { useRecoilState } from 'recoil'
import { useSetFlickNotDirtyMutation } from '../../../generated/graphql'
import { EditorContext } from '../Flick'
import { newFlickStore } from '../store/flickNew.store'
import { Block, Position, SimpleAST } from './utils/utils'

export function generateLightColorHex() {
  let color = '#'
  for (let i = 0; i < 3; i += 1)
    color += `0${Math.floor(((1 + Math.random()) * 16 ** 2) / 2).toString(
      16
    )}`.slice(-2)
  return color
}

const TipTap = ({
  handleActiveBlock,
  handleUpdatePosition,
  ast,
}: {
  handleUpdatePosition?: (position: Position) => void
  handleActiveBlock?: (block?: Block) => void
  ast: SimpleAST | undefined
}) => {
  const [{ flick }, setFlickStore] = useRecoilState(newFlickStore)

  const [markNotDirty] = useSetFlickNotDirtyMutation()

  const editorRef = useRef<HTMLDivElement>(null)

  const { editor, dragHandleRef, providerStatus } =
    useContext(EditorContext) || {}

  useEffect(() => {
    if (!flick || !flick.dirty || !flick.md || !editor || editor.isDestroyed)
      return

    editor?.commands.setContent(flick.md)
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
  }, [flick?.md, editor])

  useEffect(() => {
    if (!editor || !editorRef.current || editor.isDestroyed || !ast) return
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
      {providerStatus === WebSocketStatus.Connected && editor !== undefined && (
        <EditorContent editor={editor} />
      )}
    </div>
  )
}

export default TipTap
