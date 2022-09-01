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

import { JSONContent } from '@tiptap/core'
import {
	CodeBlock,
	ImageBlock,
	ListItemContent,
	RichTextContent,
} from './types'

/* Helper function to extract text content from a node */
const textContent = (contentArray?: JSONContent[]): string | undefined => {
	if (!contentArray) {
		return undefined
	}

	return contentArray
		.map(node => {
			if (node.type === 'text') {
				return node.text
			}
			return ''
		})
		.join('')
}

/* Helper function to get contents of a point */
const getPointContent = (contentArray?: JSONContent[]) => {
	if (!contentArray) return []
	const content: ListItemContent[] = []

	let line = 0

	contentArray.forEach(node => {
		switch (node.type) {
			case 'paragraph': {
				node.content?.forEach(childNode => {
					if (!childNode.text) return
					if (childNode.marks) {
						const marks = childNode.marks.map(mark => mark.type)
						content.push({
							type: 'richText',
							line,
							content: {
								text: childNode.text,
								marks,
							} as RichTextContent,
						})
					} else {
						content.push({ type: 'text', content: childNode.text, line })
					}
				})
				if (node.content && node.content?.length > 0) {
					line += 1
				}
				break
			}
			case 'codeBlock': {
				content.push({
					type: 'code',
					content: {
						code: textContent(node.content),
						language: node.attrs?.language as string,
					} as CodeBlock,
					line,
				})
				line += 1
				break
			}
			case 'image': {
				content.push({
					type: 'image',
					content: {
						url: node.attrs?.src as string,
					} as ImageBlock,
					line,
				})
				line += 1
				break
			}
			default:
				break
		}
	})

	return content
}

/* Get types for interaction blocks */
const getInteractionTypeSpecifics = (type: string): string => {
	switch (type) {
		case 'stackblitz':
			return 'StackBlitz'

		case 'codesandbox':
			return 'CodeSandbox'

		case 'replit':
			return 'Replit'

		default:
			return 'CodeSandbox'
	}
}

/* Helper function to get common props of any block */
interface BlockCount {
	codeBlock: number
	videoBlock: number
	listBlock: number
	imageBlock: number
	headingBlock: number
	interactionBlock: number
}
interface GetCommonBlockProps {
	index: number
	blockCount: BlockCount
	prevCoreBlockPos: number
	editorJSON: JSONContent
}
const getCommonBlockProps = ({
	index,
	blockCount,
	prevCoreBlockPos,
	editorJSON,
}: GetCommonBlockProps) => {
	const nodeIds: string[] = []

	const isFirst = Object.values(blockCount).every(count => count === 0)

	const slice = [
		...(editorJSON.content?.slice(isFirst ? 0 : prevCoreBlockPos, index) || []),
	].reverse()

	const description = slice
		.filter(node => node.type === 'paragraph')
		.reverse()
		.map(p => {
			const node = p.content?.[0]
			if (node && node.type === 'text') {
				nodeIds.push(p.attrs?.id)
				return node.text
			}
			return ''
		})
		.join('\n')

	const titleNode = slice.find(node => node.type === 'heading')
	const title = textContent(titleNode?.content)
	nodeIds.push(titleNode?.attrs?.id)

	let note: string | undefined
	let noteId: string | undefined

	const pushNote = (noteNode: JSONContent | undefined) => {
		note = noteNode?.content
			?.map(node => node.content?.map(childNode => childNode.text).join(''))
			.join('\n')
		nodeIds.push(noteNode?.attrs?.id)
		noteId = noteNode?.attrs?.id
	}

	if (editorJSON.content?.[prevCoreBlockPos]?.type !== 'heading') {
		const noteNode = slice.find(node => node.type === 'blockquote')
		pushNote(noteNode)
	}

	if (editorJSON.content?.[prevCoreBlockPos]?.type === 'heading') {
		const headingNotePos = editorJSON.content
			?.slice(prevCoreBlockPos)
			.findIndex(node => node.type === 'blockquote')
		const noteNode = editorJSON.content
			?.slice(headingNotePos + 1, index)
			.find(node => node.type === 'blockquote')
		pushNote(noteNode)
	}

	if (editorJSON.content?.[index]?.type === 'heading') {
		const nextNodeIndex = editorJSON.content
			.slice(index + 1)
			.findIndex(node =>
				[
					'codeBlock',
					'video',
					'bulletList',
					'orderedList',
					'image',
					'heading',
				].includes(node.type as string)
			)
		const noteNode = editorJSON.content
			.slice(
				index,
				nextNodeIndex !== -1 ? index + nextNodeIndex + 1 : undefined
			)
			.find(node => node.type === 'blockquote')
		pushNote(noteNode)
	}

	return { note, description, title, nodeIds, noteId }
}

export {
	textContent,
	getPointContent,
	getInteractionTypeSpecifics,
	getCommonBlockProps,
}
export type { BlockCount }
