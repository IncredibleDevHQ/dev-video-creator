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

import { JSONContent } from '@tiptap/core'
import {
	BlockCount,
	getCommonBlockProps,
	getInteractionTypeSpecifics,
	getPointContent,
	textContent,
} from './helpers'
import { Block, ListItem, SimpleAST } from './types'

/*
	Converts the json from the editor to
	customAST and viewConfiguration needed by the Canvas
*/
const parser = async ({
	editorJSON,
}: {
	editorJSON: JSONContent
}): Promise<{
	ast: SimpleAST
}> => {
	const blocks: Block[] = []

	const blockCount: BlockCount = {
		codeBlock: 0,
		videoBlock: 0,
		listBlock: 0,
		imageBlock: 0,
		headingBlock: 0,
		interactionBlock: 0,
	}

	let prevCoreBlockPos = -1
	let blockPosition = 1

	const parseHeadingBlock = (index: number, editorNode: JSONContent) => {
		const nextHeadingIndex = editorJSON.content?.findIndex(
			(node, i) => i > index && node.type === 'heading'
		)
		const nextBlockIndex = editorJSON.content?.findIndex(
			(node, i) =>
				i > index &&
				(node.type === 'codeBlock' ||
					node.type === 'video' ||
					node.type === 'bulletList' ||
					node.type === 'orderedList' ||
					node.type === 'image' ||
					node.type === 'interaction')
		)

		const pushBlock = () => {
			const { description, note, noteId, nodeIds } = getCommonBlockProps({
				index,
				blockCount,
				editorJSON,
				prevCoreBlockPos,
			})
			blocks.push({
				type: 'headingBlock',
				id: editorNode.attrs?.id,
				pos: blockPosition,
				nodeIds: [editorNode.attrs?.id, ...nodeIds],
				title: textContent(editorNode.content),
				description,
				note,
				noteId,
			})
			blockCount.headingBlock += 1
			prevCoreBlockPos = index
			blockPosition += 1
		}
		if (
			nextBlockIndex &&
			nextHeadingIndex &&
			nextBlockIndex > nextHeadingIndex &&
			nextBlockIndex >= 0 &&
			nextHeadingIndex >= 0
		) {
			pushBlock()
		} else if (
			nextHeadingIndex &&
			(nextBlockIndex === undefined || nextBlockIndex < 0)
		) {
			pushBlock()
		} else if (
			(nextHeadingIndex === undefined || nextHeadingIndex < 0) &&
			(nextBlockIndex === undefined || nextBlockIndex < 0)
		) {
			pushBlock()
		}
	}

	const parseCodeBlock = (index: number, editorNode: JSONContent) => {
		const codeValue = textContent(editorNode?.content)
		const encodedCodeValue = codeValue
			? Buffer.from(codeValue).toString('base64')
			: undefined

		const { description, note, title, nodeIds, noteId } = getCommonBlockProps({
			index,
			blockCount,
			editorJSON,
			prevCoreBlockPos,
		})

		blocks.push({
			type: 'codeBlock',
			id: editorNode.attrs?.id as string,
			pos: blockPosition,
			nodeIds,
			note,
			noteId,
			description,
			title,
			fallbackTitle: title || `Code ${blockCount.codeBlock + 1}`,
			codeBlock: {
				code: encodedCodeValue,
				language: editorNode?.attrs?.language as string,
			},
		})

		blockCount.codeBlock += 1
		prevCoreBlockPos = index
		blockPosition += 1
	}

	const parseVideoBlock = (index: number, editorNode: JSONContent) => {
		const { description, note, title, nodeIds, noteId } = getCommonBlockProps({
			index,
			blockCount,
			editorJSON,
			prevCoreBlockPos,
		})

		blocks.push({
			type: 'videoBlock',
			id: editorNode.attrs?.id as string,
			pos: blockPosition,
			nodeIds,
			description,
			title,
			fallbackTitle: title || `Video ${blockCount.videoBlock + 1}`,
			note,
			noteId,
			videoBlock: {
				url: editorNode?.attrs?.src as string,
				caption: editorNode.attrs?.caption,
				transformations: editorNode?.attrs?.['data-transformations']
					? JSON.parse(editorNode?.attrs?.['data-transformations'])
					: undefined,
			},
		})

		blockCount.videoBlock += 1
		prevCoreBlockPos = index
		blockPosition += 1
	}

	const parseImageBlock = (index: number, editorNode: JSONContent) => {
		const url = editorNode?.attrs?.src
		const type = url.endsWith('.gif') ? 'gif' : 'image'

		const { description, note, title, nodeIds, noteId } = getCommonBlockProps({
			index,
			blockCount,
			editorJSON,
			prevCoreBlockPos,
		})
		blocks.push({
			type: 'imageBlock',
			id: editorNode.attrs?.id as string,
			pos: blockPosition,
			nodeIds,
			description,
			title,
			fallbackTitle: title || `Image ${blockCount.imageBlock + 1}`,
			note,
			noteId,
			imageBlock: {
				url: url as string,
				type,
				caption: editorNode.attrs?.caption,
			},
		})

		blockCount.imageBlock += 1
		prevCoreBlockPos = index
		blockPosition += 1
	}

	const parseListBlock = (index: number, editorNode: JSONContent) => {
		const { description, note, title, nodeIds, noteId } = getCommonBlockProps({
			index,
			blockCount,
			editorJSON,
			prevCoreBlockPos,
		})

		const listItems = editorNode.content?.filter(
			child => child.type === 'listItem'
		)

		const simpleListItems: ListItem[] = []

		const simplifyListItem = (listItem: JSONContent, lvl: number) => {
			const item: ListItem = {}

			item.content = getPointContent(listItem.content)
			item.level = lvl
			simpleListItems.push(item)

			listItem.content?.forEach(node => {
				if (node.type === 'bulletList' || node.type === 'orderedList') {
					node.content?.map(li => simplifyListItem(li, lvl + 1))
				}
			})
		}

		if (listItems) listItems?.map(listItem => simplifyListItem(listItem, 1))

		blocks.push({
			type: 'listBlock',
			id: editorNode.attrs?.id as string,
			pos: blockPosition,
			nodeIds,
			description,
			title,
			fallbackTitle: title || `List ${blockCount.listBlock + 1}`,
			note,
			noteId,
			listBlock: {
				list: simpleListItems,
			},
		})

		blockCount.listBlock += 1
		prevCoreBlockPos = index
		blockPosition += 1
	}

	const parseInteractionBlock = (index: number, editorNode: JSONContent) => {
		const url = editorNode.attrs?.src

		const { description, note, title, nodeIds, noteId } = getCommonBlockProps({
			index,
			blockCount,
			editorJSON,
			prevCoreBlockPos,
		})

		blocks.push({
			type: 'interactionBlock',
			id: editorNode.attrs?.id as string,
			pos: blockPosition,
			nodeIds,
			description,
			title,
			note,
			noteId,
			fallbackTitle:
				title || getInteractionTypeSpecifics(editorNode.attrs?.type),
			interactionBlock: {
				url: url as string,
				interactionType: editorNode.attrs?.type as string,
			},
		})

		blockCount.interactionBlock += 1
		prevCoreBlockPos = index
		blockPosition += 1
	}

	/* iterate over the json and parse core nodes as blocks */
	editorJSON?.content?.forEach((editorNode, index) => {
		if (editorNode.type === 'heading') {
			parseHeadingBlock(index, editorNode)
		} else if (editorNode.type === 'codeBlock') {
			parseCodeBlock(index, editorNode)
		} else if (editorNode.type === 'video') {
			parseVideoBlock(index, editorNode)
		} else if (editorNode.type === 'image') {
			parseImageBlock(index, editorNode)
		} else if (
			editorNode.type === 'bulletList' ||
			editorNode.type === 'orderedList'
		) {
			parseListBlock(index, editorNode)
		} else if (editorNode.type === 'interaction') {
			parseInteractionBlock(index, editorNode)
		}
	})

	return {
		ast: { blocks },
	}
}

export default parser
