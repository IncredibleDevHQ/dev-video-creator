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
