import { JSONContent } from '@tiptap/core'
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

const getSimpleAST = (state: JSONContent): SimpleAST => {
  const slabs = state?.content?.filter((node) => node.type === 'slab')

  const blocks: Block[] = []

  const getCommonProps = (slab: JSONContent) => {
    const noteNode = slab.content
      ?.filter((node) => node.type === 'note')
      .map((node) => node.content?.[0]?.content)

    const note = noteNode
      ? textContent(noteNode?.[0] as JSONContent[])
      : undefined

    const descriptionNode = slab.content?.find(
      (node) => node.type === 'paragraph'
    )?.content
    const description = textContent(descriptionNode)

    const titleNode = slab.content?.find(
      (node) => node.type === 'heading'
    )?.content
    const title = textContent(titleNode)

    return { note, description, title }
  }

  slabs?.forEach((slab) => {
    if (slab.attrs?.type === 'code') {
      let codeBlock: CodeBlock = {}

      const code = slab.content?.find((node) => node.type === 'codeBlock')
      const codeValue = textContent(code?.content)

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
    } else if (slab.attrs?.type === 'video') {
      const { description, note, title } = getCommonProps(slab)

      const video = slab.content?.find((node) => node.type === 'video')

      blocks.push({
        type: 'videoBlock',
        id: slab.attrs?.id as string,
        pos: 0,
        videoBlock: {
          url: video?.attrs?.src as string,
          description,
          title,
          note,
          transformations: video?.attrs?.['data-transformations']
            ? JSON.parse(video?.attrs?.['data-transformations'])
            : undefined,
        },
      })
    } else if (slab.attrs?.type === 'image') {
      const image = slab.content?.find((node) => node.type === 'image')

      const url = image?.attrs?.src

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
    } else if (slab.attrs?.type === 'list') {
      const { description, note, title } = getCommonProps(slab)

      const listItems = slab.content
        ?.find((node) => node.type === 'bulletList')
        ?.content?.filter((child) => child.type === 'listItem')

      const simplifyListItem = (listItem: JSONContent): ListItem => {
        const item: ListItem = {}

        listItem.content?.forEach((node) => {
          if (node.type === 'paragraph') {
            item.content = textContent(node.content)
            item.text = textContent(node.content)
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

const getCommonBlocks = (
  title: string | undefined,
  desc: string | undefined,
  notes: string | undefined
) => {
  const heading: JSONContent = {
    type: 'heading',
    attrs: {
      level: 2,
    },
    content: title
      ? [
          {
            type: 'text',
            text: title,
          },
        ]
      : undefined,
  }
  const description: JSONContent = {
    type: 'paragraph',
    content: desc
      ? [
          {
            type: 'text',
            text: desc,
          },
        ]
      : undefined,
  }

  const note: JSONContent = {
    type: 'note',
    content: [
      {
        type: 'paragraph',
        content: notes
          ? [
              {
                type: 'text',
                text: notes,
              },
            ]
          : undefined,
      },
    ],
  }
  return { heading, description, note }
}

const getEditorJSON = (ast: SimpleAST): JSONContent => {
  const state: JSONContent[] = []
  ast.blocks.forEach((block) => {
    switch (block.type) {
      case 'codeBlock': {
        const { heading, description, note } = getCommonBlocks(
          block.codeBlock.title,
          block.codeBlock.description,
          block.codeBlock.note
        )
        state.push({
          type: 'slab',
          attrs: {
            type: 'code',
            id: block.id,
          },
          content: [
            heading,
            description,
            {
              type: 'codeBlock',
              attrs: {
                language: block.codeBlock.language,
              },
              content: [
                {
                  type: 'text',
                  text: block.codeBlock.code,
                },
              ],
            },
            note,
          ],
        })
        break
      }
      case 'videoBlock': {
        const { heading, description, note } = getCommonBlocks(
          block.videoBlock.title,
          block.videoBlock.description,
          block.videoBlock.note
        )
        state.push({
          type: 'slab',
          attrs: {
            type: 'video',
            id: block.id,
          },
          content: [
            heading,
            description,
            {
              type: 'video',
              attrs: {
                src: block.videoBlock.url,
                'data-transformations': JSON.stringify(
                  block.videoBlock.transformations
                ),
              },
            },
            note,
          ],
        })
        break
      }
      case 'imageBlock': {
        const { heading, description, note } = getCommonBlocks(
          block.imageBlock.title,
          block.imageBlock.description,
          block.imageBlock.note
        )
        state.push({
          type: 'slab',
          attrs: {
            type: 'image',
            id: block.id,
          },
          content: [
            heading,
            description,
            {
              type: 'image',
              attrs: {
                src: block.imageBlock.url,
              },
            },
            note,
          ],
        })
        break
      }
      case 'listBlock': {
        const { heading, description, note } = getCommonBlocks(
          block.listBlock.title,
          block.listBlock.description,
          block.listBlock.note
        )
        state.push({
          type: 'slab',
          attrs: {
            type: 'list',
            id: block.id,
          },
          content: [
            heading,
            description,
            {
              type: 'bulletList',
              content: block.listBlock.list?.map((item) => {
                return {
                  type: 'listItem',
                  content: [
                    {
                      type: 'paragraph',
                      content: [
                        {
                          type: 'text',
                          text: item.content,
                        },
                      ],
                    },
                  ],
                }
              }),
            },
            note,
          ],
        })
        break
      }
      default:
        break
    }
  })

  return {
    type: 'doc',
    content: state,
  } as JSONContent
}

const useUtils = () => ({
  getSimpleAST,
  getEditorJSON,
})

export { useUtils }
