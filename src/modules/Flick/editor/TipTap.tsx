/* eslint-disable no-console */
import { cx } from '@emotion/css'
import UniqueID from '@tiptap-pro/extension-unique-id'
import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import React, { useEffect, useRef, useState } from 'react'
import CodeBlock from './blocks/CodeBlock'
import ImageBlock from './blocks/ImageBlock'
import NoteBlock from './blocks/NoteBlock'
import Slab from './blocks/Slab'
import UploadBlock from './blocks/UploadBlock'
import VideoBlock from './blocks/VideoBlock'
import { getSuggestionItems } from './slashCommand/items'
import renderItems from './slashCommand/renderItems'
import { SlashCommands } from './slashCommand/SlashCommands'
import { Block, Position, SimpleAST, useUtils } from './utils/utils'

const TipTap = ({
  handleActiveBlock,
  handleUpdateAst,
  handleUpdatePosition,
  initialContent,
}: {
  handleUpdatePosition?: (position: Position) => void
  handleUpdateAst?: (ast: SimpleAST) => void
  initialContent?: SimpleAST
  handleActiveBlock?: (block?: Block) => void
}) => {
  const utils = useUtils()
  const [ast, setAST] = useState<SimpleAST>()

  const editor = useEditor({
    onUpdate: ({ editor }) => {
      const simpleAST = utils.getSimpleAST(editor.getJSON())
      setAST(simpleAST)
      handleUpdateAst?.(simpleAST)
    },
    editorProps: {
      attributes: {
        class: cx('w-full h-full border-none focus:outline-none p-2'),
      },
    },
    autofocus: true,
    extensions: [
      UniqueID.configure({
        types: ['slab'],
      }),
      StarterKit.configure({
        codeBlock: false,
        heading: {
          levels: [2],
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
        placeholder: ({ node }) => {
          const headingPlaceholders: {
            [key: number]: string
          } = {
            1: 'Heading',
            2: 'Heading',
            3: 'Heading',
          }

          if (node.type.name === 'heading') {
            const level = node.attrs.level as number
            return headingPlaceholders[level]
          }

          return 'Type "/" to get started'
        },
      }),
      CodeBlock,
      ImageBlock,
      VideoBlock,
      UploadBlock,
      Slab,
      NoteBlock,
    ],
    content: ``,
  })

  const editorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!initialContent || !editor) return
    editor.commands.setContent(utils.getEditorState(initialContent))
    setAST(initialContent)
  }, [editor])

  useEffect(() => {
    if (!editor || !editorRef.current) return
    const nodeAttrs = (editor.state.selection.$from as any).path[3].attrs
    const blockTypes = ['code', 'image', 'video', 'list']
    if (ast && nodeAttrs.id && blockTypes.includes(nodeAttrs.type)) {
      handleActiveBlock?.(ast.blocks.find((block) => block.id === nodeAttrs.id))
    } else {
      handleActiveBlock?.()
    }
    handleUpdatePosition?.({
      x: editor?.view.coordsAtPos(editor.state.selection.anchor)?.left || 0,
      y:
        editor?.view.coordsAtPos(editor.state.selection.anchor)?.top -
          editorRef.current?.getBoundingClientRect().y || 0,
    })
  }, [editor?.state.selection.anchor, editorRef.current])

  // console.log(editor?.view.domAtPos(editor?.state.selection.$anchor.start()))

  // console.log(editor?.view.domAtPos(editor?.state.selection.$anchor.start()))
  // console.log(editor?.state.selection.content().content.toJSON())

  return (
    <div className="pb-32" ref={editorRef}>
      <EditorContent editor={editor} />
    </div>

    // <div className="flex justify-center w-full h-full overflow-y-scroll ">
    //   <div
    //     style={{
    //       top: editor?.view.coordsAtPos(editor.state.selection.anchor)?.top,
    //       left: editor?.view.coordsAtPos(editor.state.selection.anchor)?.left,
    //     }}
    //     className="absolute z-50 text-xs bg-white"
    //   >
    //     {editor?.view.coordsAtPos(editor.state.selection.anchor)?.top},
    //     {editor?.view.coordsAtPos(editor.state.selection.anchor)?.left}
    //   </div>
    //   <button
    //     className="px-2 border border-gray-500 rounded-sm"
    //     type="button"
    //     onClick={() => {
    //       console.log(JSON.stringify(editor?.getJSON()))
    //       console.log(editor?.getHTML())
    //       // console.log(editor?.schema)
    //       // console.log(editor?.state.selection.content().content.toJSON())
    // console.log(
    //   editor?.view.domAtPos(editor?.state.selection.$anchor.start())
    // )
    //     }}
    //   >
    //     Get JSON
    //   </button>
    //   <hr className="mt-4 text-black bg-black" />
    //   <EditorContent className="w-full h-full" editor={editor} />
    // </div>
  )
}

export default TipTap
