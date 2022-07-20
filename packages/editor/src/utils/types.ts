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
