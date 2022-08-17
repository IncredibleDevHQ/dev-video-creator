// Copyright (c) 2022 Pixelbyte Studio Pvt Ltd
//
// This file is part of Incredible, Pixelbyte Studio Pvt Ltd
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program\.  If not, see <http://www\.gnu\.org/licenses/>\.

/* eslint-disable react-hooks/exhaustive-deps */
import { cx } from '@emotion/css'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Placeholder from '@tiptap/extension-placeholder'
import { Text as TextNode } from '@tiptap/extension-text'
import { useEditor } from '@tiptap/react'
import { EditorContent, useIncredibleEditor } from 'editor/src'
import editorStyle from 'editor/src/styles/editorStyle'
import { Block } from 'editor/src/utils/types'
import { useEffect, useMemo, useState } from 'react'
import { useRecoilState } from 'recoil'
import { astAtom } from 'src/stores/flick.store'
import { v4 as uuidv4 } from 'uuid'

const CustomDocument = Document.extend({
	content: 'paragraph*',
})
const Note = ({ block }: { block: Block }) => {
	const { editor } = useIncredibleEditor()

	const [simpleAST, setSimpleAST] = useRecoilState(astAtom)

	const [localNote, setLocalNote] = useState<string>()
	const [localNoteId, setLocalNoteId] = useState<string>()

	const { note, noteId } = useMemo(() => {
		if (block.type === 'introBlock' || block.type === 'outroBlock') {
			setLocalNote(undefined)
			setLocalNoteId(undefined)
		}
		return {
			note: block.note,
			noteId: block.noteId,
		}
	}, [block])

	const updateNotes = (nodeId: string | undefined, notes: string) => {
		if (!editor) return
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
									notes.split('\n').map(line => {
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
						const position =
							block.type === 'headingBlock' ? pos + node.nodeSize : pos
						editor.view.dispatch(editor.state.tr.insert(position, blockquote))
					}
				})
			}
		} else {
			if (!simpleAST) return
			setSimpleAST?.({
				...simpleAST,
				blocks: simpleAST.blocks.map(b => {
					if (b.id === block.id && block.type === 'introBlock') {
						return {
							...b,
							note: notes,
						}
					}
					if (b.id === block.id && block.type === 'outroBlock') {
						return {
							...b,
							note: notes,
						}
					}
					return b
				}),
			})
		}
	}

	useEffect(() => {
		if (localNote === undefined) return
		updateNotes(localNoteId || noteId, localNote)
	}, [localNote])

	const noteEditor = useEditor({
		autofocus: 'end',
		onUpdate: ({ editor: coreEditor }) => {
			const notes =
				coreEditor
					.getJSON()
					.content?.map(contentNode =>
						contentNode.content?.map(n => n.text).join('')
					)
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
			TextNode,
			Paragraph,
			Placeholder.configure({
				placeholder: ({ editor: coreEditor }) => {
					if (
						coreEditor.getText() === '' &&
						(coreEditor.getJSON()?.content?.length || 0) <= 1
					) {
						return 'Add a note...'
					}
					return ''
				},
				showOnlyWhenEditable: true,
				includeChildren: true,
				showOnlyCurrent: false,
				emptyEditorClass: 'is-editor-empty',
			}),
		],
		content:
			localNote === undefined
				? note
						?.split('\n')
						.map(line => `<p>${line}</p>`)
						.join('') || '<p></p>'
				: localNote
						.split('\n')
						.map(line => `<p>${line}</p>`)
						.join('') || '<p></p>',
	})

	useEffect(
		() => () => {
			noteEditor?.destroy()
		},
		[]
	)

	return <EditorContent editor={noteEditor} />
}

export default Note
