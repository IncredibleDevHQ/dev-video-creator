/* eslint-disable no-nested-ternary */
import { cx } from '@emotion/css'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Placeholder from '@tiptap/extension-placeholder'
import Text from '@tiptap/extension-text'
import { EditorContent, useEditor } from '@tiptap/react'
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useDebouncedCallback } from 'use-debounce'
import { v4 as uuidv4 } from 'uuid'
import {
  StudioFragmentFragment,
  useUpdateFragmentEditorStateMutation,
  useUpdateNotesAndEditorMutation,
} from '../../generated/graphql'
import { customScroll } from '../Dashboard/Dashboard'
import { EditorContext } from '../Flick/components/EditorProvider'
import { tinyEditorStyle } from '../Flick/editor/style'
import {
  CodeBlockProps,
  HeadingBlockProps,
  ImageBlockProps,
  IntroBlockProps,
  ListBlockProps,
  OutroBlockProps,
  SimpleAST,
  VideoBlockProps,
} from '../Flick/editor/utils/utils'
import { StudioState } from '../Studio/stores'

const CustomDocument = Document.extend({
  content: 'paragraph*',
})

const Notes = ({
  stageHeight,
  fragment,
  state,
  payload,
  setFragment,
}: {
  stageHeight: number
  fragment: StudioFragmentFragment
  state: StudioState
  payload: any
  setFragment: (fragment: StudioFragmentFragment) => void
}) => {
  const initialRender = useRef<boolean>(true)

  const { editor } = useContext(EditorContext) || {}

  const { fragmentId } = useParams<{ fragmentId: string }>()

  const [localNote, setLocalNote] = useState<string>()
  const [localNoteId, setLocalNoteId] = useState<string>()

  const [updateFragment] = useUpdateFragmentEditorStateMutation()
  const [updateFragmentNotesAndEditor] = useUpdateNotesAndEditorMutation()

  const updateFragmentNotes = useDebouncedCallback((value) => {
    updateFragment({
      variables: {
        id: fragmentId,
        editorState: value,
      },
    })
  }, 500)

  const updateFragmentNotesAndEditorDebounced = useDebouncedCallback(
    (value) => {
      updateFragmentNotesAndEditor({
        variables: {
          fragmentId,
          editorState: value.newSimpleAST,
          encodedEditorValue: value.encodedEditorValue,
        },
      })
    },
    500
  )

  const getContent = () => {
    const ev = fragment?.encodedEditorValue
      ? Buffer.from(fragment?.encodedEditorValue as string, 'base64').toString(
          'utf8'
        )
      : ''
    // detect if stored editor value is in html or json format
    if (ev.startsWith('<') || ev === '') {
      return ev
    }
    return JSON.parse(ev)
  }

  useEffect(() => {
    editor?.commands.setContent(getContent())
  }, [])

  const noteEditor = useEditor(
    {
      editable: state === 'ready' || state === 'resumed',
      autofocus: state === 'ready' || state === 'resumed' ? 'end' : 'start',
      onUpdate: ({ editor }) => {
        const notes =
          editor
            .getJSON()
            .content?.map((node) => {
              return node.content
                ?.map((n) => {
                  return n.text
                })
                .join('')
            })
            .join('\n') || ''

        setLocalNote(notes)
      },
      editorProps: {
        attributes: {
          class: cx(
            'prose prose-sm max-w-none w-full h-full border-none focus:outline-none p-2.5',
            tinyEditorStyle
          ),
        },
      },
      extensions: [
        CustomDocument,
        Text,
        Paragraph,
        Placeholder.configure({
          placeholder: ({ editor }) => {
            if (
              editor.getText() === '' &&
              (editor.getJSON()?.content?.length || 0) <= 1
            ) {
              if (state !== 'ready') return 'No notes for this block'
              return 'Add a note...'
            }
            return ''
          },
          showOnlyWhenEditable: false,
          includeChildren: true,
          showOnlyCurrent: false,
          emptyEditorClass: 'is-editor-empty',
        }),
      ],
    },
    [state]
  )

  const simpleAST: SimpleAST | undefined = useMemo(() => {
    return fragment?.editorState
  }, [fragment?.editorState])

  const updateNotes = (nodeId: string | undefined, notes: string) => {
    if (!simpleAST || payload?.activeObjectIndex === undefined || !editor)
      return
    const block = simpleAST.blocks[payload?.activeObjectIndex]

    if (block.type !== 'introBlock' && block.type !== 'outroBlock') {
      let didInsert = false
      if (nodeId)
        editor?.state.tr.doc.descendants((node, pos) => {
          if (node.attrs.id) {
            if (node.attrs.id === nodeId) {
              editor.view.dispatch(
                editor.state.tr.replaceWith(
                  pos + 1,
                  pos + node.nodeSize,
                  notes.split('\n').map((line) => {
                    let lineText = line
                    if (line === '') {
                      lineText = ' '
                    }
                    const textNode = editor.view.state.schema.text(lineText)
                    const paragraphNode =
                      editor.view.state.schema.nodes.paragraph.create(
                        null,
                        textNode
                      )
                    return paragraphNode
                  })
                )
              )
              didInsert = true
            }
          }
        })
      if (!didInsert && notes.trim() !== '') {
        // insert blockquote text before block id
        editor?.state.tr.doc.descendants((node, pos) => {
          if (node.attrs.id === block.id) {
            // console.log('found node with note', node, pos, node.nodeSize)
            const textNode = editor.state.schema.text(notes)
            const paragraphNode = editor.state.schema.nodes.paragraph.create(
              null,
              textNode
            )
            const id = uuidv4()
            setLocalNoteId(id)
            // console.log('inserting paragraph node', id)
            const blockquote = editor.state.schema.nodes.blockquote.create(
              {
                id,
              },
              paragraphNode
            )
            const position =
              block.type === 'headingBlock' ? pos + node.nodeSize : pos
            editor.view.dispatch(editor.state.tr.insert(position, blockquote))
          }
        })
      }
      const newSimpleAST = {
        ...simpleAST,
        blocks: simpleAST.blocks.map((b) => {
          if (b.id === block.id && block.type === 'codeBlock') {
            const codeBlock = b as CodeBlockProps
            return {
              ...b,
              codeBlock: {
                ...codeBlock.codeBlock,
                note: notes,
                noteId: nodeId,
              },
            }
          }
          if (b.id === block.id && block.type === 'imageBlock') {
            const imageBlock = b as ImageBlockProps
            return {
              ...b,
              imageBlock: {
                ...imageBlock.imageBlock,
                note: notes,
                noteId: nodeId,
              },
            }
          }
          if (b.id === block.id && block.type === 'videoBlock') {
            const videoBlock = b as VideoBlockProps
            return {
              ...b,
              videoBlock: {
                ...videoBlock.videoBlock,
                note: notes,
                noteId: nodeId,
              },
            }
          }
          if (b.id === block.id && block.type === 'listBlock') {
            const listBlock = b as ListBlockProps
            return {
              ...b,
              listBlock: {
                ...listBlock.listBlock,
                note: notes,
                noteId: nodeId,
              },
            }
          }
          if (b.id === block.id && block.type === 'headingBlock') {
            const headingBlock = b as HeadingBlockProps
            return {
              ...b,
              headingBlock: {
                ...headingBlock.headingBlock,
                note: notes,
                noteId: nodeId,
              },
            }
          }
          return b
        }),
      }
      if (!fragment || state === 'recording' || state === 'start-recording')
        return

      const encodedEditorValue = Buffer.from(
        JSON.stringify(editor?.getJSON())
      ).toString('base64')
      setFragment({
        ...fragment,
        editorState: { ...newSimpleAST },
        encodedEditorValue,
      })
      updateFragmentNotesAndEditorDebounced({
        newSimpleAST,
        encodedEditorValue,
      })
    } else {
      if (!simpleAST || !fragment) return
      const newSimpleAST = {
        ...simpleAST,
        blocks: simpleAST.blocks.map((b) => {
          if (b.id === block.id && block.type === 'introBlock') {
            const introBlock = b as IntroBlockProps
            return {
              ...b,
              introBlock: {
                ...introBlock.introBlock,
                note: notes,
              },
            }
          }
          if (b.id === block.id && block.type === 'outroBlock') {
            const outroBlock = b as OutroBlockProps
            return {
              ...outroBlock,
              outroBlock: {
                ...outroBlock.outroBlock,
                note: notes,
              },
            }
          }
          return b
        }),
      }
      if (state === 'recording' || state === 'start-recording') return
      setFragment({
        ...fragment,
        editorState: { ...newSimpleAST },
      })
      updateFragmentNotes(newSimpleAST)
    }
  }

  const { note, noteId } = useMemo(() => {
    initialRender.current = true
    if (!simpleAST || payload?.activeObjectIndex === undefined) return {}
    const block = simpleAST.blocks.filter(
      (b: any) => b.type !== 'interactionBlock'
    )[payload?.activeObjectIndex]
    setLocalNote(undefined)
    setLocalNoteId(undefined)
    switch (block?.type) {
      case 'listBlock': {
        const listBlock = simpleAST.blocks.find(
          (b) => b.id === block.id
        ) as ListBlockProps
        return {
          note: listBlock.listBlock.note,
          noteId: listBlock.listBlock.noteId,
        }
      }
      case 'imageBlock': {
        const imageBlock = simpleAST.blocks.find(
          (b) => b.id === block.id
        ) as ImageBlockProps
        return {
          note: imageBlock.imageBlock.note,
          noteId: imageBlock.imageBlock.noteId,
        }
      }
      case 'codeBlock': {
        const codeBlock = simpleAST.blocks.find(
          (b) => b.id === block.id
        ) as CodeBlockProps
        return {
          note: codeBlock.codeBlock.note,
          noteId: codeBlock.codeBlock.noteId,
        }
      }
      case 'videoBlock': {
        const videoBlock = simpleAST.blocks.find(
          (b) => b.id === block.id
        ) as VideoBlockProps
        return {
          note: videoBlock.videoBlock.note,
          noteId: videoBlock.videoBlock.noteId,
        }
      }
      case 'headingBlock': {
        const headingBlock = simpleAST.blocks.find(
          (b) => b.id === block.id
        ) as HeadingBlockProps
        return {
          note: headingBlock.headingBlock.note,
          noteId: headingBlock.headingBlock.noteId,
        }
      }
      case 'introBlock': {
        const introBlock = simpleAST.blocks.find(
          (b) => b.id === block.id
        ) as IntroBlockProps
        return {
          note: introBlock.introBlock.note,
        }
      }
      case 'outroBlock': {
        const outroBlock = simpleAST.blocks.find(
          (b) => b.id === block.id
        ) as OutroBlockProps
        return {
          note: outroBlock.outroBlock?.note,
        }
      }
      default:
        return {}
    }
  }, [payload?.activeObjectIndex, state])

  useEffect(() => {
    if (!noteEditor || noteEditor?.isDestroyed) return
    noteEditor?.commands?.setContent(
      note
        ?.split('\n')
        ?.map((line) => {
          return `<p>${line}</p>`
        })
        ?.join('') || '<p></p>',
      true
    )
  }, [note, noteEditor])

  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false
      return
    }
    if (localNote === undefined) return
    updateNotes(localNoteId || noteId, localNote)
  }, [localNote])

  useEffect(() => {
    return () => {
      noteEditor?.destroy()
    }
  }, [])

  return (
    <div className="col-span-3 w-full">
      <div
        style={{
          height: `${stageHeight}px`,
        }}
        className={cx(
          'h-full p-1 text-gray-100 rounded-sm outline-none focus:outline-none bg-grey-500 overflow-y-scroll',
          customScroll
        )}
      >
        <EditorContent editor={noteEditor} />
      </div>
    </div>
  )
}

export default Notes
