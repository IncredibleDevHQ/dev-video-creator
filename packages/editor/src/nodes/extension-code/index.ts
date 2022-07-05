import { Editor } from '@tiptap/core'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { ReactNodeViewRenderer } from '@tiptap/react'
import lowlight from 'lowlight'
import CodeBlockComponent from './CodeBlock'

export const checkCurrentNode = (editor: Editor, nodeName: string) =>
	editor.state.doc.childBefore(editor.state.selection.from).node?.type.name ===
	nodeName

export default CodeBlockLowlight.extend({
	addNodeView() {
		return ReactNodeViewRenderer(CodeBlockComponent)
	},

	addKeyboardShortcuts() {
		return {
			Tab: () => {
				if (checkCurrentNode(this.editor, this.name)) {
					return this.editor.commands.insertContent('  ')
				}
				return false
			},
		}
	},
}).configure({ lowlight, defaultLanguage: 'typescript' })
