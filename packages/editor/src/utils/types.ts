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

/* Every Block */
export interface RichTextContent {
	text: string
	marks: string[]
}

export interface CommonBlockProps {
	id: string
	pos: number
	nodeIds?: string[]
	title?: string
	fallbackTitle?: string
	note?: string
	noteId?: string
	description?: string
}

/* Code Block */
export interface CodeBlock {
	code?: string
	colorCodes?: JSON
	language?: string
}
export interface CodeBlockProps extends CommonBlockProps {
	type: 'codeBlock'
	codeBlock: CodeBlock
}

/* Video Block */
type Coordinates = {
	x: number
	y: number
	width: number
	height: number
}
interface Clip {
	start?: number
	end?: number
	change?: 'start' | 'end'
}
export interface Transformations {
	crop?: Coordinates
	clip?: Clip
}
export interface VideoBlock {
	url?: string
	caption?: string
	transformations?: Transformations
}
export interface VideoBlockProps extends CommonBlockProps {
	type: 'videoBlock'
	videoBlock: VideoBlock
}

/* Image Block */
export interface ImageBlock {
	url?: string
	caption?: string
	type?: 'image' | 'gif'
}
export interface ImageBlockProps extends CommonBlockProps {
	type: 'imageBlock'
	imageBlock: ImageBlock
}

/* List Block */
export interface ListItemContent {
	type: 'code' | 'image' | 'richText' | 'text'
	content: CodeBlock | ImageBlock | RichTextContent | string
	line: number
}
export interface ListItem {
	content?: ListItemContent[]
	items?: ListItem[]
	level?: number
	text?: string
}
export interface ListBlock {
	list?: ListItem[]
}
export interface ListBlockProps extends CommonBlockProps {
	type: 'listBlock'
	listBlock: ListBlock
}

/* Heading Block */
export interface HeadingBlockProps extends CommonBlockProps {
	type: 'headingBlock'
}

/* Interaction Block */
export interface InteractionBlock {
	url?: string
	interactionType?: string
}
export interface InteractionBlockProps extends CommonBlockProps {
	type: 'interactionBlock'
	interactionBlock: InteractionBlock
}

/* Intro Block */
export interface IntroBlockProps extends CommonBlockProps {
	type: 'introBlock'
}

/* Outro Block */
export interface OutroBlockProps extends CommonBlockProps {
	type: 'outroBlock'
}

export type Block =
	| CodeBlockProps
	| VideoBlockProps
	| ListBlockProps
	| ImageBlockProps
	| HeadingBlockProps
	| InteractionBlockProps
	| IntroBlockProps
	| OutroBlockProps

export interface SimpleAST {
	blocks: Block[]
}
