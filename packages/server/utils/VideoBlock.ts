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
})
