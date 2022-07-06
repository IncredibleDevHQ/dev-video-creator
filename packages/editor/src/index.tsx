/* eslint-disable no-unsafe-optional-chaining */
import { cx } from '@emotion/css'
import UniqueID from '@tiptap-pro/extension-unique-id'
import { Editor as CoreEditor } from '@tiptap/core'
import CharacterCount from '@tiptap/extension-character-count'
import Focus from '@tiptap/extension-focus'
import Placeholder from '@tiptap/extension-placeholder'
import {
	Editor,
	EditorContent as EditorContentReact,
	useEditor,
} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import React, { createContext, useContext, useMemo, useRef } from 'react'
import CodeBlock from './nodes/extension-code'
import Drag from './nodes/extension-drag'
import ImageBlock from './nodes/extension-image'
import InteractionBlock from './nodes/extension-interaction'
import SlashCommands from './nodes/extension-slash-command'
import { getSuggestionItems } from './nodes/extension-slash-command/items'
import renderItems from './nodes/extension-slash-command/renderItems'
import TrailingNode from './nodes/extension-trailing-node'
import Typography from './nodes/extension-typography'
import VideoBlock from './nodes/extension-video'
import editorStyle from './styles/editorStyle'

type EC = {
	editor: Editor | null
	dragHandleRef: React.RefObject<HTMLDivElement>
}
const EditorContext = createContext<Partial<EC>>({})

export const EditorContent = EditorContentReact

export function generateLightColorHex() {
	let color = '#'
	for (let i = 0; i < 3; i += 1)
		color += `0${Math.floor(((1 + Math.random()) * 16 ** 2) / 2).toString(
			16
		)}`.slice(-2)
	return color
}

export const EditorProvider = ({
	children,
	handleUpdate,
}: {
	children: JSX.Element
	handleUpdate?: (editor: CoreEditor) => void
}): JSX.Element => {
	const dragRef = useRef<HTMLDivElement>(null)

	const editor = useEditor(
		{
			onUpdate: ({ editor: coreEditor }) => {
				handleUpdate?.(coreEditor)
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
						'interaction',
					],
				}),
				Drag(dragRef.current),
				Focus,
				Typography,
				StarterKit.configure({
					codeBlock: false,
					// history: false,
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
					placeholder: ({ node, editor: coreEditor }) => {
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
							coreEditor.getJSON().content?.length === 1
						) {
							return 'Type / to get started'
						}

						if (node.type.name === 'paragraph') {
							const selectedNode = coreEditor.view.domAtPos(
								coreEditor.state.selection.from
							).node
							if (
								selectedNode.nodeName === 'P' &&
								selectedNode.firstChild?.parentElement?.id === node.attrs.id
							) {
								const parentNode = (coreEditor.state.selection.$from as any)
									.path[3]
								if (
									parentNode?.type?.name === 'blockquote' &&
									parentNode?.content?.content?.[
										parentNode?.content?.content?.length - 1
									]?.attrs?.id === node.attrs?.id
								) {
									return 'Type or hit enter to exit quote'
								}
								return 'Type / for commands'
							}
						}

						return ''
					},
				}),
				CharacterCount.configure({
					limit: 20000,
				}),
				TrailingNode,
				CodeBlock,
				VideoBlock,
				ImageBlock,
				InteractionBlock,
			],
		},
		[dragRef.current]
	)

	const value: EC = useMemo(
		() => ({
			editor,
			dragHandleRef: dragRef,
		}),
		[editor, dragRef]
	)

	return (
		<EditorContext.Provider value={value}>{children}</EditorContext.Provider>
	)
}

export const useIncredibleEditor = () => useContext(EditorContext)

EditorProvider.defaultProps = {
	handleUpdate: undefined,
}
