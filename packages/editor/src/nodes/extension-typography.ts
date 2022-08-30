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



/* eslint-disable arrow-body-style */
import { Editor } from '@tiptap/core'
import Typography from '@tiptap/extension-typography'
import { marked } from 'marked'
import { Plugin } from 'prosemirror-state'

function isMarkdown(text: string): boolean {
	// code-ish
	const fences = text.match(/^```/gm)
	if (fences && fences.length > 1) return true

	// link-ish
	if (text.match(/\[[^]+\]\(https?:\/\/\S+\)/gm)) return true
	if (text.match(/\[[^]+\]\(\/\S+\)/gm)) return true

	// heading-ish
	if (text.match(/^#{1,6}\s+\S+/gm)) return true

	// list-ish
	const listItems = text.match(/^[\d-*].?\s\S+/gm)
	if (listItems && listItems.length > 1) return true

	return false
}

const pastePlugin = (editor: Editor) => {
	return new Plugin({
		props: {
			handlePaste(view, event) {
				const text = event.clipboardData?.getData('text/plain')
				if (isMarkdown(text || '')) {
					const md = marked.parse(text || '', {
						gfm: true,
						smartLists: true,
						smartypants: true,
					})
					const { selection } = view.state
					editor.commands.insertContentAt(selection.anchor, md, {
						parseOptions: {
							preserveWhitespace: true,
						},
					})
					return true
				}
				return false
			},
		},
	})
}

export default Typography.extend({
	addProseMirrorPlugins() {
		return [pastePlugin(this.editor)]
	},

	addOptions(this) {
		return {
			...this.parent?.(),
		}
	},

	addGlobalAttributes() {
		return [
			{
				types: [
					'paragraph',
					'blockquote',
					'heading',
					'bulletList',
					'codeBlock',
					'orderedList',
					'image',
					'codeBlock',
					'video',
				],
				attributes: {
					id: {
						default: null,
					},
				},
			},
		]
	},
})
