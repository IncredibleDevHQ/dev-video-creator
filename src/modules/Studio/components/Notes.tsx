/* eslint-disable no-nested-ternary */
import { cx } from '@emotion/css'
import { WebSocketStatus } from '@hocuspocus/provider'
import React, { useContext, useMemo, useState } from 'react'
import { useRecoilState } from 'recoil'
import { useDebouncedCallback } from 'use-debounce'
import { v4 as uuidv4 } from 'uuid'
import { useUpdateFragmentEditorStateMutation } from '../../../generated/graphql'
import {
  CodeBlockProps,
  ImageBlockProps,
  IntroBlockProps,
  ListBlockProps,
  OutroBlockProps,
  SimpleAST,
  VideoBlockProps,
} from '../../Flick/editor/utils/utils'
import { EditorContext } from '../../Flick/Flick'
import { studioStore } from '../stores'

const Notes = ({ stageHeight }: { stageHeight: number }) => {
  const { editor, providerStatus } = useContext(EditorContext) || {}

  const [localNote, setLocalNote] = useState<string>()
  const [localNoteId, setLocalNoteId] = useState<string>()

  const [{ state, fragment, payload }, setStudio] = useRecoilState(studioStore)
  const [updateFragment] = useUpdateFragmentEditorStateMutation()

  const updateFragmentNotes = useDebouncedCallback((value) => {
    updateFragment({
      variables: {
        id: fragment?.id,
        editorState: value,
      },
    })
  }, 500)

  const updateNotes = (nodeId: string | undefined, notes: string) => {
    const simpleAST: SimpleAST | undefined = fragment?.editorState
    if (!simpleAST || payload?.activeObjectIndex === undefined || !editor)
      return
    const block = simpleAST.blocks[payload?.activeObjectIndex]

    if (block.type !== 'introBlock' && block.type !== 'outroBlock') {
      let didInsert = false
      editor?.state.tr.doc.descendants((node, pos) => {
        if (node.attrs.id) {
          if (node.attrs.id === nodeId) {
            // console.log('found node with note', node, pos, node.nodeSize)
            node.descendants((childNode, childPos) => {
              // check for text node
              if (childNode.type.name === 'text') {
                // console.log(
                //   'found text node',
                //   childNode,
                //   childPos,
                //   childNode.nodeSize
                // )
                editor.view.dispatch(
                  editor.state.tr.insertText(
                    notes,
                    pos + 1,
                    pos + 2 + childNode.nodeSize
                  )
                )
                didInsert = true
              }
            })
          }
        }
      })
      if (!didInsert) {
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
      if (payload?.activeIntroIndex === 0)
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
    const simpleAST: SimpleAST | undefined = fragment?.editorState
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
  }, [payload?.activeObjectIndex, fragment?.editorState])

  return (
    <div className="col-span-3 w-full" key={payload?.activeObjectIndex}>
      <div
        style={{
          height: `${stageHeight}px`,
        }}
        className="h-full p-4 text-gray-100 rounded-sm outline-none focus:outline-none bg-grey-500"
      >
        {editor && providerStatus === WebSocketStatus.Connected ? (
          state === 'ready' ? (
            <textarea
              placeholder="Add your notes here"
              className="bg-grey-500 p-0 w-full h-full focus:border-transparent focus:outline-none font-body text-left resize-none outline-none border-none placeholder-gray-400"
              value={localNote === undefined ? note : localNote}
              onChange={(e) => {
                setLocalNote(e.target.value)
                updateNotes(localNoteId || noteId, e.target.value)
              }}
            />
          ) : (
            <span
              className={cx('whitespace-pre-line', {
                'italic font-body': !note,
              })}
            >
              {note || 'No notes'}
            </span>
          )
        ) : null}
      </div>
    </div>
  )
}

export default Notes
