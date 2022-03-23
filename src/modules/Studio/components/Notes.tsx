/* eslint-disable no-nested-ternary */
import { cx } from '@emotion/css'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Placeholder from '@tiptap/extension-placeholder'
import Text from '@tiptap/extension-text'
import { EditorContent, useEditor } from '@tiptap/react'
import React, { useContext, useEffect, useMemo, useState } from 'react'
import { useRecoilState } from 'recoil'
import { useDebouncedCallback } from 'use-debounce'
import { v4 as uuidv4 } from 'uuid'
import {
  useUpdateFlickMdAndEditorStateMutation,
  useUpdateFragmentEditorStateMutation,
} from '../../../generated/graphql'
import { EditorContext } from '../../Flick/components/EditorProvider'
import editorStyle from '../../Flick/editor/style'
import {
  CodeBlockProps,
  ImageBlockProps,
  IntroBlockProps,
  ListBlockProps,
  OutroBlockProps,
  SimpleAST,
  VideoBlockProps,
} from '../../Flick/editor/utils/utils'
import { studioStore } from '../stores'

const CustomDocument = Document.extend({
  content: 'paragraph*',
})

const Notes = ({ stageHeight }: { stageHeight: number }) => {
  const { editor } = useContext(EditorContext) || {}

  const [localNote, setLocalNote] = useState<string>()
  const [localNoteId, setLocalNoteId] = useState<string>()

  const [{ state, fragment, payload }, setStudio] = useRecoilState(studioStore)
  const [updateFragment] = useUpdateFragmentEditorStateMutation()
  const [updateFlickAndFragmentNotes] = useUpdateFlickMdAndEditorStateMutation()

  const updateFragmentNotes = useDebouncedCallback((value) => {
    updateFragment({
      variables: {
        id: fragment?.id,
        editorState: value,
      },
    })
  }, 500)

  const updateFlickMdAndNotes = useDebouncedCallback((value) => {
    updateFlickAndFragmentNotes({
      variables: {
        flickId: fragment?.flickId,
        fragmentId: fragment?.id,
        editorState: value,
        md: editor?.getHTML() as string,
      },
    })
  }, 500)

  useEffect(() => {
    editor?.commands.setContent(fragment?.flick.md as string)
  }, [])

  const noteEditor = useEditor(
    {
      editable: state === 'ready',
      autofocus: 'end',
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
            editorStyle
          ),
        },
      },
      extensions: [
        CustomDocument,
        Text,
        Paragraph,
        Placeholder.configure({
          placeholder: ({ editor }) => {
            if (editor.getText() === '') {
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
      content:
        localNote === undefined
          ? '<p></p>'
          : localNote
              .split('\n')
              .map((line) => {
                return `<p>${line}</p>`
              })
              .join('') || '<p></p>',
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
                  pos + 1 + node.nodeSize,
                  notes.split('\n').map((line) => {
                    if (line.trim() === '') return line
                    const textNode = editor.view.state.schema.text(line)
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
            editor.view.dispatch(editor.state.tr.insert(pos, blockquote))
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
                noteId: localNoteId,
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
                noteId: localNoteId,
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
                noteId: localNoteId,
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
                noteId: localNoteId,
              },
            }
          }
          return b
        }),
      }
      if (!fragment) return
      setStudio((prev) => ({
        ...prev,
        fragment: {
          ...fragment,
          editorState: { ...newSimpleAST },
          flick: {
            ...fragment.flick,
            md: editor?.getHTML() as string,
          },
        },
      }))
      updateFlickMdAndNotes(newSimpleAST)
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
      setStudio((prev) => ({
        ...prev,
        fragment: {
          ...fragment,
          editorState: { ...newSimpleAST },
        },
      }))
      updateFragmentNotes(newSimpleAST)
    }
  }

  const { note, noteId } = useMemo(() => {
    if (!simpleAST || payload?.activeObjectIndex === undefined) return {}
    const block = simpleAST.blocks[payload?.activeObjectIndex]
    if (block.type === 'introBlock' || block.type === 'outroBlock') {
      setLocalNote(undefined)
      setLocalNoteId(undefined)
    }
    switch (block.type) {
      case 'listBlock': {
        const listBlock = simpleAST.blocks.find(
          (b) => b.id === block.id
        ) as ListBlockProps
        noteEditor?.commands.setContent(
          listBlock.listBlock.note
            ?.split('\n')
            .map((line) => {
              return `<p>${line}</p>`
            })
            .join('') || '<p></p>',
          true
        )
        return {
          note: listBlock.listBlock.note,
          noteId: listBlock.listBlock.noteId,
        }
      }
      case 'imageBlock': {
        const imageBlock = simpleAST.blocks.find(
          (b) => b.id === block.id
        ) as ImageBlockProps
        noteEditor?.commands.setContent(
          imageBlock.imageBlock.note
            ?.split('\n')
            .map((line) => {
              return `<p>${line}</p>`
            })
            .join('') || '<p></p>',
          true
        )
        return {
          note: imageBlock.imageBlock.note,
          noteId: imageBlock.imageBlock.noteId,
        }
      }
      case 'codeBlock': {
        const codeBlock = simpleAST.blocks.find(
          (b) => b.id === block.id
        ) as CodeBlockProps
        noteEditor?.commands.setContent(
          codeBlock.codeBlock.note
            ?.split('\n')
            .map((line) => {
              return `<p>${line}</p>`
            })
            .join('') || '<p></p>',
          true
        )
        return {
          note: codeBlock.codeBlock.note,
          noteId: codeBlock.codeBlock.noteId,
        }
      }
      case 'videoBlock': {
        const videoBlock = simpleAST.blocks.find(
          (b) => b.id === block.id
        ) as VideoBlockProps
        noteEditor?.commands.setContent(
          videoBlock.videoBlock.note
            ?.split('\n')
            .map((line) => {
              return `<p>${line}</p>`
            })
            .join('') || '<p></p>',
          true
        )
        return {
          note: videoBlock.videoBlock.note,
          noteId: videoBlock.videoBlock.noteId,
        }
      }
      case 'introBlock': {
        const introBlock = simpleAST.blocks.find(
          (b) => b.id === block.id
        ) as IntroBlockProps
        noteEditor?.commands.setContent(
          introBlock.introBlock.note
            ?.split('\n')
            .map((line) => {
              return `<p>${line}</p>`
            })
            .join('') || '<p></p>',
          true
        )
        return {
          note: introBlock.introBlock.note,
        }
      }
      case 'outroBlock': {
        const outroBlock = simpleAST.blocks.find(
          (b) => b.id === block.id
        ) as OutroBlockProps
        noteEditor?.commands.setContent(
          outroBlock.outroBlock?.note
            ?.split('\n')
            .map((line) => {
              return `<p>${line}</p>`
            })
            .join('') || '<p></p>',
          true
        )
        return {
          note: outroBlock.outroBlock?.note,
        }
      }
      default:
        return {}
    }
  }, [payload?.activeObjectIndex])

  useEffect(() => {
    if (localNote === undefined) return
    updateNotes(localNoteId || noteId, localNote)
  }, [localNote])

  useEffect(() => {
    return () => {
      noteEditor?.destroy()
    }
  }, [])

  return (
    <div className="col-span-3 w-full" key={payload?.activeObjectIndex}>
      <div
        style={{
          height: `${stageHeight}px`,
        }}
        className="h-full p-1 text-gray-100 rounded-sm outline-none focus:outline-none bg-grey-500"
      >
        <EditorContent editor={noteEditor} />
      </div>
    </div>
  )
}

export default Notes
