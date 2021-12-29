import { css, cx } from '@emotion/css'
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
          'prose max-w-none w-full h-full border-none focus:outline-none p-2',
          styles2
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
    if (!initialContent || !editor) return

    editor.commands.setContent(initialContent)
    const simpleAST = utils.getSimpleAST(editor.getJSON())
    handleUpdate()
    handleUpdateAst?.(simpleAST, editor.getHTML())
    setAST(simpleAST)
  }, [editor])

  const handleUpdate = useCallback(() => {
    if (!editor) return

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
    if (!editor || !editorRef.current) return
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

const styles2 = css`
  h1,
  h2,
  h3 {
    color: rgba(31, 41, 55);
    font-family: Gilroy, ui-sans-serif, system-ui, -apple-system,
      BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
      'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji',
      'Segoe UI Symbol', 'Noto Color Emoji';
  }

  p {
    color: rgba(75, 85, 99);
    font-family: 'Inter';
    word-wrap: break-word;
  }

  p.is-empty::before,
  h1.is-empty::before,
  h2.is-empty::before,
  h3.is-empty::before {
    color: rgba(209, 213, 219);
    content: attr(data-placeholder);
    float: left;
    height: 0;
    pointer-events: none;
  }

  .is-editor-empty:first-child::before {
    color: rgba(209, 213, 219);
    content: attr(data-placeholder);
    float: left;
    height: 0;
    pointer-events: none;
  }

  .hljs-comment,
  .hljs-quote {
    color: #616161;
  }

  .hljs-variable,
  .hljs-template-variable,
  .hljs-attribute,
  .hljs-tag,
  .hljs-name,
  .hljs-regexp,
  .hljs-link,
  .hljs-name,
  .hljs-selector-id,
  .hljs-selector-class {
    color: #f98181;
  }

  .hljs-number,
  .hljs-meta,
  .hljs-built_in,
  .hljs-builtin-name,
  .hljs-literal,
  .hljs-type,
  .hljs-params {
    color: #fbbc88;
  }

  .hljs-string,
  .hljs-symbol,
  .hljs-bullet {
    color: #b9f18d;
  }

  .hljs-title,
  .hljs-section {
    color: #faf594;
  }

  .hljs-keyword,
  .hljs-selector-tag {
    color: #70cff8;
  }

  .hljs-emphasis {
    font-style: italic;
  }

  .hljs-strong {
    font-weight: 700;
  }
`

export default TipTap
