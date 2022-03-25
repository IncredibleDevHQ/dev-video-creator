import { JSONContent } from '@tiptap/core'
import { Layout } from '../../../../utils/configTypes'
import { IntroState } from '../../../Studio/effects/fragments/IntroFragment'
import { Transformations } from '../blocks/VideoEditor'

// export type Layout =
//   | 'top-right-circle'
//   | 'top-left-circle'
//   | 'bottom-left-circle'
//   | 'bottom-right-circle'
//   | 'top-right-square'
//   | 'top-left-square'
//   | 'bottom-left-square'
//   | 'bottom-right-square'
//   | 'right-bar'
//   | 'left-bar'
//   | 'right-bar-floating'
//   | 'left-bar-floating'

export interface CommentExplanations {
  explanation: string | undefined
  from: number | undefined
  to: number | undefined
  // code: ColorCode[] | undefined
}
export interface CodeBlock {
  code?: string
  colorCodes?: any
  language?: string
  title?: string
  fallbackTitle?: string
  note?: string
  noteId?: string
  description?: string
  layout?: Layout
  isAutomated?: boolean
  explanations?: CommentExplanations[]
}

export interface ListBlock {
  list?: ListItem[]
  title?: string
  fallbackTitle?: string
  note?: string
  noteId?: string
  description?: string
}

// TODO: Improve VideoBlock interface...
export interface VideoBlock {
  url?: string
  title?: string
  fallbackTitle?: string
  caption?: string
  note?: string
  noteId?: string
  description?: string
  transformations?: Transformations
}

export interface ImageBlock {
  url?: string
  title?: string
  fallbackTitle?: string
  caption?: string
  note?: string
  noteId?: string
  description?: string
  type?: 'image' | 'gif'
}

export interface IntroBlock {
  order: IntroState[]
  note?: string
}

export interface OutroBlock {
  note?: string
}

export interface RichTextContent {
  text: string
  marks: string[]
}

export interface ListItem {
  content?: {
    type: 'code' | 'image' | 'richText' | 'text'
    content: CodeBlock | ImageBlock | RichTextContent | string
    line: number
  }[]
  items?: ListItem[]
  level?: number
  text?: string
}

export interface CommonBlockProps {
  id: string
  pos: number
  nodeIds?: string[]
}

export interface CodeBlockProps extends CommonBlockProps {
  type: 'codeBlock'
  codeBlock: CodeBlock
}

export interface VideoBlockProps extends CommonBlockProps {
  type: 'videoBlock'
  videoBlock: VideoBlock
}

export interface ListBlockProps extends CommonBlockProps {
  type: 'listBlock'
  listBlock: ListBlock
}

export interface ImageBlockProps extends CommonBlockProps {
  type: 'imageBlock'
  imageBlock: ImageBlock
}

export interface IntroBlockProps extends CommonBlockProps {
  type: 'introBlock'
  introBlock: IntroBlock
}

export interface OutroBlockProps extends CommonBlockProps {
  type: 'outroBlock'
  outroBlock?: OutroBlock
}

export interface ComposedBlockProps extends CommonBlockProps {
  type: 'composedBlock'
  composedBlock: (CodeBlock | VideoBlock | ListBlock | ImageBlock)[]
}

export type Block =
  | CodeBlockProps
  | VideoBlockProps
  | ListBlockProps
  | ImageBlockProps
  | IntroBlockProps
  | OutroBlockProps
  | ComposedBlockProps

export interface SimpleAST {
  blocks: Block[]
}

export type Position = {
  x: number
  y: number
}

const textContent = (contentArray?: JSONContent[]) => {
  if (!contentArray) {
    return undefined
  }

  return contentArray
    .map((node) => {
      if (node.type === 'text') {
        return node.text
      }
      return ''
    })
    .join('')
}

