// Copyright 2022 Pixelbyte Studio Pvt Ltd
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

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
