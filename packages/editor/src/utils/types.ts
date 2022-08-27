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
