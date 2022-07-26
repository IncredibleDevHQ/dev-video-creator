/* eslint-disable react/jsx-no-constructed-context-values */
/* eslint-disable no-unsafe-optional-chaining */
import { cx } from '@emotion/css'
import { HocuspocusProvider, WebSocketStatus } from '@hocuspocus/provider'
import UniqueID from '@tiptap-pro/extension-unique-id'
import { Editor as CoreEditor } from '@tiptap/core'
import CharacterCount from '@tiptap/extension-character-count'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import Focus from '@tiptap/extension-focus'
import Placeholder from '@tiptap/extension-placeholder'
import {
	Editor,
	EditorContent as EditorContentReact,
	useEditor,
} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import React, {
	createContext,
	useContext,
	useEffect,
	useRef,
	useState,
} from 'react'
import { emitToast } from 'ui/src'
import { useEnv } from 'utils/src'
import * as Y from 'yjs'
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
	editorSaved: boolean | undefined
	providerWebsocketState: WebSocketStatus
}
const EditorContext = createContext<Partial<EC>>({})

const generateLightColorHex = () => {
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
	documentId,
	displayName,
}: {
	children: JSX.Element
	handleUpdate?: (editor: CoreEditor) => void
	documentId: string | undefined
	displayName: string
}): JSX.Element => {
	const { hocuspocus } = useEnv()

	const dragRef = useRef<HTMLDivElement>(null)
	const providerRef = useRef<HocuspocusProvider>()
	const yDocRef = useRef<Y.Doc>()

	const [unsyncedChanges, setUnsyncedChanges] = useState(0)
	const [websocketStatus, setWebsocketStatus] = useState<WebSocketStatus>(
		WebSocketStatus.Disconnected
	)

	const prevDocumentId = useRef<string>()

	useEffect(() => {
		if (
			(providerRef.current || yDocRef.current || !documentId) &&
			documentId === prevDocumentId.current
		)
			return
		providerRef.current?.disconnect()
		const yDoc = new Y.Doc()
		const provider = new HocuspocusProvider({
			document: yDoc,
			url: hocuspocus as string,
			name: `${documentId}`,
			maxAttempts: 10,
			timeout: 10000,
			minDelay: 0,
			maxDelay: 0,
			delay: 0,
			broadcast: false,
			onStatus: ({ status }) => {
				setWebsocketStatus(status)
			},
			forceSyncInterval: 30000,
		})
		providerRef.current = provider
		yDocRef.current = yDoc
		prevDocumentId.current = documentId
	}, [documentId, prevDocumentId])

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
			autofocus: false,
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
					history: false,
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
						if (coreEditor.isDestroyed) return ''

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
			].concat(
				yDocRef.current
					? [
							Collaboration.configure({
								document: yDocRef.current,
							}),
							CollaborationCursor.configure({
								provider: providerRef.current,
								user: {
									name: displayName,
									color: generateLightColorHex(),
								},
							}),
					  ]
					: []
			),
		},
		[dragRef.current, yDocRef.current, displayName]
	)

	useEffect(() => {
		;(async () => {
			let timeout: NodeJS.Timeout | null = null
			if (providerRef.current?.hasUnsyncedChanges) {
				// It takes a fraction of a second to sync, so we wait a bit before setting the no of unsynced changes
				timeout = setTimeout(() => {
					setUnsyncedChanges(providerRef.current?.unsyncedChanges || 0)
				}, 250)
				// await providerRef.current.connect()
			} else {
				// If there are no unsynced changes, we can set the no of unsynced changes to 0 and clear the timeout
				if (timeout) clearTimeout(timeout)
				setUnsyncedChanges(0)
			}
		})()
	}, [
		providerRef?.current?.unsyncedChanges,
		providerRef.current?.hasUnsyncedChanges,
	])

	useEffect(() => {
		const saveHandler = (e: KeyboardEvent) => {
			if (
				e.key === 's' &&
				(navigator.userAgent.match('Mac') ? e.metaKey : e.ctrlKey)
			) {
				e.preventDefault()
				providerRef.current?.connect()
				providerRef.current?.forceSync()
				emitToast('Your changes will be autosaved', {
					type: 'info',
					autoClose: 1500,
				})
			}
		}

		document.addEventListener('keydown', saveHandler, false)

		return () => {
			editor?.destroy()
			providerRef.current?.destroy()
			document.removeEventListener('keydown', saveHandler, false)
		}
	}, [])

	return (
		<EditorContext.Provider
			value={{
				editor,
				dragHandleRef: dragRef,
				editorSaved: unsyncedChanges === 0,
				providerWebsocketState: websocketStatus,
			}}
		>
			{children}
		</EditorContext.Provider>
	)
}

export const EditorContent = EditorContentReact
export const useIncredibleEditor = () => useContext(EditorContext)

export type CoreEditorInstance = CoreEditor

EditorProvider.defaultProps = {
	handleUpdate: undefined,
}
