import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { InteractionBlock } from './InteractionBlock'

export default Node.create({
	name: 'interaction',

	group: 'block',

	atom: true,

	isolating: true,

	content: 'block*',

	addAttributes() {
		return {
			src: {
				default: null,
			},
			type: {
				default: null,
			},
		}
	},

	parseHTML() {
		return [
			{
				tag: 'interaction',
			},
		]
	},

	renderHTML({ HTMLAttributes }) {
		return ['interaction', mergeAttributes(HTMLAttributes), 0]
	},

	addNodeView() {
		return ReactNodeViewRenderer(InteractionBlock, {})
	},
})
