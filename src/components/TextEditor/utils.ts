import { RemirrorJSON } from '@remirror/core'
import { Transformations } from '../../modules/Flick/components/VideoEditor'

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
  // time in seconds
  from?: number
  // time in seconds
  to?: number
  // crop details
  x?: number
  y?: number
  width?: number
  height?: number
  transformations?: Transformations
}

export interface ImageBlock {
  url?: string
  title?: string
  note?: string
  description?: string
}

export interface ListItem {
  content?: string
  items?: ListItem[]
  level?: number
  text?: string
}

export interface CommonBlockProps {
  id: string
  pos: number
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

export type Block =
  | CodeBlockProps
  | VideoBlockProps
  | ListBlockProps
  | ImageBlockProps

export interface SimpleAST {
  blocks: Block[]
}

// TODO: Refactor this...

const getSimpleAST = (state: RemirrorJSON): SimpleAST => {
  const slabs = state.content?.filter((node) => node.type === 'slab')

  const blocks: Block[] = []

  const getCommonProps = (slab: RemirrorJSON) => {
    const note = slab.content?.find(
      (node) => node.type === 'callout' && node.attrs?.type === 'info'
    )?.content?.[0].content?.[0].text
    const description = slab.content?.find(
      (node) => node.type === 'callout' && node.attrs?.type === 'success'
    )?.content?.[0].content?.[0].text
    const title = slab.content?.find((node) => node.type === 'heading')
      ?.content?.[0].text

    return { note, description, title }
  }

  // eslint-disable-next-line consistent-return
  slabs?.forEach((slab) => {
    const slabItems = slab.content?.map((node) => node.type)

    if (slabItems?.includes('codeBlock')) {
      let codeBlock: CodeBlock = {}

      const code = slab.content?.find((node) => node.type === 'codeBlock')
      const codeValue = code?.content?.[0].text

      const { description, note, title } = getCommonProps(slab)

      codeBlock = {
        code: codeValue,
        language: code?.attrs?.language as string,
        note,
        description,
        title,
      }

      blocks.push({
        type: 'codeBlock',
        codeBlock,
        id: slab.attrs?.id as string,
        pos: 0,
      })
    } else if (slabItems?.includes('iframe')) {
      const { description, note, title } = getCommonProps(slab)

      const iframe = slab.content?.find((node) => node.type === 'iframe')

      blocks.push({
        type: 'videoBlock',
        id: slab.attrs?.id as string,
        pos: 0,
        videoBlock: {
          url: iframe?.attrs?.src as string,
          description,
          title,
          note,
          transformations: iframe?.attrs?.['data-transformations'] as
            | Transformations
            | undefined,
        },
      })
    } else if (slabItems?.includes('paragraph')) {
      // Image is inline, we need to find it in the paragraph.
      const image = slab.content
        ?.find((c) => c.type === 'paragraph')
        ?.content?.find((node) => node.type === 'image')
      if (!image) return

      const url = image.attrs?.src

      const { description, note, title } = getCommonProps(slab)
      blocks.push({
        type: 'imageBlock',
        id: slab.attrs?.id as string,
        pos: 0,
        imageBlock: {
          url: url as string,
          description,
          title,
          note,
        },
      })
    } else if (slabItems?.includes('bulletList')) {
      const { description, note, title } = getCommonProps(slab)

      const listItems = slab.content
        ?.find((node) => node.type === 'bulletList')
        ?.content?.filter((child) => child.type === 'listItem')

      const simplifyListItem = (listItem: RemirrorJSON): ListItem => {
        const item: ListItem = {}

        listItem.content?.forEach((node) => {
          if (node.type === 'paragraph') {
            item.content = node.content?.[0].text
            item.text = node.content?.[0].text
          }
          if (node.type === 'bulletList') {
            item.items = node.content?.map((child) => simplifyListItem(child))
          }
        })

        return item
      }

      const simpleListItems = listItems?.map((listItem) => {
        return simplifyListItem(listItem)
      })

      blocks.push({
        type: 'listBlock',
        id: slab.attrs?.id as string,
        pos: 0,
        listBlock: {
          description,
          title,
          note,
          list: simpleListItems,
        },
      })
    }
  })

  return { blocks }
}

const useUtils = () => ({
  getSimpleAST,
})

export { useUtils }