const getPointContent = (contentArray?: JSONContent[]) => {
  if (!contentArray) return []
  const content: {
    type: 'code' | 'image' | 'richText' | 'text'
    content: CodeBlock | ImageBlock | RichTextContent | string
    line: number
  }[] = []

  let line = 0

  contentArray.forEach((node) => {
    switch (node.type) {
      case 'paragraph': {
        node.content?.forEach((node) => {
          if (!node.text) return
          if (node.marks) {
            const marks = node.marks.map((mark) => mark.type)
            content.push({
              type: 'richText',
              line,
              content: {
                text: node.text,
                marks,
              } as RichTextContent,
            })
          } else {
            content.push({ type: 'text', content: node.text, line })
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

const getSimpleAST = async (state: JSONContent): Promise<SimpleAST> => {
  const blocks: Block[] = []

  const blockCount = {
    codeBlock: 0,
    videoBlock: 0,
    listBlock: 0,
    imageBlock: 0,
  }

  const getCommonProps = (index: number) => {
    const nodeIds: string[] = []

    const slice = [
      ...(state.content?.slice(prevCoreBlockPos, index) || []),
    ].reverse()

    const description = slice
      .filter((node) => node.type === 'paragraph')
      .reverse()
      .map((p) => {
        const node = p.content?.[0]
        if (node && node.type === 'text') {
          nodeIds.push(p.attrs?.id)
          return node.text
        }
        return ''
      })
      .join('\n')

    const titleNode = slice.find((node) => node.type === 'heading')
    const title = textContent(titleNode?.content)
    nodeIds.push(titleNode?.attrs?.id)

    const noteNode = slice.find((node) => node.type === 'blockquote')
    const note = noteNode?.content
      ?.map((node) => {
        return node.content
          ?.map((node) => {
            return node.text
          })
          .join('')
      })
      .join('\n')
    nodeIds.push(noteNode?.attrs?.id)
    const noteId = noteNode?.attrs?.id

    return { note, description, title, nodeIds, noteId }
  }

  let prevCoreBlockPos = 0
  let blockPosition = 1

  console.log('state', state)

  state?.content?.forEach((slab, index) => {
    if (slab.type === 'heading') {
      const nextHeadingIndex = state.content?.findIndex(
        (node, i) => i > index && node.type === 'heading'
      )
      const nextBlockIndex = state.content?.findIndex(
        (node, i) =>
          i > index &&
          (node.type === 'codeBlock' ||
            node.type === 'video' ||
            node.type === 'bulletList' ||
            node.type === 'orderedList' ||
            node.type === 'image')
      )

      const pushBlock = () => {
        const { description, note, noteId } = getCommonProps(index)
        blocks.push({
          type: 'imageBlock',
          id: slab.attrs?.id,
          pos: blockPosition,
          nodeIds: [slab.attrs?.id],
          imageBlock: {
            title: textContent(slab.content),
            description,
            note,
            noteId,
          },
        })
        blockCount.imageBlock += 1
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
    } else if (slab.type === 'codeBlock') {
      let codeBlock: CodeBlock = {}
      const codeValue = textContent(slab?.content)

      const { description, note, title, nodeIds, noteId } =
        getCommonProps(index)

      codeBlock = {
        code: codeValue,
        language: slab?.attrs?.language as string,
        note,
        noteId,
        description,
        title,
        fallbackTitle: title || `Code ${blockCount.codeBlock + 1}`,
      }

      blocks.push({
        type: 'codeBlock',
        codeBlock,
        id: slab.attrs?.id as string,
        pos: blockPosition,
        nodeIds,
      })

      blockCount.codeBlock += 1
      prevCoreBlockPos = index
      blockPosition += 1
    } else if (slab.type === 'video') {
      const { description, note, title, nodeIds, noteId } =
        getCommonProps(index)

      blocks.push({
        type: 'videoBlock',
        id: slab.attrs?.id as string,
        pos: blockPosition,
        nodeIds,
        videoBlock: {
          url: slab?.attrs?.src as string,
          description,
          title,
          fallbackTitle: title || `Video ${blockCount.videoBlock + 1}`,
          note,
          noteId,
          caption: slab.attrs?.caption,
          transformations: slab?.attrs?.['data-transformations']
            ? JSON.parse(slab?.attrs?.['data-transformations'])
            : undefined,
        },
      })

      blockCount.videoBlock += 1
      prevCoreBlockPos = index
      blockPosition += 1
    } else if (slab.type === 'image') {
      const url = slab?.attrs?.src
      const type = url.endsWith('.gif') ? 'gif' : 'image'

      const { description, note, title, nodeIds, noteId } =
        getCommonProps(index)
      blocks.push({
        type: 'imageBlock',
        id: slab.attrs?.id as string,
        pos: blockPosition,
        nodeIds,
        imageBlock: {
          url: url as string,
          description,
          title,
          fallbackTitle: title || `Image ${blockCount.imageBlock + 1}`,
          note,
          noteId,
          type,
          caption: slab.attrs?.caption,
        },
      })

      blockCount.imageBlock += 1
      prevCoreBlockPos = index
      blockPosition += 1
    } else if (slab.type === 'bulletList' || slab.type === 'orderedList') {
      const { description, note, title, nodeIds, noteId } =
        getCommonProps(index)

      const listItems = slab.content?.filter(
        (child) => child.type === 'listItem'
      )

      const simpleListItems: ListItem[] = []

      const simplifyListItem = (listItem: JSONContent, lvl: number) => {
        const item: ListItem = {}

        item.content = getPointContent(listItem.content)
        item.level = lvl
        simpleListItems.push(item)

        listItem.content?.forEach((node) => {
          if (node.type === 'bulletList' || node.type === 'orderedList') {
            node.content?.map((li) => simplifyListItem(li, lvl + 1))
          }
        })
      }

      if (listItems) listItems?.map((listItem) => simplifyListItem(listItem, 1))

      blocks.push({
        type: 'listBlock',
        id: slab.attrs?.id as string,
        pos: blockPosition,
        nodeIds,
        listBlock: {
          description,
          title,
          fallbackTitle: title || `List ${blockCount.listBlock + 1}`,
          note,
          noteId,
          list: simpleListItems,
        },
      })

      blockCount.listBlock += 1
      prevCoreBlockPos = index
      blockPosition += 1
    }
  })

  // console.log('blocks', blocks)

  return { blocks }
}

export const getBlockTitle = (block: Block): string => {
  switch (block.type) {
    case 'introBlock':
      return 'Intro'
    case 'codeBlock':
      return (
        block.codeBlock.title || block.codeBlock.fallbackTitle || 'Code Block'
      )
    case 'listBlock':
      return (
        block.listBlock.title || block.listBlock.fallbackTitle || 'List Block'
      )
    case 'imageBlock':
      return (
        block.imageBlock.title ||
        block.imageBlock.fallbackTitle ||
        'Image Block'
      )
    case 'videoBlock':
      return (
        block.videoBlock.title ||
        block.videoBlock.fallbackTitle ||
        'Video Block'
      )
    case 'outroBlock':
      return 'Outro'
    default:
      return 'Block'
  }
}

const useUtils = () => ({
  getSimpleAST,
  getBlockTitle,
})

export { useUtils }
