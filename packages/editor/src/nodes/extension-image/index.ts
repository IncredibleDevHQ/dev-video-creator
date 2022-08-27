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



import { Node, nodeInputRule } from '@tiptap/core'
import { mergeAttributes, ReactNodeViewRenderer } from '@tiptap/react'
import { uploadImagePlugin } from './upload-image-plugin'
import { Image } from './Image'

interface ImageOptions {
	inline: boolean
	HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
	interface Commands<ReturnType> {
		image: {
			/**
			 * Add an image
			 */
			setImage: (options: {
				src: string
				alt?: string
				title?: string
			}) => ReturnType
		}
	}
}

const IMAGE_INPUT_REGEX = /!\[(.+|:?)\]\((\S+)(?:(?:\s+)["'](\S+)["'])?\)/

export default Node.create<ImageOptions>({
	name: 'image',

	isolating: true,

	addOptions() {
		return {
			...this.parent?.(),
			inline: false,
			HTMLAttributes: {},
		}
	},

	inline() {
		return this.options.inline
	},

	group() {
		return this.options.inline ? 'inline' : 'block'
	},

	addAttributes() {
		return {
			src: {
				default: null,
			},
			alt: {
				default: null,
			},
			title: {
				default: null,
			},
			caption: {
				default: null,
			},
		}
	},
	parseHTML: () => [
		{
			tag: 'img[src]',
			getAttrs: dom => {
				if (typeof dom === 'string') return {}
				const element = dom as HTMLImageElement

				const obj = {
					src: element.getAttribute('src'),
					title: element.getAttribute('title'),
					alt: element.getAttribute('alt'),
				}
				return obj
			},
		},
	],
	renderHTML: ({ HTMLAttributes }) => ['img', mergeAttributes(HTMLAttributes)],

	addNodeView() {
		return ReactNodeViewRenderer(Image)
	},

	addCommands() {
		return {
			setImage:
				attrs =>
				({ state, dispatch }) => {
					const { selection } = state
					const position = selection.$head
						? selection.$head.pos
						: selection.$to.pos

					const node = this.type.create(attrs)
					const transaction = state.tr.insert(position - 1, node)
					return dispatch?.(transaction)
				},
		}
	},
	addInputRules() {
		return [
			nodeInputRule({
				find: IMAGE_INPUT_REGEX,
				type: this.type,
				getAttributes: match => {
					const [, alt, src, title] = match
					return {
						src,
						alt,
						title,
					}
				},
			}),
		]
	},
	addProseMirrorPlugins() {
		return [uploadImagePlugin()]
	},
})
