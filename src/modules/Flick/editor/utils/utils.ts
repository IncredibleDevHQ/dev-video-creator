import { JSONContent } from '@tiptap/core'
import { IntroState } from '../../../Studio/effects/fragments/IntroFragment'
import { Transformations } from '../blocks/VideoEditor'

export type Layout =
  | 'top-right-circle'
  | 'top-left-circle'
  | 'bottom-left-circle'
  | 'bottom-right-circle'
  | 'top-right-square'
  | 'top-left-square'
  | 'bottom-left-square'
  | 'bottom-right-square'
  | 'right-bar'
  | 'left-bar'
  | 'right-bar-floating'
  | 'left-bar-floating'

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
  note?: string
  description?: string
  layout?: Layout
  isAutomated?: boolean
  explanations?: CommentExplanations[]
}

export interface ListBlock {
  list?: ListItem[]
  title?: string
  note?: string
  description?: string
}

// TODO: Improve VideoBlock interface...
export interface VideoBlock {
  url?: string
  title?: string
  note?: string
  description?: string
  transformations?: Transformations
}

export interface ImageBlock {
  url?: string
  title?: string
  note?: string
  description?: string
  type?: 'image' | 'gif'
}

export interface IntroBlock {
  order: IntroState[]
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
}

export type Block =
  | CodeBlockProps
  | VideoBlockProps
  | ListBlockProps
  | ImageBlockProps
  | IntroBlockProps
  | OutroBlockProps

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
    .join('&nbsp;')
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
      .join('&nbsp;')

    const titleNode = slice.find((node) => node.type === 'heading')
    const title = titleNode?.content?.[0]?.text
    nodeIds.push(titleNode?.attrs?.id)

    const noteNode = slice.find((node) => node.type === 'blockquote')
    const note = noteNode?.content
      ?.map((node) => {
        return node.content?.[0]?.text
      })
      .join('\n')
    nodeIds.push(noteNode?.attrs?.id)

    return { note, description, title, nodeIds }
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
        blocks.push({
          type: 'imageBlock',
          id: slab.attrs?.id,
          pos: blockPosition,
          nodeIds: [slab.attrs?.id],
          imageBlock: {
            title: textContent(slab.content),
          },
        })
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
    } else if (slab.type === 'paragraph') {
      slab.content?.forEach((node) => {
        if (node.type === 'image') {
          const url = node?.attrs?.src
          const type = url.endsWith('.gif') ? 'gif' : 'image'

          const { description, note, title, nodeIds } = getCommonProps(index)
          blocks.push({
            type: 'imageBlock',
            id: slab.attrs?.id as string,
            pos: blockPosition,
            nodeIds,
            imageBlock: {
              url: url as string,
              description,
              title: title || `Image ${blockCount.imageBlock + 1}`,
              note,
              type,
            },
          })
          blockCount.imageBlock += 1
          prevCoreBlockPos = index
          blockPosition += 1
        }
      })
    } else if (slab.type === 'codeBlock') {
      let codeBlock: CodeBlock = {}
      const codeValue = textContent(slab?.content)

      const { description, note, title, nodeIds } = getCommonProps(index)

      codeBlock = {
        code: codeValue,
        language: slab?.attrs?.language as string,
        note,
        description,
        title: title || `Code ${blockCount.codeBlock + 1}`,
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
      const { description, note, title, nodeIds } = getCommonProps(index)

      blocks.push({
        type: 'videoBlock',
        id: slab.attrs?.id as string,
        pos: blockPosition,
        nodeIds,
        videoBlock: {
          url: slab?.attrs?.src as string,
          description,
          title: title || `Video ${blockCount.videoBlock + 1}`,
          note,
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

      const { description, note, title, nodeIds } = getCommonProps(index)
      blocks.push({
        type: 'imageBlock',
        id: slab.attrs?.id as string,
        pos: blockPosition,
        nodeIds,
        imageBlock: {
          url: url as string,
          description,
          title: title || `Image ${blockCount.imageBlock + 1}`,
          note,
          type,
        },
      })

      blockCount.imageBlock += 1
      prevCoreBlockPos = index
      blockPosition += 1
    } else if (slab.type === 'bulletList' || slab.type === 'orderedList') {
      const { description, note, title, nodeIds } = getCommonProps(index)

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
          title: title || `List ${blockCount.listBlock + 1}`,
          note,
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
      return block.codeBlock.title || 'Code Block'
    case 'listBlock':
      return block.listBlock.title || 'List Block'
    case 'imageBlock':
      return block.imageBlock.title || 'Image Block'
    case 'videoBlock':
      return block.videoBlock.title || 'Video Block'
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
