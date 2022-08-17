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

import { EditorContent, useIncredibleEditor } from 'editor/src'
import { useEffect, useRef } from 'react'
import { useRecoilValue, useSetRecoilState } from 'recoil'
import {
	astAtom,
	currentBlockIdAtom,
	previewPositionAtom,
} from 'src/stores/flick.store'
import BlockPreview from './BlockPreview'
import EditorHeader from './EditorHeader'

const EditorSection = () => {
	const { editor, dragHandleRef } = useIncredibleEditor()
	const editorContainerRef = useRef<HTMLDivElement>(null)
	const setCurrentBlockId = useSetRecoilState(currentBlockIdAtom)
	const setPreviewPosition = useSetRecoilState(previewPositionAtom)

	const ast = useRecoilValue(astAtom)

	useEffect(() => {
		if (!editor || !editorContainerRef.current || editor.isDestroyed || !ast)
			return

		const { from } = editor.state.selection
		let nodeAtPos = editor.state.doc.nodeAt(from)
		if (nodeAtPos?.isText) {
			nodeAtPos = editor.state.doc.childBefore(from).node
		}
		let nodeAttrs = nodeAtPos?.attrs

		if (!nodeAtPos) {
			const path = (editor.state.selection.$from as any).path[3]
			if (path?.content?.size > 0) {
				nodeAttrs = (editor.state.selection.$from as any).path[3]?.attrs
			}
		}
		const block = ast?.blocks.find(
			b => b.id === nodeAttrs?.id || b.nodeIds?.includes(nodeAttrs?.id)
		)
		if (nodeAttrs && ast && nodeAttrs.id && block) {
			setCurrentBlockId(block.id)
			const editorTop =
				editor?.view.coordsAtPos(editor.state.selection.anchor)?.top ?? 0
			const editorContainerTop =
				editorContainerRef.current?.getBoundingClientRect().top ?? 0
			const previewPosition = editorTop - editorContainerTop - 48 // adjust for padding

			setPreviewPosition(previewPosition)
		} else {
			setCurrentBlockId(null)
		}
	}, [
		ast,
		editor,
		editor?.state.selection.anchor,
		setCurrentBlockId,
		setPreviewPosition,
	])

	useEffect(() => () => {
		if (!dragHandleRef?.current) return
		dragHandleRef.current.style.visibility = 'hidden'
		dragHandleRef.current.style.display = 'hidden'
	})

	return (
		<div
			className='grid grid-cols-12 flex-1 h-full sticky top-0 overflow-y-auto bg-white'
			onScroll={() => {
				const dragHandle = dragHandleRef?.current
				if (dragHandle) {
					dragHandle.style.visibility = 'hidden'
					dragHandle.style.display = 'hidden'
				}
			}}
		>
			<div
				className='h-full w-full max-w-[750px] pt-12 pb-32 col-start-4 col-span-6 mx-auto'
				ref={editorContainerRef}
			>
				<EditorHeader />
				<div
					style={{
						zIndex: 0,
					}}
					ref={dragHandleRef}
					id='drag-handle'
					className='hidden items-center text-gray-300 transition-all duration-75 ease-in-out text-size-lg'
				>
					<div className='cursor-pointer flex-shrink-0 hover:bg-gray-100 hover:text-gray-400 rounded-sm px-1'>
						+
					</div>
					<span
						style={{
							cursor: 'grab',
						}}
						className=' hover:bg-gray-100 hover:text-gray-400 px-1 rounded-sm cursor-move'
					>
						⠿
					</span>
				</div>
				{editor && <EditorContent editor={editor} />}
			</div>
			<div className='col-start-10 col-end-12 relative border-none outline-none w-full mt-10  ml-10'>
				<BlockPreview />
			</div>
		</div>
	)
}

export default EditorSection
