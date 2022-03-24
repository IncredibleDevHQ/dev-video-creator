import { EditorContent } from '@tiptap/react'
import React, { useContext, useEffect, useRef } from 'react'
import { IoAddOutline } from 'react-icons/io5'
import { EditorContext } from '../components/EditorProvider'
import { Block, Position, SimpleAST } from './utils/utils'

const TipTap = ({
  handleActiveBlock,
  handleUpdatePosition,
  ast,
  initialContent,
}: {
  handleUpdatePosition?: (position: Position) => void
  handleActiveBlock?: (block?: Block) => void
  ast: SimpleAST | undefined
  initialContent: string
}) => {
  const editorRef = useRef<HTMLDivElement>(null)

  const { editor, dragHandleRef } = useContext(EditorContext) || {}

  useEffect(() => {
    if (!editor || editor.isDestroyed || !initialContent) return

    editor.commands.setContent(initialContent)
  }, [editor])

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

      {editor && <EditorContent editor={editor} />}
    </div>
  )
}

export default TipTap
