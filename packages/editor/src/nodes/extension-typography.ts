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
