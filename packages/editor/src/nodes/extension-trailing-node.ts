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

import { Extension } from '@tiptap/core'
import { PluginKey, Plugin } from 'prosemirror-state'

// @ts-ignore
function nodeEqualsType({ types, node }) {
	return (
		(Array.isArray(types) && types.includes(node.type)) || node.type === types
	)
}

/**
 * Extension based on:
 * - https://github.com/ueberdosis/tiptap/blob/v1/packages/tiptap-extensions/src/extensions/TrailingNode.js
 * - https://github.com/remirror/remirror/blob/e0f1bec4a1e8073ce8f5500d62193e52321155b9/packages/prosemirror-trailing-node/src/trailing-node-plugin.ts
 */

export interface TrailingNodeOptions {
	node: string
	notAfter: string[]
}

export default Extension.create<TrailingNodeOptions>({
	name: 'trailingNode',

	addOptions() {
		return {
			node: 'paragraph',
			notAfter: ['paragraph'],
		}
	},

	addProseMirrorPlugins() {
		const plugin = new PluginKey(this.name)
		const disabledNodes = Object.entries(this.editor.schema.nodes)
			.map(([, value]) => value)
			.filter(node => this.options.notAfter.includes(node.name))

		return [
			new Plugin({
				key: plugin,
				appendTransaction: (_, __, state) => {
					const { doc, tr, schema } = state
					const shouldInsertNodeAtEnd = plugin.getState(state)
					const endPosition = doc.content.size
					const type = schema.nodes[this.options.node]

					if (!shouldInsertNodeAtEnd) {
						return
					}

					// eslint-disable-next-line consistent-return
					return tr.insert(endPosition, type.create())
				},
				state: {
					init: (_, state) => {
						const lastNode = state.tr.doc.lastChild

						return !nodeEqualsType({ node: lastNode, types: disabledNodes })
					},
					apply: (tr, value) => {
						if (!tr.docChanged) {
							return value
						}

						const lastNode = tr.doc.lastChild

						return !nodeEqualsType({ node: lastNode, types: disabledNodes })
					},
				},
			}),
		]
	},
})
