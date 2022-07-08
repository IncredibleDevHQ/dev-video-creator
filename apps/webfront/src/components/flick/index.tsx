import { LiveMap } from '@liveblocks/client'
import { CoreEditorInstance, EditorProvider } from 'editor/src'
import parser from 'editor/src/utils/parser'
import { Block } from 'editor/src/utils/types'
import { useEffect, useMemo } from 'react'
import { useRecoilCallback, useRecoilValue, useSetRecoilState } from 'recoil'
import { FlickFragment } from 'src/graphql/generated'
import {
	activeFragmentIdAtom,
	astAtom,
	flickNameAtom,
	View,
	viewAtom,
} from 'src/stores/flick.store'
import {
	Presence,
	PresencePage,
	RoomProvider,
} from 'src/utils/liveblocks.config'
import { useUser } from 'src/utils/providers/auth'
import EditorSection from './core/EditorSection'
import Navbar from './core/Navbar'
import SubHeader from './core/SubHeader'
import ViewConfigUpdater from './core/ViewConfigUpdater'
import Preview from './preview/Preview'
import Timeline from './preview/Timeline'

const FlickBody = ({
	flick,
	initialFragmentId,
}: {
	flick: FlickFragment
	initialFragmentId: string | null
}) => {
	const setStoresInitially = useRecoilCallback(
		({ set }) =>
			() => {
				const ast = flick.fragments.find(
					fragment => fragment.id === initialFragmentId
				)?.editorState

				set(flickNameAtom, flick.name)
				set(activeFragmentIdAtom, initialFragmentId)
				set(astAtom, ast ?? null)
			},
		[]
	)

	useEffect(() => {
		setStoresInitially()
	}, [setStoresInitially])

	const { user } = useUser()
	const activeFragmentId = useRecoilValue(activeFragmentIdAtom)
	const view = useRecoilValue(viewAtom)

	const initialPresence: Presence = useMemo(
		() => ({
			user: {
				id: user?.uid as string,
				name: user?.displayName as string,
				picture: user?.picture as string,
			},
			page: PresencePage.Notebook,
			cursor: { x: 0, y: 0 },
			inHuddle: false,
		}),
		[user?.uid, user?.displayName, user?.picture]
	)

	const setAST = useSetRecoilState(astAtom)
	const handleEditorChange = (editor: CoreEditorInstance) => {
		parser({ editorJSON: editor.getJSON() }).then(({ ast }) => {
			if (ast)
				setAST(prev => ({
					...ast,
					blocks: [
						// eslint-disable-next-line no-nested-ternary
						...(prev?.blocks
							? prev?.blocks[0]?.type === 'introBlock'
								? [prev.blocks[0]]
								: []
							: []),
						...ast.blocks,
						// eslint-disable-next-line no-nested-ternary
						...(prev?.blocks
							? // eslint-disable-next-line no-unsafe-optional-chaining
							  prev?.blocks?.[prev?.blocks.length - 1]?.type === 'outroBlock'
								? [
										{
											...prev.blocks[prev.blocks.length - 1],
											pos: ast.blocks.length + 1,
										} as Block,
								  ]
								: []
							: []),
					],
				}))
			if (!editor || editor.isDestroyed) return
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
		})
	}

	if (!activeFragmentId) return null

	return (
		<RoomProvider
			id={`story-${flick.id}`}
			initialPresence={initialPresence}
			initialStorage={() => ({
				viewConfig: new LiveMap(),
			})}
		>
			<EditorProvider
				handleUpdate={handleEditorChange}
				displayName={user?.displayName || 'Anonymous'}
				documentId={activeFragmentId as string}
			>
				<div className='flex flex-col h-screen overflow-hidden'>
					<Navbar />
					<SubHeader />
					{view === View.Notebook ? <EditorSection /> : <Preview />}
					<Timeline persistentTimeline={false} shouldScrollToCurrentBlock />
					<ViewConfigUpdater />
				</div>
			</EditorProvider>
		</RoomProvider>
	)
}

export default FlickBody
