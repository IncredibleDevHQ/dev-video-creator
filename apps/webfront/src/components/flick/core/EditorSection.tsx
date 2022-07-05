import { EditorContent, useIncredibleEditor } from 'editor/src'

const EditorSection = () => {
	const { editor, dragHandleRef } = useIncredibleEditor()

	return (
		<div className='flex justify-center pt-12'>
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
			<div className='w-6/12'>
				{editor && <EditorContent editor={editor} />}
			</div>
		</div>
	)
}

export default EditorSection
