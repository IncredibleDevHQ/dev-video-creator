import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { VideoBlock } from './VideoBlock'

export default Node.create({
	name: 'video',

	group: 'block',

	content: 'block*',

	atom: true,

	isolating: true,

	parseHTML() {
		return [
			{
				tag: 'video',
			},
		]
	},

	addAttributes() {
		return {
			src: {
				default: null,
			},
			associatedBlockId: {
				default: null,
			},
			'data-transformations': {
				default: null,
			},
			caption: {
				default: null,
			},
			type: {
				default: 'video', // video, screengrab
			},
		}
	},

	renderHTML({ HTMLAttributes }) {
		return ['video', mergeAttributes(HTMLAttributes), 0]
	},

	addNodeView() {
		return ReactNodeViewRenderer(VideoBlock)
	},
})
